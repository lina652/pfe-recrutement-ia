"""
Interview orchestration service - coordinates all interview components.
"""
import logging
import json
from pathlib import Path
from typing import Optional, Dict, Tuple
from datetime import datetime
import re
from sqlalchemy.orm import Session
from groq import Groq

from models.interview import Interview, InterviewMessage, InterviewReport, InterviewStatus, InterviewPhase, InterviewRecommendation
from models.job_offer import JobOffer
from core.config import settings
from services.stt_service import get_stt_service
from services.tts_service import get_tts_service
from services.emotion_service import get_emotion_service

logger = logging.getLogger(__name__)


class InterviewService:
    """
    Manages the full interview lifecycle using Groq LLM.
    """
    
    def __init__(self):
        self.stt = get_stt_service()
        self.tts = get_tts_service()
        self.emotion = get_emotion_service()
        self.groq = Groq(api_key=settings.GROQ_API_KEY)
        self.media_dir = Path(settings.INTERVIEW_MEDIA_DIR)
        self.media_dir.mkdir(exist_ok=True)
    
    def start_interview(self, db: Session, interview_id: str, language: str = "en") -> Dict:
        """
        Initialize interview and generate opening question.
        """
        try:
            interview = db.query(Interview).filter(Interview.interview_id == interview_id).first()
            if not interview:
                raise ValueError(f"Interview not found: {interview_id}")
            
            # Update interview status
            interview.status = InterviewStatus.IN_PROGRESS
            interview.started_at = datetime.utcnow()
            interview.language = language
            interview.phase = InterviewPhase.INTRO
            db.commit()
            
            # Fetch job title
            job = db.query(JobOffer).filter(JobOffer.job_id == interview.job_id).first()
            job_title = job.title if job else "the open position"

            # Generate opening question with enhanced prompt
            system_prompt = self._get_system_prompt(
                language=language, 
                phase=interview.phase, 
                job_title=job_title,
                turn_count=0,
                turns_in_phase=0,
                last_signals={}
            )
            opening_question = self._generate_bot_response(
                system_prompt=system_prompt,
                conversation_history=[],
                context={"phase": InterviewPhase.INTRO, "turn": 0}
            )
            
            # Generate TTS audio
            audio_path = self.tts.synthesize_sync(opening_question, language)
            audio_url_frontend = f"http://localhost:8000/media/{Path(audio_path).name}"
            
            # Save opening message
            message = InterviewMessage(
                interview_id=interview_id,
                role="bot",
                content=opening_question,
                audio_url=audio_url_frontend,
                phase=InterviewPhase.INTRO,
                turn_number=0,
                signals={}
            )
            db.add(message)
            db.commit()
            
            return {
                "interview_id": interview_id,
                "phase": interview.phase.value,
                "bot_message": opening_question,
                "audio_url": audio_url_frontend,
                "turn": 0
            }
        
        except Exception as e:
            logger.error(f"Error starting interview {interview_id}: {str(e)}")
            raise
    
    def process_turn(self, db: Session, interview_id: str, audio_webm_path: str, video_webm_path: Optional[str] = None) -> Dict:
        """
        Process one interview turn: extract audio/video, transcribe, analyze emotions, generate response.
        """
        try:
            interview = db.query(Interview).filter(Interview.interview_id == interview_id).first()
            if not interview:
                raise ValueError(f"Interview not found: {interview_id}")
            
            # 1. Transcribe candidate audio
            candidate_transcript = self.stt.transcribe(audio_webm_path, interview.language)["text"]
            logger.info(f"Turn {interview.turn_count}: Transcribed candidate: {candidate_transcript[:100]}...")
            
            # 2. Extract emotions from video if provided
            signals = {}
            if video_webm_path and Path(video_webm_path).exists():
                try:
                    frames = self.emotion.extract_frames(video_webm_path, interval_sec=2)
                    emotion_analysis = self.emotion.analyze_frames(frames)
                    signals = {
                        "emotions": emotion_analysis["aggregate_emotions"],
                        "dominant_emotion": emotion_analysis["dominant_emotion"],
                        "engagement": emotion_analysis["engagement_score"],
                        "frames_analyzed": emotion_analysis["analyzed_frames"]
                    }
                except Exception as e:
                    logger.warning(f"Could not analyze video emotions: {str(e)}")
                    signals = {}
            
            # 3. Save candidate message
            candidate_message = InterviewMessage(
                interview_id=interview_id,
                role="candidate",
                content=candidate_transcript,
                audio_url=audio_webm_path,
                phase=interview.phase,
                turn_number=interview.turn_count,
                signals=signals
            )
            db.add(candidate_message)
            db.flush()  # Ensure message is saved before generating response
            
            # 4. Get conversation history
            messages = db.query(InterviewMessage).filter(
                InterviewMessage.interview_id == interview_id
            ).order_by(InterviewMessage.turn_number).all()
            
            conversation_history = [
                {
                    "role": "assistant" if m.role == "bot" else "user",
                    "content": m.content
                }
                for m in messages
            ]
            
            # 5. Calculate turns in current phase
            phase_turns = db.query(InterviewMessage).filter(
                InterviewMessage.interview_id == interview_id,
                InterviewMessage.phase == interview.phase,
                InterviewMessage.role == "candidate"
            ).count()
            
            # 6. Determine if interview should end
            should_end = interview.turn_count >= settings.INTERVIEW_MAX_TURNS
            
            # 7. Generate bot response with enhanced context
            job = db.query(JobOffer).filter(JobOffer.job_id == interview.job_id).first()
            job_title = job.title if job else "the open position"
            
            system_prompt = self._get_system_prompt(
                language=interview.language, 
                phase=interview.phase, 
                job_title=job_title,
                turn_count=interview.turn_count,
                turns_in_phase=phase_turns,
                last_signals=signals
            )
            
            if should_end:
                bot_response = self._generate_closing_response(system_prompt, interview.language)
            else:
                bot_response = self._generate_bot_response(
                    system_prompt=system_prompt,
                    conversation_history=conversation_history,
                    context={"phase": interview.phase, "turn": interview.turn_count, "signals": signals}
                )
            
            # 8. Force phase transition if stuck too long (MAX 3 turns per phase)
            MAX_TURNS_PER_PHASE = 3
            if phase_turns >= MAX_TURNS_PER_PHASE and interview.phase != InterviewPhase.CLOSING:
                old_phase = interview.phase
                interview.phase = self._get_next_phase(interview.phase, interview.turn_count)
                if interview.phase != old_phase:
                    logger.info(f"Forced phase transition: {old_phase.value} → {interview.phase.value}")
            
            # 9. Generate TTS audio for bot response
            bot_audio_path = self.tts.synthesize_sync(bot_response, interview.language)
            bot_audio_url_frontend = f"http://localhost:8000/media/{Path(bot_audio_path).name}"
            
            # 10. Save bot message
            interview.turn_count += 1
            bot_message = InterviewMessage(
                interview_id=interview_id,
                role="bot",
                content=bot_response,
                audio_url=bot_audio_url_frontend,
                phase=interview.phase,
                turn_number=interview.turn_count,
                signals={}
            )
            db.add(bot_message)
            
            # 11. Manage phase transitions (if not already forced)
            if not should_end:
                new_phase = self._get_next_phase(interview.phase, interview.turn_count)
                if new_phase != interview.phase:
                    interview.phase = new_phase
            else:
                interview.phase = InterviewPhase.DONE
                interview.status = InterviewStatus.COMPLETED
                interview.completed_at = datetime.utcnow()
            
            db.commit()
            
            return {
                "interview_id": interview_id,
                "turn": interview.turn_count,
                "phase": interview.phase.value,
                "candidate_transcript": candidate_transcript,
                "bot_response": bot_response,
                "audio_url": bot_audio_url_frontend,
                "signals": signals,
                "should_end": should_end or interview.phase == InterviewPhase.DONE
            }
        
        except Exception as e:
            logger.error(f"Error processing turn for interview {interview_id}: {str(e)}")
            db.rollback()
            raise
    
    def generate_report(self, db: Session, interview_id: str) -> Dict:
        """
        Generate AI evaluation report after interview completes.
        """
        try:
            interview = db.query(Interview).filter(Interview.interview_id == interview_id).first()
            if not interview:
                raise ValueError(f"Interview not found: {interview_id}")
            
            # Collect all messages
            messages = db.query(InterviewMessage).filter(
                InterviewMessage.interview_id == interview_id
            ).order_by(InterviewMessage.turn_number).all()
            
            # Build conversation text
            conversation_text = "\n".join([
                f"{m.role.upper()}: {m.content}"
                for m in messages
            ])
            
            # Generate comprehensive report using Groq LLM (enhanced with bot_rh_final_v2 format)
            system_prompt = f"""Tu es un recruteur senior expérimenté. Analyse cet entretien et produis un rapport d'évaluation détaillé.
Language: {interview.language}
Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de blocs de code)."""
            
            report_prompt = f"""Analyse cet entretien et fournis une évaluation au format JSON :
{conversation_text}

Retourne un JSON avec cette structure exacte :
{{
    "overall_score": 0-100,
    "communication_score": 0-10,
    "technical_score": 0-10,
    "motivation_score": 0-10,
    "recommendation": "strong_hire|hire|maybe|no_hire",
    "strengths": ["point fort 1", "point fort 2", ...],
    "weaknesses": ["point faible 1", "point faible 2", ...],
    "technical_competencies": ["compétence technique 1", "compétence technique 2", ...],
    "soft_skills": {{"communication": "bon/moyen/faible", "teamwork": "bon/moyen/faible", "problem_solving": "bon/moyen/faible"}},
    "red_flags": ["signal d'alerte 1", ...] ou [],
    "follow_up_questions": ["question de suivi recommandée 1", ...],
    "summary": "résumé de 4-5 phrases de l'évaluation globale du candidat"
}}"""
            
            response = self.groq.chat.completions.create(
                model=settings.GROQ_LLM_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": report_prompt}
                ],
                temperature=0.3,
                max_tokens=1000
            )
            
            # Parse response
            response_text = response.choices[0].message.content.strip()
            # Remove markdown code blocks if present
            response_text = re.sub(r"```json\n?|\n?```", "", response_text)
            report_data = json.loads(response_text)
            
            # Save report with all fields from bot_rh_final_v2
            report = InterviewReport(
                interview_id=interview_id,
                overall_score=float(report_data.get("overall_score", 50)),
                communication_score=float(report_data.get("communication_score", 5)),
                technical_score=float(report_data.get("technical_score", 5)),
                motivation_score=float(report_data.get("motivation_score", 5)),
                recommendation=InterviewRecommendation(report_data.get("recommendation", "maybe")),
                strengths=report_data.get("strengths", []),
                weaknesses=report_data.get("weaknesses", []),
                technical_competencies=report_data.get("technical_competencies", []),
                soft_skills=report_data.get("soft_skills", {}),
                red_flags=report_data.get("red_flags", []),
                follow_up_questions=report_data.get("follow_up_questions", []),
                summary=report_data.get("summary", "")
            )
            db.add(report)
            db.commit()
            
            logger.info(f"Generated report for interview {interview_id}: {report_data['recommendation']}")
            return report_data
        
        except Exception as e:
            logger.error(f"Error generating report for {interview_id}: {str(e)}")
            raise
    
    def _get_system_prompt(self, language: str, phase: InterviewPhase, job_title: str = "the open position",
                           turn_count: int = 0, turns_in_phase: int = 0, last_signals: dict = None) -> str:
        """
        Generate system prompt for the interview bot based on language, phase, and context.
        Enhanced with bot_rh_final_v2 characteristics.
        """
        lang_name = "French" if language == "fr" else "English"
        agent_name = "L'agent IA Layla" if language == "fr" else "AI agent Layla"
        signals_str = json.dumps(last_signals or {}, ensure_ascii=False)
        
        phase_prompts = {
            InterviewPhase.INTRO: f"Start by introducing yourself and the '{job_title}' position. Ask open-ended questions to understand the candidate's background and motivation.",
            InterviewPhase.TECHNICAL: f"Acknowledge the candidate's previous answer briefly and IMMEDIATELY ask the next technical question relevant to the '{job_title}' position. Focus on their skills and experience.",
            InterviewPhase.BEHAVIORAL: f"Acknowledge the candidate's previous answer briefly and IMMEDIATELY ask the next behavioral question about past experiences, teamwork, challenges, and problem-solving examples.",
            InterviewPhase.CLOSING: f"Ask if the candidate has any questions, summarize the next steps, and thank them warmly for their time.",
        }
        
        base_prompt = f"""Tu es {agent_name}, un recruteur RH expérimenté qui mène un entretien pour le poste de {job_title}.

RÈGLES STRICTES :
1. Parle UNIQUEMENT en {lang_name}. Ne change JAMAIS de langue.
2. UNE SEULE question à la fois. Max 2-3 phrases par réponse.
3. Phases strictes dans cet ordre : intro → technical → behavioral → closing.
4. Phase actuelle : {phase.value.upper()} (tour {turn_count}, {turns_in_phase} tours dans cette phase)
5. Tu DOIS passer à la phase suivante après 2-3 tours par phase maximum.
6. À la phase 'closing', remercie le candidat et termine l'entretien.

7. Si le candidat part hors-sujet : recadre poliment vers le poste SANS répondre au hors-sujet.
   Exemple : "C'est intéressant, mais revenons à votre expérience pour ce poste..."

8. Si le candidat pose des questions sur l'entreprise/salaire/conditions :
   - NE DONNE AUCUN DÉTAIL inventé sur l'entreprise ou le salaire
   - Réponds : "Ces informations vous seront communiquées à l'étape suivante du processus par l'équipe RH. Pour l'instant, concentrons-nous sur votre candidature."
   - Enchaîne immédiatement avec ta question.

9. Si le candidat refuse de coopérer ou conteste ton autorité :
   - Reste professionnel, pas conciliant.
   - Dis : "Je comprends, mais cet entretien suit une structure définie. Si vous ne souhaitez pas continuer, merci de me l'indiquer clairement."

10. Signaux dernier tour : {signals_str}
    - Si stress élevé (engagement faible) : rassure le candidat, simplifie la question
    - Si émotion négative dominante : sois plus encourageant

PHASE ACTUELLE - {phase.value.upper()}:
{phase_prompts.get(phase, phase_prompts[InterviewPhase.INTRO])}

IMPORTANT - FORMAT DE RÉPONSE:
- Garde tes réponses concises (1-2 phrases max).
- Tu DOIS TOUJOURS poser exactement UNE question claire pour faire avancer l'entretien (sauf en phase CLOSING).
- Ne reste pas bloqué sur le même sujet. Si le candidat a répondu, passe au sujet suivant.
- À la fin de ta réponse, dis exactement :
  - En français : "Je t'accorde 10 secondes pour réfléchir."
  - En anglais : "I'll give you 10 seconds to think."
- Ne dis RIEN après cette phrase."""
        
        return base_prompt
    
    def _generate_bot_response(self, system_prompt: str, conversation_history: list, context: dict) -> str:
        """
        Generate bot response using Groq LLM.
        """
        try:
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend(conversation_history[-10:])  # Keep last 10 messages for context
            
            response = self.groq.chat.completions.create(
                model=settings.GROQ_LLM_MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=500
            )
            
            bot_response = response.choices[0].message.content.strip()
            return bot_response
        
        except Exception as e:
            logger.error(f"Error generating bot response: {str(e)}")
            raise
    
    def _generate_closing_response(self, system_prompt: str, language: str) -> str:
        """
        Generate closing message.
        """
        closing_message = {
            "fr": "Merci beaucoup d'avoir participé à cet entretien! Nous vous recontacterons très bientôt avec les résultats. Bonne journée!",
            "en": "Thank you so much for participating in this interview! We'll get back to you very soon with the results. Have a great day!"
        }
        return closing_message.get(language, closing_message["en"])
    
    def _get_next_phase(self, current_phase: InterviewPhase, turn_count: int) -> InterviewPhase:
        """
        Determine next interview phase based on turn count.
        """
        phase_transitions = {
            InterviewPhase.INTRO: (InterviewPhase.TECHNICAL, 3),  # 2-3 turns in intro
            InterviewPhase.TECHNICAL: (InterviewPhase.BEHAVIORAL, 7),  # 3-4 turns in technical
            InterviewPhase.BEHAVIORAL: (InterviewPhase.CLOSING, 10),  # 2-3 turns in behavioral
            InterviewPhase.CLOSING: (InterviewPhase.DONE, 12),  # 1-2 turns in closing
        }
        
        if current_phase in phase_transitions:
            next_phase, max_turns = phase_transitions[current_phase]
            if turn_count >= max_turns:
                return next_phase
        
        return current_phase


# Singleton instance
_interview_service = None


def get_interview_service() -> InterviewService:
    global _interview_service
    if _interview_service is None:
        _interview_service = InterviewService()
    return _interview_service
