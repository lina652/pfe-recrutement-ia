from sentence_transformers import SentenceTransformer
import numpy as np
from core.config import settings

class EmbeddingService:
    def __init__(self):
        self.model = SentenceTransformer(settings.EMBEDDING_MODEL)
    
    def create_embedding(self, text: str) -> list:
        """Crée un embedding pour un texte."""
        if not text or not text.strip():
            return [0.0] * settings.EMBEDDING_DIM
        return self.model.encode(text).tolist()
    
    def create_cv_embeddings(self, parsed_cv: dict) -> dict:
        """Crée les embeddings pour un CV."""
        
        # Skills embedding
        skills = (
            parsed_cv.get("skills", {}).get("technical", []) +
            parsed_cv.get("skills", {}).get("soft", [])
        )
        skills_text = " ".join(skills)
        languages_text = " ".join([l.get("language", "") for l in parsed_cv.get("languages", [])])
        
        # Full CV embedding
        full_parts = [
            parsed_cv.get("name", ""),
            skills_text,
            languages_text,
            " ".join([e.get("degree", "") + " " + e.get("field", "") 
                      for e in parsed_cv.get("education", [])]),
            " ".join([e.get("role", "") + " " + e.get("company", "") 
                      for e in parsed_cv.get("work_experience", [])])
        ]
        full_text = " ".join(filter(None, full_parts))
        
        return {
            "skills_embedding": self.create_embedding(skills_text),
            "full_cv_embedding": self.create_embedding(full_text)
        }
    
    def create_job_embedding(self, requirements: dict) -> list:
        """Crée un embedding pour les requirements d'un job."""
        
        parts = []
        
        skills = requirements.get("skills", {})
        parts.extend(skills.get("required", []))
        parts.extend(skills.get("preferred", []))
        
        edu = requirements.get("education", {})
        if edu.get("degree"):
            parts.append(edu["degree"])
        if edu.get("field"):
            parts.append(edu["field"])#domaine d etude
        
        exp = requirements.get("experience", {})
        parts.extend(exp.get("roles", []))#C'est le nom du poste que le recruteur
        
        return self.create_embedding(" ".join(parts))


# Singleton
embedding_service = EmbeddingService()