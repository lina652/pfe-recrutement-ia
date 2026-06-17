"""
Interview orchestration service - coordinates all interview components.
"""
import logging
import json
import os
import threading
from pathlib import Path
from typing import Optional, Dict, Tuple, List
from datetime import datetime
import re
from sqlalchemy.orm import Session
from groq import Groq

from models.interview import Interview, InterviewMessage, InterviewReport, InterviewStatus, InterviewPhase, InterviewRecommendation
from models.job_offer import JobOffer
from models.candidate import Candidate
from models.user import User
from core.config import settings
from services.stt_service import get_stt_service
from services.tts_service import get_tts_service
from services.emotion_service import get_emotion_service
from services.sentiment_service import analyze_text_sentiment
from services.identity_service import (
    detect_identity_mismatch,
    identity_warning_message,
    identity_fraud_closure_message,
    silence_response_message,
)
from services.soft_signals_service import derive_soft_signals, compute_dissonance_score
from services.language_service import (
    detect_language_mismatch,
    language_warning_message,
    language_score_penalty,
    language_penalty_summary,
)
from services.quality_advisor_service import (
    analyze_lighting,
    analyze_face_detectability,
    analyze_audio_quality,
)
from services.interview_anomaly_service import (
    build_anomaly_alerts,
    format_anomaly_block,
)

logger = logging.getLogger(__name__)

PHASE_SEQUENCE: List[InterviewPhase] = [
    InterviewPhase.INTRO,
    InterviewPhase.TECHNICAL,
    InterviewPhase.BEHAVIORAL,
    InterviewPhase.CLOSING,
    InterviewPhase.DONE,
]

PHASE_ALIASES = {
    "intro": InterviewPhase.INTRO,
    "experience": InterviewPhase.INTRO,
    "technical": InterviewPhase.TECHNICAL,
    "motivation": InterviewPhase.BEHAVIORAL,
    "behavioral": InterviewPhase.BEHAVIORAL,
    "closing": InterviewPhase.CLOSING,
    "done": InterviewPhase.DONE,
}

THINK_PHRASE = {
    "fr": "Je t'accorde 10 secondes pour réfléchir.",
    "en": "I'll give you 10 seconds to think.",
}

