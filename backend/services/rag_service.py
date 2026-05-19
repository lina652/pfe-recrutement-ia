"""
RAG Service pour la plateforme de recrutement - VERSION CORRIGÉE
"""
import logging
import os
from typing import List, Optional
from sqlalchemy.orm import Session
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate

from core.config import settings

logger = logging.getLogger(__name__)


class RAGService:
    """
    Service RAG pour analyser les candidats via questions du recruteur.
    """
    
    def __init__(self):
        self.embedding_model = HuggingFaceEmbeddings(
            model_name=settings.EMBEDDING_MODEL
        )
        self.llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model=settings.GROQ_LLM_MODEL,
            temperature=0.3,
            max_tokens=2048
        )
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.RAG_CHUNK_SIZE,
            chunk_overlap=settings.RAG_CHUNK_OVERLAP,
            separators=["\n\nCANDIDATE:", "\n\n---\n\n", "\n\n", "\n", " "],
        )
        self.vector_stores = {}  # job_id -> Chroma vector store
        self._chunk_cache = {}  # job_id -> last built chunks
        self._full_context_candidate_limit = 20

    def _fallback_parsed_cv(self, candidate) -> dict:
        raw_skills = (candidate.skills or "")
        skills = [s.strip() for s in raw_skills.split(",") if s.strip()]
        return {
            "name": "",
            "contact": {},
            "skills": {
                "technical": skills,
                "soft": []
            },
            "languages": [],
            "education": [],
            "work_experience": [],
            "certifications": [],
            "projects": []
        }

    def _parse_candidate_cv(self, db: Session, candidate_id: str):
        from models.cv_version import CVVersion
        from services.ocr_service import ocr_service
        from services.ner_service import ner_service

        cv = db.query(CVVersion).filter(
            CVVersion.candidate_id == candidate_id,
            CVVersion.is_active == True
        ).order_by(
            CVVersion.version_number.desc(),
            CVVersion.uploaded_at.desc()
        ).first()

        if not cv or not cv.file_path:
            return None

        if not os.path.exists(cv.file_path):
            return None

        cv_text = ocr_service.extract_text(cv.file_path)
        if not cv_text or len(cv_text.strip()) < 30:
            return None

        return ner_service.parse_cv(cv_text)

    def _compute_semantic_matching(self, db: Session, candidate, job) -> dict:
        from services.cv_job_matching import match_candidate_to_job

        return match_candidate_to_job(db, candidate, job)

    def _interview_transcript_excerpt(
        self, db: Session, interview, max_lines: int = 12
    ) -> str:
        from models.interview import InterviewMessage

        messages = (
            db.query(InterviewMessage)
            .filter(InterviewMessage.interview_id == interview.interview_id)
            .order_by(InterviewMessage.turn_number)
            .all()
        )
        if not messages:
            return ""
        tail = messages[-max_lines:]
        return "\n".join(
            f"  {m.role.upper()}: {(m.content or '')[:280]}"
            for m in tail
        )

    def _format_interview_section(self, db: Session, app, interview) -> str:
        from models.interview import InterviewReport, InterviewStatus

        if not interview:
            return (
                "\nAI INTERVIEW BOT:\n"
                "- Status: not scheduled yet\n"
                "- Bot evaluation: pending (candidate has not completed an AI interview)\n"
            )

        status = (
            interview.status.value
            if hasattr(interview.status, "value")
            else str(interview.status)
        )
        phase = (
            interview.phase.value
            if hasattr(interview.phase, "value")
            else str(interview.phase)
        )
        session = interview.session_state or {}
        ended_early = bool(session.get("ended_early"))

        lines = [
            "\nAI INTERVIEW BOT:",
            f"- Interview status: {status}",
            f"- Phase: {phase}",
            f"- Turns completed: {interview.turn_count or 0}",
        ]
        if interview.scheduled_at:
            lines.append(f"- Scheduled day: {interview.scheduled_at}")
        if ended_early:
            lines.append(
                "- Session note: candidate ended or left before the formal closing phase"
            )

        report = (
            db.query(InterviewReport)
            .filter(InterviewReport.interview_id == interview.interview_id)
            .first()
        )

        if (
            not report
            and interview.status == InterviewStatus.COMPLETED
        ):
            try:
                from services.interview_service import get_interview_service

                get_interview_service()._generate_fallback_report(
                    db,
                    interview.interview_id,
                    ended_early=ended_early,
                )
                report = (
                    db.query(InterviewReport)
                    .filter(InterviewReport.interview_id == interview.interview_id)
                    .first()
                )
            except Exception as backfill_exc:
                logger.warning(
                    "RAG backfill report failed for interview %s: %s",
                    interview.interview_id,
                    backfill_exc,
                )

        if report:
            rec = report.recommendation
            if hasattr(rec, "value"):
                rec = rec.value
            lines.extend(
                [
                    "- Bot evaluation: available (includes partial/early-ended sessions)",
                    f"- Overall interview score: {report.overall_score}/100",
                    f"- Communication: {report.communication_score}/10",
                    f"- Technical: {report.technical_score}/10",
                    f"- Motivation: {report.motivation_score}/10",
                    f"- Recommendation: {rec}",
                    f"- Strengths: {', '.join(report.strengths) if report.strengths else 'N/A'}",
                    f"- Weaknesses: {', '.join(report.weaknesses) if report.weaknesses else 'N/A'}",
                    f"- Summary: {report.summary or 'N/A'}",
                ]
            )
            if report.red_flags:
                lines.append(f"- Red flags: {', '.join(report.red_flags)}")
            if report.technical_competencies:
                lines.append(
                    f"- Technical competencies: {', '.join(report.technical_competencies)}"
                )
            excerpt = self._interview_transcript_excerpt(db, interview)
            if excerpt:
                lines.append("- Transcript excerpt (latest turns):")
                lines.append(excerpt)
            return "\n".join(lines) + "\n"

        excerpt = self._interview_transcript_excerpt(db, interview)
        if interview.status == InterviewStatus.COMPLETED and excerpt:
            lines.append(
                "- Bot evaluation: interview ended but scored report unavailable; partial transcript:"
            )
            lines.append(excerpt)
            return "\n".join(lines) + "\n"

        if (interview.turn_count or 0) > 0 and excerpt:
            lines.append("- Bot evaluation: partial session in progress; transcript so far:")
            lines.append(excerpt)
            return "\n".join(lines) + "\n"

        if interview.status != InterviewStatus.COMPLETED:
            lines.append("- Bot evaluation: pending (interview not completed yet)")
        else:
            lines.append("- Bot evaluation: completed; no transcript or report available")
        return "\n".join(lines) + "\n"

    def build_documents(self, db: Session, job_id: str) -> List[Document]:
        """
        Construit les documents depuis la base de données pour un job spécifique.
        Includes: NER results, semantic matching results, and interview results.
        """
        try:
            from models.job_offer import JobOffer
            from models.application import Application
            from models.candidate import Candidate
            from models.interview import Interview, InterviewReport, InterviewStatus
            from models.user import User
            from models.cv_version import CVVersion
            from services.ocr_service import ocr_service
            from services.ner_service import ner_service
            
            job = db.query(JobOffer).filter(JobOffer.job_id == job_id).first()
            if not job:
                logger.warning(f"Job not found: {job_id}")
                return []

            from services.job_requirements import build_job_requirements

            job_req = build_job_requirements(job)
            documents = [
                Document(
                    page_content=f"""
JOB POSTING: {job.title}
Company: {getattr(job, 'company_name', 'N/A')}
Description: {getattr(job, 'description', '') or 'N/A'}
Requirements: {getattr(job, 'requirements', '') or 'N/A'}
Required skills: {', '.join(job_req.get('skills', {}).get('required', [])) or 'N/A'}
Experience (min years): {job_req.get('experience', {}).get('min_years', 0)}
Education: {job_req.get('education', {}).get('degree', 'N/A')}
""".strip(),
                    metadata={"job_id": job_id, "type": "job_requirements"},
                )
            ]

            applications = (
                db.query(Application)
                .filter(Application.job_id == job_id)
                .all()
            )

            for app in applications:
                try:
                    self._append_candidate_document(
                        db,
                        documents,
                        job,
                        job_id,
                        app,
                    )
                except Exception as app_exc:
                    logger.warning(
                        "RAG skipped application %s: %s", app.app_id, app_exc
                    )

            logger.info(
                "Built %d documents for job %s (%d applications)",
                len(documents),
                job_id,
                len(applications),
            )
            return documents

        except Exception as e:
            logger.error(f"Error building documents for job {job_id}: {str(e)}")
            return []

    def _append_candidate_document(
        self,
        db: Session,
        documents: List[Document],
        job,
        job_id: str,
        app,
    ) -> None:
        from models.application import Application
        from models.candidate import Candidate
        from models.interview import Interview, InterviewReport
        from models.user import User
        from models.cv_version import CVVersion
        from services.ocr_service import ocr_service
        from services.ner_service import ner_service

        interview = (
            db.query(Interview)
            .filter(Interview.application_id == app.app_id)
            .order_by(Interview.created_at.desc())
            .first()
        )

        candidate = (
            db.query(Candidate)
            .filter(Candidate.candidate_id == app.candidate_id)
            .first()
        )
        if not candidate:
            return

        user = db.query(User).filter(User.user_id == candidate.user_id).first()

        full_name = "Unknown Candidate"
        email = "N/A"
        phone = candidate.phone or "N/A"
        if user:
            full_name = f"{user.first_name} {user.last_name}".strip()
            email = user.email

        ner_data = None
        cv = (
            db.query(CVVersion)
            .filter(
                CVVersion.candidate_id == candidate.candidate_id,
                CVVersion.is_active == True,
            )
            .order_by(CVVersion.version_number.desc())
            .first()
        )

        if cv and cv.file_path and os.path.exists(cv.file_path):
            try:
                cv_text = ocr_service.extract_text(cv.file_path)
                if cv_text and len(cv_text.strip()) >= 30:
                    ner_data = ner_service.parse_cv(cv_text)
            except Exception as ner_error:
                logger.warning(
                    "Could not extract NER data for candidate %s: %s",
                    candidate.candidate_id,
                    ner_error,
                )

        ner_section = "NER EXTRACTION FROM CV:\n"
        if ner_data:
            contact = ner_data.get("contact", {}) if isinstance(ner_data, dict) else {}
            skills_obj = ner_data.get("skills", {}) if isinstance(ner_data, dict) else {}
            education = ner_data.get("education", []) if isinstance(ner_data, dict) else []
            experience = (
                ner_data.get("work_experience", []) if isinstance(ner_data, dict) else []
            )
            languages = ner_data.get("languages", []) if isinstance(ner_data, dict) else []
            certifications = (
                ner_data.get("certifications", []) if isinstance(ner_data, dict) else []
            )
            technical_skills = (
                skills_obj.get("technical", []) if isinstance(skills_obj, dict) else []
            )
            soft_skills = skills_obj.get("soft", []) if isinstance(skills_obj, dict) else []

            ner_section += f"- NER Name: {ner_data.get('name', 'N/A')}\n"
            ner_section += f"- NER Email: {contact.get('email', 'N/A')}\n"
            ner_section += f"- NER Phone: {contact.get('phone', 'N/A')}\n"
            ner_section += (
                f"- Technical Skills: {', '.join(technical_skills) if technical_skills else 'N/A'}\n"
            )
            ner_section += (
                f"- Soft Skills: {', '.join(soft_skills) if soft_skills else 'N/A'}\n"
            )
            ner_section += f"- Languages: {', '.join([l.get('language', str(l)) if isinstance(l, dict) else str(l) for l in languages]) if languages else 'N/A'}\n"
            ner_section += f"- Education: {len(education)} entries\n"
            for i, edu in enumerate(education[:3], 1):
                if isinstance(edu, dict):
                    ner_section += (
                        f"  {i}. {edu.get('degree', 'N/A')} - "
                        f"{edu.get('institution', 'N/A')} ({edu.get('year', 'N/A')})\n"
                    )
            ner_section += f"- Work Experience: {len(experience)} entries\n"
            for i, exp in enumerate(experience[:3], 1):
                if isinstance(exp, dict):
                    ner_section += (
                        f"  {i}. {exp.get('title', 'N/A')} at "
                        f"{exp.get('company', 'N/A')} ({exp.get('duration', 'N/A')})\n"
                    )
            ner_section += f"- Certifications: {', '.join([c.get('name', str(c)) if isinstance(c, dict) else str(c) for c in certifications]) if certifications else 'N/A'}\n"
        else:
            ner_section += "- CV not available or could not be parsed\n"

        from services.cv_job_matching import (
            cv_match_percentage,
            match_application,
            persist_application_match,
        )

        from models.job_offer import JobOffer

        match_job = job
        if app.job_id != job_id:
            match_job = (
                db.query(JobOffer).filter(JobOffer.job_id == app.job_id).first()
                or job
            )
        semantic_result, _ = match_application(db, app, match_job)
        persist_application_match(db, app, semantic_result)
        cv_match_pct = cv_match_percentage(semantic_result)
        category_scores = semantic_result.get("category_scores", {})
        details = semantic_result.get("details", {})

        report = None
        if interview:
            report = (
                db.query(InterviewReport)
                .filter(InterviewReport.interview_id == interview.interview_id)
                .first()
            )

        posting_note = ""
        if app.job_id != job_id:
            posting_note = (
                f"NOTE: Application is stored under a duplicate job posting "
                f"(same title). Application job_id: {app.job_id}\n"
            )

        candidate_text = f"""
CANDIDATE: {full_name}
EMAIL: {email}
PHONE: {phone}
PROFILE SKILLS: {candidate.skills or 'N/A'}
{posting_note}
{ner_section}
APPLICATION STATUS: {app.status.value if hasattr(app.status, 'value') else app.status}
APPLICATION CV MATCH SCORE: {cv_match_pct}%
APPLICATION AI NOTE: {app.ai_recommendation or 'N/A'}
SUBMITTED: {app.submission_date}

CV SEMANTIC MATCHING (vs job requirements):
- overall_score: {semantic_result.get('overall_score', 'N/A')}
- match_percentage: {semantic_result.get('match_percentage', 'N/A')}%
- classification: {semantic_result.get('classification', 'N/A')}
- recommendation: {semantic_result.get('recommendation', 'N/A')}
- category_scores: {category_scores}
- matching_details: {details}
{self._format_interview_section(db, app, interview)}
"""

        documents.append(
            Document(
                page_content=candidate_text.strip(),
                metadata={
                    "type": "candidate_profile",
                    "candidate_id": app.candidate_id,
                    "app_id": app.app_id,
                    "job_id": job_id,
                    "candidate_name": full_name,
                    "semantic_score": semantic_result.get("overall_score", 0),
                    "interview_score": float(report.overall_score or 0) if report else 0,
                    "classification": semantic_result.get("classification", "N/A"),
                },
            )
        )

    def _chunk_documents(self, documents: List[Document]) -> List[Document]:
        """Keep each candidate profile in as few chunks as possible."""
        chunks: List[Document] = []
        max_single = max(settings.RAG_CHUNK_SIZE, 3500)

        for doc in documents:
            if doc.metadata.get("type") == "candidate_profile":
                chunks.append(doc)
            elif len(doc.page_content) <= max_single:
                chunks.append(doc)
            else:
                chunks.extend(self.text_splitter.split_documents([doc]))

        return chunks

    def _documents_to_context(self, documents: List[Document]) -> str:
        return "\n\n---\n\n".join(doc.page_content for doc in documents)

    def _retrieve_context(
        self, vector_store: Chroma, question: str, chunks: List[Document]
    ) -> str:
        candidate_chunks = [
            c for c in chunks if c.metadata.get("type") == "candidate_profile"
        ]
        if not candidate_chunks:
            candidate_chunks = [
                c for c in chunks if "CANDIDATE:" in (c.page_content or "")
            ]
        if not candidate_chunks:
            return ""

        if len(candidate_chunks) <= self._full_context_candidate_limit:
            logger.info(
                "RAG using full candidate context (%d profiles)",
                len(candidate_chunks),
            )
            job_chunks = [c for c in chunks if c.metadata.get("type") == "job_requirements"]
            return self._documents_to_context(job_chunks + candidate_chunks)

        k = min(
            len(chunks),
            max(12, len(candidate_chunks) * 2),
        )
        retriever = vector_store.as_retriever(search_kwargs={"k": k})
        docs = retriever.invoke(question)
        logger.info("RAG retrieved %d chunks (k=%d) for question", len(docs), k)
        return self._documents_to_context(docs)

    def get_or_build_vector_store(
        self, db: Session, job_id: str, *, force_rebuild: bool = True
    ) -> tuple[Optional[Chroma], List[Document]]:
        """
        Build a fresh vector store and return (store, chunks).
        Rebuilds by default so interview/CV updates are always reflected.
        """
        try:
            if not force_rebuild and job_id in self.vector_stores:
                cached_chunks = self._chunk_cache.get(job_id)
                if cached_chunks is not None:
                    return self.vector_stores[job_id], cached_chunks

            documents = self.build_documents(db, job_id)
            if not documents:
                logger.warning("No documents for job %s", job_id)
                return None, []

            db.commit()

            chunks = self._chunk_documents(documents)
            if not chunks:
                return None, []

            collection_name = f"{settings.RAG_COLLECTION_PREFIX}_{job_id}"
            vector_store = Chroma.from_documents(
                documents=chunks,
                embedding=self.embedding_model,
                collection_name=collection_name,
            )

            self.vector_stores[job_id] = vector_store
            self._chunk_cache[job_id] = chunks
            logger.info(
                "RAG index for job %s: %d documents -> %d chunks",
                job_id,
                len(documents),
                len(chunks),
            )
            return vector_store, chunks

        except Exception as e:
            logger.error("Error building vector store for job %s: %s", job_id, e)
            return None, []

    def chat(self, db: Session, job_id: str, question: str, language: str = "en") -> str:
        """
        Answer a recruiter/manager question about candidates for a job via RAG.
        """
        try:
            self.refresh_vector_store(job_id)
            vector_store, chunks = self.get_or_build_vector_store(
                db, job_id, force_rebuild=True
            )
            if not vector_store or not chunks:
                from models.application import Application

                app_count = (
                    db.query(Application).filter(Application.job_id == job_id).count()
                )
                if app_count == 0:
                    return (
                        "No applications have been received for this role yet."
                        if language == "en"
                        else "Aucune candidature reçue pour ce poste."
                    )
                return (
                    "No candidate profiles could be indexed for this role. "
                    "Ensure candidates have applied and CV files are available."
                    if language == "en"
                    else "Aucun profil candidat n'a pu être indexé pour ce poste."
                )

            context = self._retrieve_context(vector_store, question, chunks)
            if not context.strip():
                return (
                    "No candidate profiles are indexed for this job yet. "
                    "Ensure candidates have applied and interviews are completed."
                    if language == "en"
                    else "Aucun profil candidat indexé pour ce poste pour le moment."
                )

            if language == "en":
                prompt = f"""You are an expert HR analyst helping compare candidates for a job opening.
Answer ONLY in English. Use ONLY the context below (job requirements, CV parsing, semantic CV matching, and AI interview bot results when present).

RULES:
1. Use real names, scores, and facts from the context — do not invent candidates.
2. For comparisons, use markdown tables when helpful.
3. Cite CV match scores and interview bot scores separately when both exist.
4. If interview bot results are "pending", say the AI interview is not finished yet.
5. If information is missing, say so clearly.

Context:
{context}

Question: {question}

Answer:"""
            else:
                prompt = f"""Tu es un expert RH. Réponds en français en t'appuyant uniquement sur le contexte (offre, CV, matching, entretien IA).

Contexte:
{context}

Question: {question}

Réponse:"""

            response = self.llm.invoke(prompt)

            logger.info(f"RAG query answered for job {job_id}: {question[:50]}...")
            return response.content

        except Exception as e:
            logger.error(f"Error in RAG chat for job {job_id}: {str(e)}")
            if language == "en":
                return f"Error while analyzing candidates: {str(e)}"
            return f"Erreur lors de l'analyse des candidats: {str(e)}"
    
    def refresh_vector_store(self, job_id: str) -> None:
        """Drop cached vector store so the next query rebuilds with fresh data."""
        self.vector_stores.pop(job_id, None)
        self._chunk_cache.pop(job_id, None)
        logger.info("Vector store cache cleared for job %s", job_id)
    
    def suggest_questions(self, language: str = "fr") -> List[str]:
        """
        Fournit des suggestions de questions pour les recruteurs.
        """
        questions_fr = [
            "Qui sont les 3 meilleurs candidats pour ce poste?",
            "Quels sont les points forts communs des candidats?",
            "Quels candidats présentent des signaux d'alerte (red flags)?",
            "Compare les compétences techniques des meilleurs candidats",
            "Donne-moi les scores d'entretien des candidats",
            "Qui s'adapterait le mieux à la culture de l'entreprise?",
            "Quelles lacunes en compétences avons-nous dans le pool?",
            "Classe les candidats par compétences en communication",
            "Quels candidats ont montré le plus de motivation?",
            "Compare les formations des candidats",
            "Qui a le plus d'expérience pertinente?"
        ]
        
        questions_en = [
            "Who are the top 3 candidates for this role?",
            "What are the common strengths across candidates?",
            "Which candidates have red flags or concerns?",
            "Compare the technical skills of the top candidates",
            "Give me the interview scores for the candidates",
            "Who would be the best culture fit?",
            "What skills gaps do we have in the candidate pool?",
            "Rank candidates by communication skills",
            "Which candidates showed the most motivation?",
            "Compare the education of candidates",
            "Who has the most relevant experience?"
        ]
        
        return questions_fr if language == "fr" else questions_en


# Singleton instance
_rag_service = None


def get_rag_service() -> RAGService:
    """Retourne l'instance singleton du service RAG."""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service