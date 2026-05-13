import json
from groq import Groq
from core.config import settings

class NERService:
    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY)
    
    def parse_cv(self, cv_text: str) -> dict:
        """Parse CV en JSON structuré."""
        
        system_prompt = """
        You are an expert HR Data Parser. Extract CV information into JSON:
        {
            "name": "",
            "contact": {"email": "", "phone": "", "location": "", "linkedin": "", "github": ""},
            "skills": {"technical": [], "soft": []},
            "languages": [{"language": "", "level": ""}],
            "education": [{"school": "", "degree": "", "field": "", "year": ""}],
            "work_experience": [{"company": "", "role": "", "duration": "", "description": ""}],
            "certifications": [],
            "projects": [{"name": "", "description": ""}]
        }
        Return ONLY valid JSON, no markdown.
        """
        
        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Parse this CV:\n\n{cv_text}"}
            ],
            temperature=0,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
    
    def parse_job(self, job_description: str) -> dict:
        """Parse une offre d'emploi en requirements structurés."""
        
        system_prompt = """
        Extract job requirements into JSON:
        {
            "title": "",
            "skills": {"required": [], "preferred": []},
            "education": {"degree": "", "field": ""},
            "experience": {"min_years": 0, "roles": []},
            "languages": [{"language": "", "level": ""}],
            "certifications": {"required": [], "preferred": []}
        }
        Return ONLY valid JSON.
        """
        
        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Parse this job:\n\n{job_description}"}
            ],
            temperature=0,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)


# Singleton
ner_service = NERService()