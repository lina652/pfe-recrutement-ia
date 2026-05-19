"""Build structured job requirements from JobOffer / RequirementRequest fields."""

from typing import Any, Optional


def parse_comma_list(value: Optional[str]) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in str(value).split(",") if part.strip()]


def build_job_requirements(job: Any) -> dict:
    """
    Map all manager form fields into matching_service categories:
    description, requirements, skills, experience, education, languages,
    soft skills, certifications.
    """
    required_skills = parse_comma_list(getattr(job, "required_skills", None))

    languages = parse_comma_list(getattr(job, "languages_required", None))
    languages.extend(parse_comma_list(getattr(job, "languages_other", None)))
    language_reqs = [{"language": lang} for lang in languages]

    soft_skills = parse_comma_list(getattr(job, "soft_skills", None))
    soft_skills.extend(parse_comma_list(getattr(job, "soft_skills_other", None)))

    certifications = parse_comma_list(getattr(job, "certifications", None))
    certifications.extend(parse_comma_list(getattr(job, "certifications_other", None)))

    description = (getattr(job, "description", None) or "").strip()
    requirements = (getattr(job, "requirements", None) or "").strip()
    profile_text = " ".join(part for part in (description, requirements) if part)

    experience_level = getattr(job, "experience_level", None)
    if experience_level is not None and hasattr(experience_level, "value"):
        experience_level = experience_level.value
    if experience_level:
        profile_text = f"{profile_text} Experience level: {experience_level}.".strip()

    return {
        "skills": {"required": required_skills, "preferred": []},
        "education": {"degree": getattr(job, "education_level", "") or ""},
        "experience": {
            "min_years": int(getattr(job, "experience_years", 0) or 0),
            "roles": [],
        },
        "languages": language_reqs,
        "soft_skills": {"required": soft_skills},
        "certifications": {"required": certifications},
        "profile_fit": {"text": profile_text},
    }
