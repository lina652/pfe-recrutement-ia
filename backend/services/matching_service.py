from sentence_transformers import SentenceTransformer, util
import re
from core.config import settings

class MatchingService:
    def __init__(self):
        self.model = SentenceTransformer(settings.EMBEDDING_MODEL)
    
    def match(self, parsed_cv: dict, job_requirements: dict) -> dict:
        """Match un CV contre les requirements d'un job."""
        
        results = {
            "overall_score": 0.0,
            "match_percentage": 0.0,
            "category_scores": {}, # the score of skills , education ...
            "details": {}, # missing , matched ...
            "classification": "",#TOP", "MEDIUM", ou "LOW"
            "recommendation": ""#Une phrase avec un émoji (ex: "🟢 Excellent - Entretien recommandé").
        }
        
        weights = {
            "skills": 2.0,
            "education": 1.5,
            "experience": 1.5,
            "languages": 1.0,
            "soft_skills": 1.5,
            "certifications": 1.0,
            "profile_fit": 1.5,
        }
        
        total_weight = 0
        weighted_score = 0
        
        for category, weight in weights.items():
            if category not in job_requirements:
                continue
            
            cv_data = self._extract_cv_data(parsed_cv, category)
            requirement = job_requirements.get(category, {})
            
            if not requirement:
                continue
            
            score, details = self._match_category(category, cv_data, requirement)
            
            results["category_scores"][category] = {
                "score": round(score, 3),
                "weight": weight
            }
            results["details"][category] = details
            
            weighted_score += score * weight
            total_weight += weight
        
        if total_weight > 0:
            results["overall_score"] = round(weighted_score / total_weight, 3)
            results["match_percentage"] = round(results["overall_score"] * 100, 1)
        
        # Classification
        if results["overall_score"] >= 0.75:
            results["classification"] = "TOP"
            results["recommendation"] = "🟢 Excellent - Entretien recommandé"
        elif results["overall_score"] >= 0.50:
            results["classification"] = "MEDIUM"
            results["recommendation"] = "🟡 Bon - Profil intéressant"
        else:
            results["classification"] = "LOW"
            results["recommendation"] = "🔴 Faible - Ne correspond pas"
        
        return results
    
    def _extract_cv_data(self, parsed_cv: dict, category: str):
        mapping = {
            "skills": lambda cv: cv.get("skills", {}).get("technical", []) + cv.get("skills", {}).get("soft", []),
            "education": lambda cv: cv.get("education", []),
            "experience": lambda cv: cv.get("work_experience", []),
            "languages": lambda cv: cv.get("languages", []),
            "soft_skills": lambda cv: cv.get("skills", {}).get("soft", []) + cv.get("skills", {}).get("technical", []),
            "certifications": lambda cv: self._normalize_cert_list(cv.get("certifications", [])),
            "profile_fit": lambda cv: self._cv_profile_text(cv),
        }
        return mapping.get(category, lambda cv: None)(parsed_cv)

    def _normalize_cert_list(self, certs: list) -> list:
        names = []
        for item in certs or []:
            if isinstance(item, str):
                names.append(item)
            elif isinstance(item, dict) and item.get("name"):
                names.append(str(item["name"]))
        return names

    def _cv_profile_text(self, parsed_cv: dict) -> str:
        parts = []
        tech = parsed_cv.get("skills", {}).get("technical", [])
        soft = parsed_cv.get("skills", {}).get("soft", [])
        if tech:
            parts.append("Skills: " + ", ".join(tech))
        if soft:
            parts.append("Soft skills: " + ", ".join(soft))
        for edu in parsed_cv.get("education", []) or []:
            degree = edu.get("degree") or edu.get("field") or ""
            if degree:
                parts.append(degree)
        for exp in parsed_cv.get("work_experience", []) or []:
            title = exp.get("title") or exp.get("role") or ""
            company = exp.get("company") or ""
            if title:
                parts.append(f"{title} at {company}".strip())
        for cert in parsed_cv.get("certifications", []) or []:
            if isinstance(cert, str):
                parts.append(cert)
            elif isinstance(cert, dict) and cert.get("name"):
                parts.append(cert["name"])
        return ". ".join(parts)
    
    def _match_category(self, category: str, cv_data, requirement: dict) -> tuple:
        if category in ("skills", "soft_skills", "certifications"):
            required = requirement.get("required", [])
            return self._match_skills(cv_data if isinstance(cv_data, list) else [], {"required": required})
        elif category == "education":
            return self._match_education(cv_data, requirement)
        elif category == "experience":
            return self._match_experience(cv_data, requirement)
        elif category == "languages":
            return self._match_languages(cv_data, requirement)
        elif category == "profile_fit":
            return self._match_profile_fit(cv_data, requirement)
        return 0.0, {}
    
    def _match_skills(self, cv_skills: list, requirement: dict) -> tuple:
        required = requirement.get("required", [])
        if not cv_skills or not required:
            return 0.0, {"matched": [], "missing": required}
        
        cv_vectors = self.model.encode(cv_skills)
        req_vectors = self.model.encode(required)
        
        matched, missing = [], []
        total_score = 0
        
        for i, req_skill in enumerate(required):
            best_score, best_match = 0, ""
            
            for j, cv_skill in enumerate(cv_skills):
                score = util.cos_sim(req_vectors[i], cv_vectors[j]).item()
                if score > best_score:
                    best_score, best_match = score, cv_skill
            
            if best_score >= 0.45:
                matched.append({"required": req_skill, "found": best_match, "score": round(best_score, 3)})
                total_score += best_score
            else:
                missing.append(req_skill)
        
        return total_score / len(required) if required else 0, {"matched": matched, "missing": missing}
    
    def _match_education(self, cv_education: list, requirement: dict) -> tuple:
        req_degree = requirement.get("degree", "").lower()
        
        degree_levels = {"phd": 5, "master": 4, "bachelor": 3, "licence": 3, "bts": 2, "bac": 1}
        
        req_level = next((v for k, v in degree_levels.items() if k in req_degree), 0)
        
        for edu in cv_education:
            edu_degree = edu.get("degree", "").lower()
            for key, level in degree_levels.items():
                if key in edu_degree and level >= req_level:
                    return 1.0, {"status": "✅ Degree matches", "found": edu_degree}
        
        return 0.0, {"status": "❌ Degree not found", "required": req_degree}
    
    def _match_experience(self, cv_experience: list, requirement: dict) -> tuple:
        min_years = requirement.get("min_years", 0)
        
        total_years = 0
        for exp in cv_experience:
            duration = exp.get("duration", "")
            years = self._extract_years(duration)
            total_years += years
        
        if min_years == 0:
            return 1.0, {"years_found": total_years}
        
        score = min(total_years / min_years, 1.0)
        return score, {"years_found": total_years, "years_required": min_years}
    
    def _extract_years(self, duration: str) -> float:
        years_match = re.search(r'(\d+)\s*(years?|ans?)', duration.lower())
        if years_match:
            return float(years_match.group(1))
        
        year_range = re.findall(r'20\d{2}', duration)
        if len(year_range) >= 2:
            return int(year_range[-1]) - int(year_range[0])
        
        return 0
    
    def _match_profile_fit(self, cv_text: str, requirement: dict) -> tuple:
        job_text = (requirement.get("text") or "").strip()
        if not job_text:
            return 1.0, {"status": "no_job_profile_text"}
        if not cv_text or len(cv_text.strip()) < 20:
            return 0.0, {"status": "insufficient_cv_text"}

        job_vec = self.model.encode(job_text)
        cv_vec = self.model.encode(cv_text)
        score = float(util.cos_sim(job_vec, cv_vec).item())
        score = max(0.0, min(score, 1.0))
        return score, {"similarity": round(score, 3)}

    def _match_languages(self, cv_languages: list, requirement: list) -> tuple:
        if not requirement:
            return 1.0, {"matched": [], "missing": []}
        
        matched, missing = [], []
        
        for req in requirement:
            req_lang = req.get("language", "").lower()
            found = any(req_lang in lang.get("language", "").lower() for lang in cv_languages)
            
            if found:
                matched.append(req_lang)
            else:
                missing.append(req_lang)
        
        score = len(matched) / len(requirement) if requirement else 1.0
        return score, {"matched": matched, "missing": missing}


# Singleton
matching_service = MatchingService()