MAX_TURNS_PER_PHASE = 3


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
    
    def reset_interview_session(self, db: Session, interview_id: str) -> None:
        """Clear messages/reports and reset state (testing only)."""
        interview = db.query(Interview).filter(Interview.interview_id == interview_id).first()
        if not interview:
            raise ValueError(f"Interview not found: {interview_id}")

        db.query(InterviewMessage).filter(InterviewMessage.interview_id == interview_id).delete(
            synchronize_session=False
        )
        db.query(InterviewReport).filter(InterviewReport.interview_id == interview_id).delete(
            synchronize_session=False
        )
        interview.status = InterviewStatus.INVITED
        interview.phase = InterviewPhase.INTRO
        interview.turn_count = 0
        interview.started_at = None
        interview.completed_at = None
        interview.session_state = {
            "consecutive_silences": 0,
            "identity_warnings": 0,
            "language_mismatch_count": 0,
        }
        if interview.candidate_response is None:
            interview.candidate_response = "ACCEPTED"
        db.commit()
        logger.info("Interview %s reset for testing", interview_id)

    def start_interview(
        self, db: Session, interview_id: str, language: str = "en"
    ) -> Dict:
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
            interview.session_state = {
                "consecutive_silences": 0,
                "identity_warnings": 0,
                "language_mismatch_count": 0,
            }
            db.commit()

            ctx = self._load_interview_context(db, interview)
            system_prompt = self._get_system_prompt(
                language=language,
                phase=interview.phase,
                context=ctx,
                turn_count=0,
                turns_in_phase=0,
                last_signals={},
            )
            turn_result = self._generate_bot_turn(system_prompt, [], language)
            opening_question = self._append_think_phrase(
                turn_result["reply"], language, InterviewPhase.INTRO
            )
            opening_note = turn_result.get("internal_note") or ""

            # Generate TTS audio
            audio_path = self.tts.synthesize_sync(opening_question, language)
            audio_url_frontend = f"{settings.BACKEND_URL}/media/{Path(audio_path).name}"
            
            # Save opening message
            message = InterviewMessage(
                interview_id=interview_id,
                role="bot",
                content=opening_question,
                audio_url=audio_url_frontend,
                phase=InterviewPhase.INTRO,
                turn_number=0,
                signals={"internal_note": opening_note} if opening_note else {},
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
    
    def _get_session_state(self, interview: Interview) -> Dict:
        state = interview.session_state or {}
        return {
            "consecutive_silences": int(state.get("consecutive_silences", 0)),
            "identity_warnings": int(state.get("identity_warnings", 0)),
            "language_mismatch_count": int(state.get("language_mismatch_count", 0)),
        }

    def _set_session_state(self, interview: Interview, **updates) -> None:
        state = dict(interview.session_state or {})
        state.update(updates)
        interview.session_state = state

    def _estimate_audio_duration(self, audio_path: str) -> float:
        try:
            from pydub import AudioSegment
            return len(AudioSegment.from_file(audio_path)) / 1000.0
        except Exception:
            return 15.0

    def _build_turn_signals(
        self,
        candidate_transcript: str,
        stt_result: dict,
        emotion_analysis: Optional[dict],
        frame_paths: List[str],
        audio_path: str,
    ) -> Dict:
        verbal_sentiment = analyze_text_sentiment(candidate_transcript)
        signals: Dict = {"verbal_sentiment": verbal_sentiment}
        if stt_result.get("warning"):
            signals["stt_warning"] = stt_result["warning"]

        emotion_dist = {}
        frames_with_face = 0
        total_frames = len(frame_paths)
        if emotion_analysis:
            emotion_dist = emotion_analysis.get("emotion_distribution") or {}
            signals.update({
                "emotions": emotion_analysis.get("aggregate_emotions", {}),
                "dominant_emotion": emotion_analysis.get("dominant_emotion"),
                "engagement": emotion_analysis.get("engagement_score"),
                "frames_analyzed": emotion_analysis.get("frames_analyzed", 0),
                "frames_with_face": emotion_analysis.get("frames_with_face", 0),
                "signal_reliability": emotion_analysis.get("signal_reliability"),
            })
            frames_with_face = emotion_analysis.get("frames_with_face", 0)

        audio_duration = self._estimate_audio_duration(audio_path)
        word_count = len(candidate_transcript.split())
        soft = derive_soft_signals(
            emotion_dist,
            verbal_sentiment,
            audio_duration,
            word_count,
            frames_with_face=frames_with_face,
            total_frames=total_frames or 1,
        )
        signals["soft_signals"] = soft
        signals["dissonance"] = compute_dissonance_score(verbal_sentiment, emotion_dist)

        if frame_paths:
            lighting = analyze_lighting(frame_paths)
            face_detect = analyze_face_detectability(
                emotion_analysis or {"frames_with_face": 0},
                len(frame_paths),
            )
            audio_q = analyze_audio_quality(audio_path)
            global_score = int((lighting["score"] + face_detect["score"] + audio_q["score"]) / 3)
            signals["quality_report"] = {
                "lighting": lighting,
                "face_detectability": face_detect,
                "audio": audio_q,
                "global_score": global_score,
            }
        return signals

    def _enrich_signals_for_prompt(
        self, signals: dict, transcript: str, language: str = "fr"
    ) -> dict:
        enriched = dict(signals)
        soft = signals.get("soft_signals") or {}
        if soft.get("stress_score") is not None:
            enriched["stress_score"] = soft["stress_score"]
        if soft.get("engagement_score") is not None:
            enriched["engagement_score"] = soft["engagement_score"]
        diss = signals.get("dissonance") or {}
        if diss.get("label") in ("mild_dissonance", "strong_dissonance"):
            enriched["dissonance"] = diss.get("label")
            enriched["dissonance_score"] = diss.get("score")

        alerts = build_anomaly_alerts(signals, transcript, language)
        enriched["anomaly_alerts"] = alerts
        enriched["anomaly_count"] = len(alerts)
        return enriched

    def _persist_turn(
        self,
        db: Session,
        interview: Interview,
        interview_id: str,
        candidate_transcript: str,
        bot_response: str,
        audio_webm_path: str,
        signals: dict,
        should_end: bool,
        llm_internal_note: str = "",
        gate: Optional[str] = None,
    ) -> Dict:
        candidate_message = InterviewMessage(
            interview_id=interview_id,
            role="candidate",
            content=candidate_transcript or "[silence]",
            audio_url=audio_webm_path,
            phase=interview.phase,
            turn_number=interview.turn_count,
            signals=signals,
        )
        db.add(candidate_message)
        db.flush()

        bot_audio_path = self.tts.synthesize_sync(bot_response, interview.language)
        bot_audio_url = f"{settings.BACKEND_URL}/media/{Path(bot_audio_path).name}"

        interview.turn_count += 1
        bot_signals = {"internal_note": llm_internal_note} if llm_internal_note else {}
        if gate:
            bot_signals["gate"] = gate
        bot_message = InterviewMessage(
            interview_id=interview_id,
            role="bot",
            content=bot_response,
            audio_url=bot_audio_url,
            phase=interview.phase,
            turn_number=interview.turn_count,
            signals=bot_signals,
        )
        db.add(bot_message)

        if should_end:
            interview.phase = InterviewPhase.DONE
            interview.status = InterviewStatus.COMPLETED
            interview.completed_at = datetime.utcnow()

        db.commit()
        if should_end:
            try:
                self.ensure_interview_report(db, interview_id, ended_early=True)
            except Exception as report_exc:
                logger.warning(
                    "Report after gated end failed for %s: %s",
                    interview_id,
                    report_exc,
                )
        return {
            "interview_id": interview_id,
            "turn": interview.turn_count,
            "phase": interview.phase.value,
            "candidate_transcript": candidate_transcript,
            "bot_response": bot_response,
            "audio_url": bot_audio_url,
            "signals": signals,
            "should_end": should_end or interview.phase == InterviewPhase.DONE,
        }

    def process_turn(self, db: Session, interview_id: str, audio_webm_path: str, video_webm_path: Optional[str] = None) -> Dict:
        """Pipeline tour candidat : STT, émotions, qualité, gates silence/identité, LLM."""
        try:
            interview = db.query(Interview).filter(Interview.interview_id == interview_id).first()
            if not interview:
                raise ValueError(f"Interview not found: {interview_id}")

            session = self._get_session_state(interview)
            ctx = self._load_interview_context(db, interview)
            lang = interview.language or "fr"

            stt_result = self.stt.transcribe(audio_webm_path, lang)
            candidate_transcript = (stt_result.get("text") or "").strip()

            frame_paths: List[str] = []
            emotion_analysis = None
            if video_webm_path and Path(video_webm_path).exists():
                try:
                    frame_paths = self.emotion.extract_frames(video_webm_path, interval_sec=2)
                    emotion_analysis = self.emotion.analyze_facial_emotions(frame_paths)
                except Exception as exc:
                    logger.warning("Video emotion analysis failed: %s", exc)

            signals = self._build_turn_signals(
                candidate_transcript, stt_result, emotion_analysis, frame_paths, audio_webm_path
            )

            # —— Gate 1 : silence ——
            is_silent = (
                not candidate_transcript
                or len(candidate_transcript) < 3
                or bool(stt_result.get("warning"))
            )
            if is_silent:
                session["consecutive_silences"] += 1
                self._set_session_state(
                    interview, consecutive_silences=session["consecutive_silences"]
                )
                reply, end_silence = silence_response_message(
                    lang, session["consecutive_silences"]
                )
                return self._persist_turn(
                    db,
                    interview,
                    interview_id,
                    "",
                    reply,
                    audio_webm_path,
                    {**signals, "silent": True},
                    end_silence,
                    llm_internal_note=f"Silence #{session['consecutive_silences']}",
                    gate="silence",
                )

            if session["consecutive_silences"] > 0:
                self._set_session_state(interview, consecutive_silences=0)
            session["consecutive_silences"] = 0

            # —— Gate 2 : langue de l'entretien ——
            lang_check = detect_language_mismatch(
                candidate_transcript,
                lang,
                stt_result.get("language"),
            )
            if lang_check.get("mismatch") and lang_check.get("confidence", 0) >= 0.55:
                mismatch_count = session["language_mismatch_count"] + 1
                session["language_mismatch_count"] = mismatch_count
                self._set_session_state(
                    interview, language_mismatch_count=mismatch_count
                )
                warning_msg = language_warning_message(lang, mismatch_count, lang_check)
                signals["language_check"] = lang_check
                signals["language_mismatch_turn"] = mismatch_count
                return self._persist_turn(
                    db,
                    interview,
                    interview_id,
                    candidate_transcript,
                    warning_msg,
                    audio_webm_path,
                    signals,
                    False,
                    llm_internal_note=f"Langue incorrecte ({lang_check.get('detected')} vs {lang})",
                    gate="language_mismatch",
                )

            # —— Gate 3 : identité (2 niveaux) ——
            identity_check = detect_identity_mismatch(
                candidate_transcript, ctx["candidate_name"]
            )
            iw = session["identity_warnings"]
            if (
                interview.turn_count <= 1
                and iw != -99
                and iw < 2
                and identity_check.get("mismatch")
                and identity_check.get("confidence", 0) >= 0.7
            ):
                session["identity_warnings"] = iw + 1
                self._set_session_state(
                    interview, identity_warnings=session["identity_warnings"]
                )
                if session["identity_warnings"] == 1:
                    warning_msg = identity_warning_message(
                        lang, ctx["candidate_name"], identity_check
                    )
                    signals["identity_check"] = identity_check
                    return self._persist_turn(
                        db,
                        interview,
                        interview_id,
                        candidate_transcript,
                        warning_msg,
                        audio_webm_path,
                        signals,
                        False,
                        llm_internal_note="Warning identité",
                        gate="identity_warning",
                    )
                closure_msg = identity_fraud_closure_message(
                    lang, ctx["candidate_name"], identity_check
                )
                signals["identity_check"] = identity_check
                signals["identity_fraud"] = True
                return self._persist_turn(
                    db,
                    interview,
                    interview_id,
                    candidate_transcript,
                    closure_msg,
                    audio_webm_path,
                    signals,
                    True,
                    llm_internal_note="CLÔTURE fraude identité",
                    gate="identity_fraud",
                )

            if iw >= 1 and not identity_check.get("mismatch"):
                self._set_session_state(interview, identity_warnings=-99)

            # —— Sauvegarder message candidat avant LLM ——
            candidate_message = InterviewMessage(
                interview_id=interview_id,
                role="candidate",
                content=candidate_transcript,
                audio_url=audio_webm_path,
                phase=interview.phase,
                turn_number=interview.turn_count,
                signals=signals,
            )
            db.add(candidate_message)
            db.flush()

            messages = (
                db.query(InterviewMessage)
                .filter(InterviewMessage.interview_id == interview_id)
                .order_by(InterviewMessage.turn_number)
                .all()
            )
            conversation_history = [
                {
                    "role": "assistant" if m.role == "bot" else "user",
                    "content": m.content,
                }
                for m in messages
            ]

            phase_turns = (
                db.query(InterviewMessage)
                .filter(
                    InterviewMessage.interview_id == interview_id,
                    InterviewMessage.phase == interview.phase,
                    InterviewMessage.role == "candidate",
                )
                .count()
            )

            enriched_signals = self._enrich_signals_for_prompt(
                signals, candidate_transcript, lang
            )
            anomaly_alerts = enriched_signals.get("anomaly_alerts") or []
            should_end = interview.turn_count >= settings.INTERVIEW_MAX_TURNS
            llm_internal_note = ""

            system_prompt = self._get_system_prompt(
                language=lang,
                phase=interview.phase,
                context=ctx,
                turn_count=interview.turn_count,
                turns_in_phase=phase_turns,
                last_signals=enriched_signals,
                anomaly_alerts=anomaly_alerts,
            )

            if should_end:
                bot_response = self._generate_closing_response(system_prompt, lang)
            else:
                turn_result = self._generate_bot_turn(
                    system_prompt, conversation_history, lang
                )
                llm_internal_note = turn_result.get("internal_note") or ""
                if anomaly_alerts:
                    ids = ", ".join(a["id"] for a in anomaly_alerts)
                    llm_internal_note = (
                        f"{llm_internal_note}; anomalies: {ids}".strip("; ")
                        if llm_internal_note
                        else f"anomalies: {ids}"
                    )
                bot_response = self._append_think_phrase(
                    turn_result["reply"], lang, interview.phase
                )
                if turn_result.get("should_end"):
                    should_end = True
                if turn_result.get("next_phase"):
                    interview.phase = self._apply_suggested_phase(
                        interview.phase, turn_result["next_phase"]
                    )

            if phase_turns >= MAX_TURNS_PER_PHASE and interview.phase not in (
                InterviewPhase.CLOSING,
                InterviewPhase.DONE,
            ):
                old_phase = interview.phase
                interview.phase = self._advance_phase(interview.phase)
                if interview.phase != old_phase:
                    logger.info(
                        "Forced phase transition: %s → %s",
                        old_phase.value,
                        interview.phase.value,
                    )

            if (
                not should_end
                and interview.phase == InterviewPhase.CLOSING
                and phase_turns >= MAX_TURNS_PER_PHASE
            ):
                should_end = True

            bot_audio_path = self.tts.synthesize_sync(bot_response, lang)
            bot_audio_url = f"{settings.BACKEND_URL}/media/{Path(bot_audio_path).name}"

            interview.turn_count += 1
            db.add(
                InterviewMessage(
                    interview_id=interview_id,
                    role="bot",
                    content=bot_response,
                    audio_url=bot_audio_url,
                    phase=interview.phase,
                    turn_number=interview.turn_count,
                    signals={"internal_note": llm_internal_note} if llm_internal_note else {},
                )
            )

            ended_early = False
            if should_end:
                ended_early = interview.phase not in (
                    InterviewPhase.CLOSING,
                    InterviewPhase.DONE,
                )
                interview.phase = InterviewPhase.DONE
                interview.status = InterviewStatus.COMPLETED
                interview.completed_at = datetime.utcnow()

            db.commit()

            if should_end:
                try:
                    self.ensure_interview_report(
                        db, interview_id, ended_early=ended_early
                    )
                except Exception as report_exc:
                    logger.warning(
                        "Report generation failed after interview %s: %s",
                        interview_id,
                        report_exc,
                    )

            return {
                "interview_id": interview_id,
                "turn": interview.turn_count,
                "phase": interview.phase.value,
                "candidate_transcript": candidate_transcript,
                "bot_response": bot_response,
                "audio_url": bot_audio_url,
                "signals": signals,
                "should_end": should_end or interview.phase == InterviewPhase.DONE,
            }

        except Exception as e:
            logger.error("Error processing turn for interview %s: %s", interview_id, e)
            db.rollback()
            raise
    
    def ensure_interview_report(
        self,
        db: Session,
        interview_id: str,
        *,
        ended_early: bool = False,
        force: bool = False,
    ) -> Dict:
        """Always leave a scored report for RAG/UI, including early exits and empty transcripts."""
        try:
            return self.generate_report(
                db, interview_id, force=force, ended_early=ended_early
            )
        except Exception as exc:
            logger.warning(
                "ensure_interview_report falling back for %s: %s",
                interview_id,
                exc,
            )
            return self._generate_fallback_report(
                db, interview_id, ended_early=ended_early
            )

    def _generate_fallback_report(
        self, db: Session, interview_id: str, *, ended_early: bool = False
    ) -> Dict:
        interview = db.query(Interview).filter(
            Interview.interview_id == interview_id
        ).first()
        if not interview:
            raise ValueError(f"Interview not found: {interview_id}")

        existing = db.query(InterviewReport).filter(
            InterviewReport.interview_id == interview_id
        ).first()
        if existing:
            return {
                "overall_score": existing.overall_score,
                "recommendation": existing.recommendation.value
                if hasattr(existing.recommendation, "value")
                else existing.recommendation,
            }

        messages = (
            db.query(InterviewMessage)
            .filter(InterviewMessage.interview_id == interview_id)
            .order_by(InterviewMessage.turn_number)
            .all()
        )
        ctx = self._load_interview_context(db, interview)
        report_data = self._build_fallback_report_data(
            interview, messages, ended_early=ended_early
        )
        return self._save_report(db, interview, interview_id, report_data)

    def _build_fallback_report_data(
        self,
        interview: Interview,
        messages: List[InterviewMessage],
        *,
        ended_early: bool,
    ) -> Dict:
        """Rule-based report when LLM fails or transcript is very short."""
        candidate_msgs = [m for m in messages if m.role == "candidate"]
        substantive = [
            m
            for m in candidate_msgs
            if (m.content or "").strip()
            and m.content.strip() not in ("[silence]",)
            and len((m.content or "").strip()) >= 3
        ]
        n_substantive = len(substantive)
        total_chars = sum(len((m.content or "").strip()) for m in substantive)
        phase = (
            interview.phase.value
            if hasattr(interview.phase, "value")
            else str(interview.phase)
        )

        if n_substantive == 0:
            return {
                "overall_score": 20.0,
                "communication_score": 2.0,
                "technical_score": 2.0,
                "motivation_score": 2.0,
                "recommendation": "no_hire",
                "strengths": [],
                "weaknesses": [
                    "No substantive answers recorded in the interview transcript."
                ],
                "technical_competencies": [],
                "soft_skills": {
                    "communication": "weak",
                    "teamwork": "weak",
                    "problem_solving": "weak",
                },
                "red_flags": [
                    "Interview ended with no usable candidate responses."
                ],
                "follow_up_questions": [
                    "Schedule a follow-up interview if the candidate should be reconsidered."
                ],
                "summary": (
                    "The candidate ended or left the interview before providing meaningful answers. "
                    f"Recorded phase at end: {phase}. "
                    "Insufficient data for a positive hiring recommendation."
                ),
            }

        # Heuristic scores from participation volume (partial interview)
        participation = min(1.0, (n_substantive * 15 + total_chars) / 400.0)
        overall = round(35.0 + participation * 40.0, 1)
        comm = round(3.0 + participation * 4.0, 1)
        tech = round(3.0 + participation * 4.0, 1)
        motiv = round(3.0 + participation * 3.5, 1)

        if ended_early:
            overall = max(25.0, overall - 10.0)

        rec = "maybe" if overall >= 55 else "no_hire"
        early_note = (
            " The interview was ended before the formal closing phase "
            "(candidate left or ended the session early)."
        ) if ended_early else ""

        excerpt = "\n".join(
            f"CANDIDATE: {(m.content or '')[:200]}"
            for m in substantive[-3:]
        )

        return {
            "overall_score": overall,
            "communication_score": comm,
            "technical_score": tech,
            "motivation_score": motiv,
            "recommendation": rec,
            "strengths": [
                f"Completed {n_substantive} substantive answer turn(s) before the session ended."
            ],
            "weaknesses": [
                "Limited interview depth — full technical and behavioral phases were not completed."
            ]
            if ended_early
            else ["Interview transcript may be incomplete for full evaluation."],
            "technical_competencies": [],
            "soft_skills": {
                "communication": "medium" if comm >= 5 else "weak",
                "teamwork": "medium",
                "problem_solving": "medium" if tech >= 5 else "weak",
            },
            "red_flags": ["Interview ended early; scores are based on partial transcript only."]
            if ended_early
            else [],
            "follow_up_questions": [
                "Complete remaining interview phases in a follow-up session."
            ],
            "summary": (
                f"Partial AI interview evaluation based on {n_substantive} candidate turn(s) "
                f"({total_chars} characters of responses).{early_note} "
                f"Latest responses:\n{excerpt}"
            )[:2000],
        }

    def _save_report(
        self,
        db: Session,
        interview: Interview,
        interview_id: str,
        report_data: Dict,
    ) -> Dict:
        report = InterviewReport(
            interview_id=interview_id,
            overall_score=float(report_data.get("overall_score", 50)),
            communication_score=float(report_data.get("communication_score", 5)),
            technical_score=float(report_data.get("technical_score", 5)),
            motivation_score=float(report_data.get("motivation_score", 5)),
            recommendation=InterviewRecommendation(
                report_data.get("recommendation", "maybe")
            ),
            strengths=report_data.get("strengths", []),
            weaknesses=report_data.get("weaknesses", []),
            technical_competencies=report_data.get("technical_competencies", []),
            soft_skills=report_data.get("soft_skills", {}),
            red_flags=report_data.get("red_flags", []),
            follow_up_questions=report_data.get("follow_up_questions", []),
            summary=report_data.get("summary", ""),
        )
        db.add(report)
        db.commit()

        job_id = interview.job_id

        def _refresh_rag_index() -> None:
            try:
                from services.rag_service import get_rag_service

                get_rag_service().refresh_vector_store(job_id)
            except Exception as rag_exc:
                logger.warning(
                    "Could not refresh RAG index for job %s: %s",
                    job_id,
                    rag_exc,
                )

        threading.Thread(target=_refresh_rag_index, daemon=True).start()

        logger.info(
            "Saved interview report for %s: %s",
            interview_id,
            report_data.get("recommendation"),
        )
        return report_data

    def generate_report(
        self,
        db: Session,
        interview_id: str,
        *,
        force: bool = False,
        ended_early: bool = False,
    ) -> Dict:
        """
        Generate AI evaluation report after interview completes (including early exit).
        """
        try:
            interview = db.query(Interview).filter(Interview.interview_id == interview_id).first()
            if not interview:
                raise ValueError(f"Interview not found: {interview_id}")

            session = interview.session_state or {}
            if session.get("ended_early"):
                ended_early = True

            existing = db.query(InterviewReport).filter(
                InterviewReport.interview_id == interview_id
            ).first()
            if existing and not force:
                return {
                    "overall_score": existing.overall_score,
                    "recommendation": existing.recommendation.value
                    if hasattr(existing.recommendation, "value")
                    else existing.recommendation,
                }
            if existing and force:
                db.delete(existing)
                db.commit()
            
            # Collect all messages
            messages = db.query(InterviewMessage).filter(
                InterviewMessage.interview_id == interview_id
            ).order_by(InterviewMessage.turn_number).all()
            
            conversation_text = "\n".join([
                f"{m.role.upper()}: {m.content}"
                for m in messages
            ])

            if not conversation_text.strip():
                return self._generate_fallback_report(
                    db, interview_id, ended_early=ended_early
                )
            hr_notes = [
                m.signals.get("internal_note")
                for m in messages
                if isinstance(m.signals, dict) and m.signals.get("internal_note")
            ]
            notes_block = ""
            if hr_notes:
                notes_block = "\n\nRecruiter internal notes (bot turns):\n" + "\n".join(
                    f"- {n}" for n in hr_notes
                )

            mismatch_turns = int(session.get("language_mismatch_count", 0))
            language_note = ""
            if mismatch_turns > 0:
                language_note = (
                    f"\n\nLANGUAGE COMPLIANCE: The candidate answered in the wrong language "
                    f"on {mismatch_turns} turn(s) despite warnings. Factor this into communication "
                    f"and overall scores (lower rating expected)."
                )

            early_note = ""
            if ended_early:
                early_note = (
                    "\n\nIMPORTANT: The candidate ended or left the interview before the formal "
                    "closing phase. Evaluate only the partial transcript available; note incomplete "
                    "coverage of technical/behavioral sections in weaknesses."
                )
            
            # Generate comprehensive report using Groq LLM (enhanced with bot_rh_final_v2 format)
            system_prompt = """You are an experienced senior recruiter. Analyze this interview and produce a detailed evaluation report.
Write the report in English only, regardless of the interview language.
Respond ONLY with valid JSON (no markdown, no code fences)."""
            
            ctx = self._load_interview_context(db, interview)
            job_block = f"""
Job criteria ({ctx['position']}):
{ctx['job_description']}

Candidate CV summary:
{ctx['cv_summary']}
"""

            report_prompt = f"""Analyze this interview against the job criteria and the candidate CV profile.
Evaluate interview performance against the requirements (skills, experience, soft skills, languages, certifications).
{job_block}

Interview transcript:
{conversation_text}{notes_block}{language_note}{early_note}

Return a JSON object with this exact structure:
{{
    "overall_score": 0-100,
    "communication_score": 0-10,
    "technical_score": 0-10,
    "motivation_score": 0-10,
    "recommendation": "strong_hire|hire|maybe|no_hire",
    "strengths": ["strength 1", "strength 2", ...],
    "weaknesses": ["weakness 1", "weakness 2", ...],
    "technical_competencies": ["technical competency 1", "technical competency 2", ...],
    "soft_skills": {{"communication": "good/medium/weak", "teamwork": "good/medium/weak", "problem_solving": "good/medium/weak"}},
    "red_flags": ["red flag 1", ...] or [],
    "follow_up_questions": ["recommended follow-up question 1", ...],
    "summary": "a 4-5 sentence summary of the candidate's overall evaluation in English"
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

            penalty = language_score_penalty(mismatch_turns)
            if penalty > 0:
                report_data["overall_score"] = max(
                    0.0,
                    float(report_data.get("overall_score", 50)) - penalty,
                )
                comm = float(report_data.get("communication_score", 5))
                report_data["communication_score"] = max(
                    0.0, comm - min(3.0, mismatch_turns * 0.75)
                )
                summary_extra = language_penalty_summary(mismatch_turns, penalty)
                report_data["red_flags"] = list(report_data.get("red_flags") or [])
                if summary_extra:
                    report_data["red_flags"].append(summary_extra)
                weaknesses = list(report_data.get("weaknesses") or [])
                weaknesses.append(
                    "Did not consistently answer in the selected interview language."
                )
                report_data["weaknesses"] = weaknesses
            
            if ended_early:
                weaknesses = list(report_data.get("weaknesses") or [])
                weaknesses.append(
                    "Interview ended before the formal closing phase; evaluation is based on a partial session."
                )
                report_data["weaknesses"] = weaknesses

            return self._save_report(db, interview, interview_id, report_data)
        
        except Exception as e:
            logger.error(
                "Error generating report for %s, using fallback: %s",
                interview_id,
                e,
            )
            return self._generate_fallback_report(
                db, interview_id, ended_early=ended_early
            )
    
    def _load_interview_context(self, db: Session, interview: Interview) -> Dict[str, str]:
        """Load candidate name, CV summary, and job description for the prompt."""
        candidate = db.query(Candidate).filter(
            Candidate.candidate_id == interview.candidate_id
        ).first()
        user = None
        if candidate:
            user = db.query(User).filter(User.user_id == candidate.user_id).first()

        candidate_name = "Candidat"
        if user:
            candidate_name = f"{user.first_name} {user.last_name}".strip() or candidate_name

        job = db.query(JobOffer).filter(JobOffer.job_id == interview.job_id).first()
        position = job.title if job else "Poste ouvert"
        job_description = self._build_job_description_text(job)
        cv_summary = self._build_cv_summary(db, interview.candidate_id, candidate)

        return {
            "candidate_name": candidate_name,
            "position": position,
            "cv_summary": cv_summary,
            "job_description": job_description,
        }

    def _build_job_description_text(self, job: Optional[JobOffer]) -> str:
        if not job:
            return "Description non disponible."
        from services.job_requirements import build_job_requirements

        parts = []
        if job.description:
            parts.append(f"Description : {job.description}")
        if job.requirements:
            parts.append(f"Exigences : {job.requirements}")
        if job.required_skills:
            parts.append(f"Compétences techniques : {job.required_skills}")
        if job.experience_years is not None:
            parts.append(f"Expérience : {job.experience_years} ans")
        if job.experience_level:
            level = job.experience_level.value if hasattr(job.experience_level, "value") else job.experience_level
            parts.append(f"Niveau : {level}")
        if job.education_level:
            parts.append(f"Formation : {job.education_level}")
        req = build_job_requirements(job)
        langs = [l.get("language") for l in req.get("languages", []) if l.get("language")]
        if langs:
            parts.append(f"Langues : {', '.join(langs)}")
        soft = req.get("soft_skills", {}).get("required", [])
        if soft:
            parts.append(f"Soft skills : {', '.join(soft)}")
        certs = req.get("certifications", {}).get("required", [])
        if certs:
            parts.append(f"Certifications : {', '.join(certs)}")
        text = "\n".join(p.strip() for p in parts if p and str(p).strip())
        return text[:3000] if text else "Description non disponible."

    def _build_cv_summary(
        self, db: Session, candidate_id: str, candidate: Optional[Candidate]
    ) -> str:
        """Use profile skills from signup — avoid OCR on interview start (very slow)."""
        skills = (candidate.skills if candidate else None) or ""
        if not skills.strip():
            return "CV profile not available. Declared skills: not provided."

        user = None
        if candidate:
            user = db.query(User).filter(User.user_id == candidate.user_id).first()

        lines: List[str] = []
        if user:
            name = f"{user.first_name} {user.last_name}".strip()
            if name:
                lines.append(f"Candidate: {name}")
        lines.append(f"Declared skills: {skills}")
        return "\n".join(lines)[:1500]

    def _get_system_prompt(
        self,
        language: str,
        phase: InterviewPhase,
        context: Dict[str, str],
        turn_count: int = 0,
        turns_in_phase: int = 0,
        last_signals: dict = None,
        anomaly_alerts: list = None,
    ) -> str:
        """Merged template: user SYSTEM_TEMPLATE + current Layla/phase/think UX."""
        lang_label = "français" if language == "fr" else "English"
        agent_name = "Layla" if language == "fr" else "Layla"
        signals_payload = dict(last_signals or {})
        signals_payload.pop("anomaly_alerts", None)
        signals_str = json.dumps(signals_payload, ensure_ascii=False)
        anomaly_block = format_anomaly_block(anomaly_alerts or [], language)

        position = context.get("position", "Poste ouvert")
        phase_focus = {
            InterviewPhase.INTRO: (
                "Présentation, parcours et expériences passées (équivalent intro + experience). "
                "Pose des questions ouvertes liées au CV et à la motivation initiale."
            ),
            InterviewPhase.TECHNICAL: (
                "Compétences techniques et réalisations concrètes pour le poste. "
                "Appuie-toi sur le CV et l'offre."
            ),
            InterviewPhase.BEHAVIORAL: (
                "Motivation, comportement, travail d'équipe, gestion de conflits "
                "(équivalent motivation + behavioral)."
            ),
            InterviewPhase.CLOSING: (
                "Clôture : demande s'il reste une question courte, résume les prochaines étapes, "
                "remercie. Mets should_end à true."
            ),
        }

        return f"""Tu es {agent_name}, recruteuse RH expérimentée qui mène un entretien pour le poste de {position}.

Candidat : {context.get("candidate_name", "Candidat")}
CV résumé :
{context.get("cv_summary", "Non disponible")}

Offre :
{context.get("job_description", "Non disponible")}

Règles STRICTES :
0. ANTI-HALLUCINATION : n'invente JAMAIS de faits sur le candidat, l'entreprise, le salaire, les horaires, l'équipe, ni sur ce qu'il a dit s'il ne l'a pas dit. Base-toi UNIQUEMENT sur le CV, l'offre et l'historique de conversation ci-dessus. Si tu ne sais pas, dis que l'équipe RH communiquera plus tard.
1. Parle UNIQUEMENT en {lang_label}. Ne change JAMAIS de langue.
2. UNE SEULE question à la fois. Maximum 3 phrases dans le champ "reply".
3. Phases dans cet ordre (ne recule jamais) : intro → technical → behavioral → closing.
   - intro couvre aussi l'expérience professionnelle.
   - behavioral couvre aussi la motivation.
4. Phase actuelle : {phase.value} (tour global {turn_count}, {turns_in_phase} réponses candidat dans cette phase).
5. Passe à la phase suivante dans "next_phase" après 2-3 tours dans la phase actuelle.
6. En phase closing : remercie et mets "should_end": true.

7. Hors-sujet : recadre poliment vers le poste SANS répondre au hors-sujet.

8. Questions entreprise / salaire / conditions :
   - Aucun détail inventé.
   - Réponds : "Ces informations vous seront communiquées à l'étape suivante du processus par l'équipe RH. Pour l'instant, concentrons-nous sur votre candidature."
   - Enchaîne immédiatement avec ta question.

9. Candidat non coopératif :
   - Reste professionnelle, ferme mais respectueuse.
   - 1er refus : "Je comprends, mais cet entretien suit une structure définie. Si vous ne souhaitez pas continuer, merci de me l'indiquer clairement."
   - 2e refus clair : should_end=true et internal_note="Candidat non coopératif".

10. Signaux techniques (JSON) : {signals_str}

11. Anomalie technique éventuelle (max 1) : {anomaly_block}
    - Si "(aucune)" : ne mentionne AUCUN stress, micro, caméra, tension ni problème technique — interdit d'inventer.
    - Si une anomalie est listée : UNE seule phrase courte optionnelle avant ta question, puis ta question. Jamais accusateur.
    - Détail technique uniquement dans "internal_note", pas dans "reply" sauf l'anomalie listée.

12. Langue : le candidat doit répondre en {lang_label} uniquement. Si la transcription est clairement dans une autre langue, le système envoie déjà un rappel automatique — ne répète pas inutilement.

Focus phase {phase.value} :
{phase_focus.get(phase, phase_focus[InterviewPhase.INTRO])}

FORMAT — retourne UNIQUEMENT un JSON valide, sans markdown :
{{"reply": "texte parlé au candidat (sans phrase de réflexion 10s)", "next_phase": "intro|technical|behavioral|closing", "internal_note": "notes RH courtes ou vide", "should_end": false}}

Contraintes reply :
- Une seule question claire (sauf closing).
- Ne pas inclure la phrase des 10 secondes de réflexion (ajoutée automatiquement par le système).
- Personnalise avec le CV et l'offre quand pertinent."""

    def _parse_bot_json(self, raw: str, language: str) -> Dict:
        fallback_reply = raw.strip() or (
            "Pouvez-vous développer votre réponse ?"
            if language == "fr"
            else "Could you elaborate on your answer?"
        )
        default = {
            "reply": fallback_reply,
            "next_phase": None,
            "internal_note": "",
            "should_end": False,
        }
        try:
            text = re.sub(r"```json\s*|\s*```", "", raw.strip())
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if not match:
                return default
            data = json.loads(match.group())
            reply = (data.get("reply") or fallback_reply).strip()
            return {
                "reply": reply,
                "next_phase": data.get("next_phase"),
                "internal_note": (data.get("internal_note") or "").strip(),
                "should_end": bool(data.get("should_end", False)),
            }
        except (json.JSONDecodeError, TypeError) as exc:
            logger.warning("Bot JSON parse failed, using raw text: %s", exc)
            return default

    def _generate_bot_turn(
        self, system_prompt: str, conversation_history: list, language: str
    ) -> Dict:
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(conversation_history[-12:])
        response = self.groq.chat.completions.create(
            model=settings.GROQ_LLM_MODEL,
            messages=messages,
            temperature=0.35,
            max_tokens=450,
        )
        raw = response.choices[0].message.content.strip()
        return self._parse_bot_json(raw, language)

    def _append_think_phrase(
        self, reply: str, language: str, phase: InterviewPhase
    ) -> str:
        if phase in (InterviewPhase.CLOSING, InterviewPhase.DONE):
            return reply.strip()
        phrase = THINK_PHRASE.get(language, THINK_PHRASE["en"])
        if phrase.lower() in reply.lower():
            return reply.strip()
        return f"{reply.rstrip()} {phrase}"

    def _normalize_phase(self, phase_value: str) -> Optional[InterviewPhase]:
        if not phase_value:
            return None
        key = str(phase_value).strip().lower()
        return PHASE_ALIASES.get(key)

    def _apply_suggested_phase(
        self, current: InterviewPhase, suggested: str
    ) -> InterviewPhase:
        target = self._normalize_phase(suggested)
        if not target or target == InterviewPhase.DONE:
            return current
        try:
            cur_idx = PHASE_SEQUENCE.index(current)
            new_idx = PHASE_SEQUENCE.index(target)
        except ValueError:
            return current
        if new_idx > cur_idx:
            return target
        return current

    def _advance_phase(self, current: InterviewPhase) -> InterviewPhase:
        try:
            idx = PHASE_SEQUENCE.index(current)
            if idx < len(PHASE_SEQUENCE) - 1:
                return PHASE_SEQUENCE[idx + 1]
        except ValueError:
            pass
        return current

    def _generate_closing_response(self, system_prompt: str, language: str) -> str:
        """
        Generate closing message.
        """
        closing_message = {
            "fr": "Merci beaucoup d'avoir participé à cet entretien! Nous vous recontacterons très bientôt avec les résultats. Bonne journée!",
            "en": "Thank you so much for participating in this interview! We'll get back to you very soon with the results. Have a great day!"
        }
        return closing_message.get(language, closing_message["en"])


# Singleton instance
_interview_service = None


def get_interview_service() -> InterviewService:
    global _interview_service
    if _interview_service is None:
        _interview_service = InterviewService()
    return _interview_service
