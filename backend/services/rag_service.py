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
            chunk_overlap=settings.RAG_CHUNK_OVERLAP
        )
        self.vector_stores = {}  # job_id -> Chroma vector store

    def _build_job_requirements(self, job) -> dict:
        required_skills = []
        if getattr(job, "required_skills", None):
            required_skills = [
                s.strip() for s in job.required_skills.split(",") if s.strip()
            ]

        return {
            "skills": {
                "required": required_skills,
                "preferred": []
            },
            "education": {
                "degree": getattr(job, "education_level", "") or ""
            },
            "experience": {
                "min_years": int(getattr(job, "experience_years", 0) or 0),
                "roles": []
            },
            "languages": []
        }

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
        from services.matching_service import matching_service

        parsed_cv = None
        try:
            parsed_cv = self._parse_candidate_cv(db, candidate.candidate_id)
        except Exception as parse_error:
            logger.warning(
                "Could not parse CV for candidate %s: %s",
                candidate.candidate_id,
                str(parse_error)
            )

        if not parsed_cv:
            parsed_cv = self._fallback_parsed_cv(candidate)

        job_requirements = self._build_job_requirements(job)
        return matching_service.match(parsed_cv, job_requirements)
    
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
            
            documents = []
            applications = db.query(Application).filter(
                Application.job_id == job_id
            ).all()
            
            for app in applications:
                # Only keep candidates who already completed the interview for this job
                interview = db.query(Interview).filter(
                    Interview.application_id == app.app_id,
                    Interview.status == InterviewStatus.COMPLETED
                ).order_by(Interview.completed_at.desc(), Interview.created_at.desc()).first()

                if not interview:
                    continue

                candidate = db.query(Candidate).filter(
                    Candidate.candidate_id == app.candidate_id
                ).first()
                
                if not candidate:
                    continue

                user = db.query(User).filter(
                    User.user_id == candidate.user_id
                ).first()

                full_name = "Unknown Candidate"
                email = "N/A"
                phone = candidate.phone or "N/A"
                if user:
                    full_name = f"{user.first_name} {user.last_name}".strip()
                    email = user.email

                # ========== NER RESULTS FROM CV ==========
                ner_data = None
                cv = db.query(CVVersion).filter(
                    CVVersion.candidate_id == candidate.candidate_id,
                    CVVersion.is_active == True
                ).order_by(CVVersion.version_number.desc()).first()
                
                if cv and cv.file_path and os.path.exists(cv.file_path):
                    try:
                        cv_text = ocr_service.extract_text(cv.file_path)
                        if cv_text and len(cv_text.strip()) >= 30:
                            ner_data = ner_service.parse_cv(cv_text)
                    except Exception as ner_error:
                        logger.warning(f"Could not extract NER data for candidate {candidate.candidate_id}: {ner_error}")

                # Build NER section
                ner_section = "NER EXTRACTION FROM CV:\n"
                if ner_data:
                    # Extract structured info from NER
                    contact = ner_data.get("contact", {}) if isinstance(ner_data, dict) else {}
                    skills_obj = ner_data.get("skills", {}) if isinstance(ner_data, dict) else {}
                    education = ner_data.get("education", []) if isinstance(ner_data, dict) else []
                    experience = ner_data.get("work_experience", []) if isinstance(ner_data, dict) else []
                    languages = ner_data.get("languages", []) if isinstance(ner_data, dict) else []
                    certifications = ner_data.get("certifications", []) if isinstance(ner_data, dict) else []
                    
                    technical_skills = skills_obj.get("technical", []) if isinstance(skills_obj, dict) else []
                    soft_skills = skills_obj.get("soft", []) if isinstance(skills_obj, dict) else []
                    
                    ner_section += f"- NER Name: {ner_data.get('name', 'N/A')}\n"
                    ner_section += f"- NER Email: {contact.get('email', 'N/A')}\n"
                    ner_section += f"- NER Phone: {contact.get('phone', 'N/A')}\n"
                    ner_section += f"- Technical Skills: {', '.join(technical_skills) if technical_skills else 'N/A'}\n"
                    ner_section += f"- Soft Skills: {', '.join(soft_skills) if soft_skills else 'N/A'}\n"
                    ner_section += f"- Languages: {', '.join([l.get('language', str(l)) if isinstance(l, dict) else str(l) for l in languages]) if languages else 'N/A'}\n"
                    ner_section += f"- Education: {len(education)} entries\n"
                    for i, edu in enumerate(education[:3], 1):
                        if isinstance(edu, dict):
                            ner_section += f"  {i}. {edu.get('degree', 'N/A')} - {edu.get('institution', 'N/A')} ({edu.get('year', 'N/A')})\n"
                    ner_section += f"- Work Experience: {len(experience)} entries\n"
                    for i, exp in enumerate(experience[:3], 1):
                        if isinstance(exp, dict):
                            ner_section += f"  {i}. {exp.get('title', 'N/A')} at {exp.get('company', 'N/A')} ({exp.get('duration', 'N/A')})\n"
                    ner_section += f"- Certifications: {', '.join([c.get('name', str(c)) if isinstance(c, dict) else str(c) for c in certifications]) if certifications else 'N/A'}\n"
                else:
                    ner_section += "- CV not available or could not be parsed\n"

                # ========== SEMANTIC MATCHING RESULTS ==========
                semantic_result = self._compute_semantic_matching(db, candidate, job)
                category_scores = semantic_result.get("category_scores", {})
                details = semantic_result.get("details", {})
                
                # Construire le document du candidat
                candidate_text = f"""
CANDIDAT: {full_name}
EMAIL: {email}
TÉLÉPHONE: {phone}
COMPÉTENCES (PROFIL): {candidate.skills or 'N/A'}

{ner_section}
STATUT CANDIDATURE: {app.status.value if hasattr(app.status, 'value') else app.status}
SCORE FINAL APPLICATION: {app.final_score or 'N/A'}
AI RECOMMENDATION APPLICATION: {app.ai_recommendation or 'N/A'}
DATE SOUMISSION: {app.submission_date}

SEMANTIC MATCHING:
- overall_score: {semantic_result.get('overall_score', 'N/A')}
- match_percentage: {semantic_result.get('match_percentage', 'N/A')}%
- classification: {semantic_result.get('classification', 'N/A')}
- recommendation: {semantic_result.get('recommendation', 'N/A')}
- category_scores: {category_scores}
- matching_details: {details}
"""

                # ========== INTERVIEW RESULTS ==========
                candidate_text += f"\nSTATUT ENTRETIEN: {interview.status.value if hasattr(interview.status, 'value') else interview.status}\n"

                # Ajouter le rapport d'entretien si disponible
                report = db.query(InterviewReport).filter(
                    InterviewReport.interview_id == interview.interview_id
                ).first()

                if report:
                    candidate_text += f"""
INTERVIEW RESULTS:
- SCORE ENTRETIEN: {report.overall_score}/100
- COMMUNICATION: {report.communication_score}/10
- TECHNIQUE: {report.technical_score}/10
- MOTIVATION: {report.motivation_score}/10
- RECOMMANDATION: {report.recommendation.value if hasattr(report.recommendation, 'value') else report.recommendation}
- POINTS FORTS: {', '.join(report.strengths) if report.strengths else 'N/A'}
- POINTS FAIBLES: {', '.join(report.weaknesses) if report.weaknesses else 'N/A'}
- SUMMARY: {report.summary or 'N/A'}
"""
                
                doc = Document(
                    page_content=candidate_text,
                    metadata={
                        "candidate_id": app.candidate_id,
                        "app_id": app.app_id,
                        "job_id": job_id,
                        "candidate_name": full_name,
                        "semantic_score": semantic_result.get('overall_score', 0),
                        "interview_score": report.overall_score if report else 0,
                        "classification": semantic_result.get('classification', 'N/A')
                    }
                )
                documents.append(doc)
            
            logger.info(f"Built {len(documents)} documents for job {job_id} with NER, semantic matching, and interview data")
            return documents
        
        except Exception as e:
            logger.error(f"Error building documents for job {job_id}: {str(e)}")
            return []
    
    def get_or_build_vector_store(self, db: Session, job_id: str) -> Optional[Chroma]:
        """
        Récupère ou crée le vectorstore pour les candidats d'un job.
        """
        try:
            if job_id in self.vector_stores:
                return self.vector_stores[job_id]
            
            documents = self.build_documents(db, job_id)
            if not documents:
                logger.warning(f"No documents for job {job_id}")
                return None
            
            chunks = self.text_splitter.split_documents(documents)
            
            collection_name = f"{settings.RAG_COLLECTION_PREFIX}_{job_id}"
            vector_store = Chroma.from_documents(
                documents=chunks,
                embedding=self.embedding_model,
                collection_name=collection_name
            )
            
            self.vector_stores[job_id] = vector_store
            logger.info(f"Created vector store for job {job_id} with {len(chunks)} chunks")
            return vector_store
        
        except Exception as e:
            logger.error(f"Error building vector store for job {job_id}: {str(e)}")
            return None
    
    def chat(self, db: Session, job_id: str, question: str) -> str:
        """
        Répond à une question du recruteur sur les candidats via RAG.
        
        Args:
            db: Session de base de données
            job_id: ID du job
            question: Question du recruteur
        
        Returns:
            Réponse générée par l'IA
        """
        try:
            vector_store = self.get_or_build_vector_store(db, job_id)
            if not vector_store:
                return "Aucune donnée de candidat disponible pour ce poste."
            
            # Récupérer les documents pertinents
            retriever = vector_store.as_retriever(search_kwargs={"k": 5})
            docs = retriever.invoke(question)
            context = "\n\n---\n\n".join([doc.page_content for doc in docs])
            
            # Créer le prompt
            prompt = f"""Tu es un expert RH qui aide à analyser les candidats.
Utilise les informations fournies pour répondre à la question. Sois précis et basé sur les données.
Si tu n'as pas assez d'informations, dis-le clairement.

RÈGLES:
1. Utilise les DONNÉES RÉELLES des documents
2. Crée des TABLEAUX pour les comparaisons
3. Mentionne les SCORES et CHIFFRES
4. Signale les RED FLAGS
5. Donne des RECOMMANDATIONS

Contexte:
{context}

Question: {question}

Réponse:"""
            
            # Appeler le LLM directement (sans RetrievalQA obsolète)
            response = self.llm.invoke(prompt)
            
            logger.info(f"RAG query answered for job {job_id}: {question[:50]}...")
            return response.content
        
        except Exception as e:
            logger.error(f"Error in RAG chat for job {job_id}: {str(e)}")
            return f"Erreur lors de l'analyse des candidats: {str(e)}"
    
    def refresh_vector_store(self, job_id: str) -> None:
        """
        Force la reconstruction du vectorstore pour un job.
        Utile après ajout de nouveaux candidats ou entretiens.
        """
        if job_id in self.vector_stores:
            del self.vector_stores[job_id]
            logger.info(f"Vector store refreshed for job {job_id}")
    
    def suggest_questions(self, language: str = "fr") -> List[str]:
        """
        Fournit des suggestions de questions pour les recruteurs.
        """
        questions_fr = [
            "Qui sont les 3 meilleurs candidats pour ce poste?",
            "Quels sont les points forts communs des candidats?",
            "Quels candidats présentent des signaux d'alerte (red flags)?",
            "Compare les compétences techniques des meilleurs candidats",
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