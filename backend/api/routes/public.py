from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
import re
from database import get_db
from models.job_offer import JobOffer
from models.user import User, UserRole
from models.candidate import Candidate
from core.dependencies import require_role
from services.ocr_service import ocr_service
from services.ner_service import ner_service

router = APIRouter(prefix="/public", tags=["Public"])

# ─────────────────────────────
# Helper — format job object
# ─────────────────────────────

def format_job(j) -> dict:
    return {
        "job_id": j.job_id,
        "title": j.title,
        "description": j.description,
        "requirements": j.requirements,
        "required_skills": j.required_skills.split(",") if j.required_skills else [],
        "experience_years": getattr(j, "experience_years", None),
        "education_level": getattr(j, "education_level", None),
        "location": j.location,
        "location_type": getattr(j, "location_type", None),
        "contract_type": j.contract_type,
        "department": getattr(j, "department", None),
        "experience_level": getattr(j, "experience_level", None),
        "salary_range": j.salary_range,
        "company_id": j.company_id,
        "company_name": j.company_name,
        "posted_date": j.posted_date,
        "closing_date": j.closing_date
    }


def _split_csv_skills(value: Optional[str]) -> list[str]:
    if not value:
        return []
    return [s.strip() for s in value.split(",") if s and s.strip()]


def _normalize_tokens(items: list[str]) -> set[str]:
    tokens: set[str] = set()
    for item in items:
        for token in re.findall(r"[a-zA-Z0-9\+#\.]{2,}", (item or "").lower()):
            tokens.add(token)
    return tokens


def _normalize_phrases(items: list[str]) -> list[str]:
    """Normalize skills as lowercase phrases (preserve multi-word skills)."""
    return [s.strip().lower() for s in items if s and s.strip()]


def _phrase_match(cv_phrases: list[str], req_phrases: list[str]) -> tuple[set[str], set[str]]:
    """Match required skill phrases against CV skill phrases.
    Handles multi-word skills (e.g. 'machine learning') as units.
    Returns (matched_set, missing_set)."""
    matched = set()
    missing = set()

    cv_text = " | ".join(cv_phrases)  # join with separator for substring search

    for req in req_phrases:
        req_lower = req.lower().strip()
        if not req_lower:
            continue
        found = False
        # Exact phrase match first
        for cv_skill in cv_phrases:
            if req_lower == cv_skill or req_lower in cv_skill or cv_skill in req_lower:
                found = True
                break
        # Fallback: check if all tokens of the required skill appear in CV skills
        if not found:
            req_tokens = set(re.findall(r"[a-zA-Z0-9\+#\.]{2,}", req_lower))
            cv_all_tokens = _normalize_tokens(cv_phrases)
            if req_tokens and req_tokens.issubset(cv_all_tokens):
                found = True
        if found:
            matched.add(req_lower)
        else:
            missing.add(req_lower)
    return matched, missing


def _build_match_for_job(job: JobOffer, cv_skills: list[str], cv_text: str) -> tuple[float, str]:
    required_skills = _split_csv_skills(getattr(job, "required_skills", None))

    # Normalize both sides as phrases
    cv_phrases = _normalize_phrases(cv_skills)
    req_phrases = _normalize_phrases(required_skills)

    # ── Skill score (phrase-level matching) ──
    skill_score = 0.0
    matched_required = set()
    if req_phrases:
        matched_required, missing = _phrase_match(cv_phrases, req_phrases)
        skill_score = len(matched_required) / len(req_phrases)
    elif cv_phrases:
        # No required skills specified — partial credit
        skill_score = 0.3

    # ── Keyword bonus (title + description relevance) ──
    # Only use job title + description tokens (not requirements/skills again)
    job_title_desc_tokens = _normalize_tokens([
        getattr(job, "title", "") or "",
        getattr(job, "description", "") or "",
    ])
    cv_text_tokens = _normalize_tokens([cv_text])
    keyword_bonus = 0.0
    if job_title_desc_tokens:
        overlap = len(job_title_desc_tokens.intersection(cv_text_tokens))
        # Cap the keyword bonus to avoid inflating with long CVs
        raw_ratio = overlap / len(job_title_desc_tokens)
        keyword_bonus = min(raw_ratio, 0.5)  # cap at 50% of job tokens matched

    # ── Final score ──
    # Skills are the main signal (85%), keyword bonus is minor (15%)
    overall = round(min((skill_score * 0.85) + (keyword_bonus * 0.15), 1.0), 3)

    # ── Reason string ──
    if req_phrases:
        if matched_required:
            reason = f"Matched {len(matched_required)}/{len(req_phrases)} required skills: {', '.join(sorted(matched_required)[:5])}."
        else:
            reason = "No required skills from this job were found in your CV."
    else:
        reason = "Job has no explicit required skills; ranking uses title and description relevance."

    return overall, reason



def _normalize_email(value: str) -> str:
    return (value or "").strip().lower()


def _apply_job_filters(
    query,
    search: Optional[str] = None,
    location: Optional[str] = None,
    location_type: Optional[str] = None,
    contract_type: Optional[str] = None,
    department: Optional[str] = None,
    experience_level: Optional[str] = None,
    skills: Optional[str] = None,
    company_id: Optional[str] = None
):
    if search:
        query = query.filter(
            JobOffer.title.ilike(f"%{search}%") |
            JobOffer.description.ilike(f"%{search}%")
        )
    if location:
        query = query.filter(JobOffer.location.ilike(f"%{location}%"))
    if location_type and hasattr(JobOffer, "location_type"):
        query = query.filter(JobOffer.location_type == location_type)
    if contract_type:
        query = query.filter(JobOffer.contract_type == contract_type)
    if department and hasattr(JobOffer, "department"):
        query = query.filter(JobOffer.department.ilike(f"%{department}%"))
    if experience_level and hasattr(JobOffer, "experience_level"):
        query = query.filter(JobOffer.experience_level == experience_level)
    if skills and hasattr(JobOffer, "required_skills"):
        for skill in skills.split(","):
            skill = skill.strip()
            if skill:
                query = query.filter(JobOffer.required_skills.ilike(f"%{skill}%"))
    if company_id:
        query = query.filter(JobOffer.company_id == company_id)
    return query

# ─────────────────────────────
# GET /public/jobs
# Browse all active jobs
# No login required
# ─────────────────────────────

@router.get("/jobs")
def get_public_jobs(
    search: Optional[str] = None,
    location: Optional[str] = None,
    location_type: Optional[str] = None,
    contract_type: Optional[str] = None,
    department: Optional[str] = None,
    experience_level: Optional[str] = None,
    skills: Optional[str] = None,
    company_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(JobOffer).filter(JobOffer.is_active == True)
    query = _apply_job_filters(
        query=query,
        search=search,
        location=location,
        location_type=location_type,
        contract_type=contract_type,
        department=department,
        experience_level=experience_level,
        skills=skills,
        company_id=company_id
    )

    jobs = query.order_by(JobOffer.posted_date.desc()).all()

    return {
        "total": len(jobs),
        "jobs": [format_job(j) for j in jobs]
    }


@router.get("/jobs/match-profile")
def match_jobs_by_candidate_profile(
    search: Optional[str] = None,
    location: Optional[str] = None,
    location_type: Optional[str] = None,
    contract_type: Optional[str] = None,
    department: Optional[str] = None,
    experience_level: Optional[str] = None,
    skills: Optional[str] = None,
    company_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE))
):
    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.user_id).first()
    profile_skills = _split_csv_skills(candidate.skills if candidate else None)
    if not profile_skills:
        return {"total": 0, "jobs": [], "profile": {"name": f"{current_user.first_name} {current_user.last_name}".strip(), "email": current_user.email, "skills": []}}

    query = db.query(JobOffer).filter(JobOffer.is_active == True)
    query = _apply_job_filters(
        query=query,
        search=search,
        location=location,
        location_type=location_type,
        contract_type=contract_type,
        department=department,
        experience_level=experience_level,
        skills=skills,
        company_id=company_id
    )

    jobs = query.all()
    ranked = []
    profile_text = " ".join(profile_skills)
    for job in jobs:
        score, reason = _build_match_for_job(job, cv_skills=profile_skills, cv_text=profile_text)
        item = format_job(job)
        item["match_percentage"] = round(score * 100, 1)
        item["match_reason"] = reason
        ranked.append(item)

    ranked.sort(key=lambda x: x["match_percentage"], reverse=True)
    return {
        "total": len(ranked),
        "jobs": ranked,
        "profile": {
            "name": f"{current_user.first_name} {current_user.last_name}".strip(),
            "email": current_user.email,
            "skills": profile_skills
        }
    }


@router.post("/jobs/match-cv")
async def match_jobs_by_cv(
    file: UploadFile = File(...),
    search: Optional[str] = None,
    location: Optional[str] = None,
    location_type: Optional[str] = None,
    contract_type: Optional[str] = None,
    department: Optional[str] = None,
    experience_level: Optional[str] = None,
    skills: Optional[str] = None,
    company_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if not file.filename or not file.filename.lower().endswith((".pdf", ".doc", ".docx")):
        raise HTTPException(status_code=400, detail="Only PDF, DOC, DOCX files are accepted")

    contents = await file.read()
    try:
        if file.filename.lower().endswith(".pdf"):
            cv_text = ocr_service.extract_text_from_bytes(contents)
        else:
            cv_text = contents.decode("utf-8", errors="ignore")

        if not cv_text or len(cv_text.strip()) < 30:
            raise HTTPException(status_code=400, detail="Unable to extract enough text from CV")

        parsed = ner_service.parse_cv(cv_text)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CV parsing failed: {str(e)}")

    skills_obj = parsed.get("skills", {}) if isinstance(parsed, dict) else {}
    technical = skills_obj.get("technical", []) if isinstance(skills_obj, dict) else []
    soft = skills_obj.get("soft", []) if isinstance(skills_obj, dict) else []
    cv_skills = [s.strip() for s in (technical + soft) if isinstance(s, str) and s.strip()]

    query = db.query(JobOffer).filter(JobOffer.is_active == True)
    query = _apply_job_filters(
        query=query,
        search=search,
        location=location,
        location_type=location_type,
        contract_type=contract_type,
        department=department,
        experience_level=experience_level,
        skills=skills,
        company_id=company_id
    )

    jobs = query.all()
    ranked = []
    for job in jobs:
        score, reason = _build_match_for_job(job, cv_skills=cv_skills, cv_text=cv_text)
        item = format_job(job)
        item["match_percentage"] = round(score * 100, 1)
        item["match_reason"] = reason
        ranked.append(item)

    extracted_email = _normalize_email(
        ((parsed.get("contact") or {}).get("email") or "") if isinstance(parsed, dict) else ""
    )
    existing_user = None
    if extracted_email:
        existing_user = db.query(User).filter(User.email.ilike(extracted_email)).first()
    account_exists = bool(existing_user and existing_user.role == UserRole.CANDIDATE)

    ranked.sort(key=lambda x: x["match_percentage"], reverse=True)
    return {
        "total": len(ranked),
        "jobs": ranked,
        "cv": {
            "extracted_name": (parsed.get("name") or "").strip() if isinstance(parsed, dict) else "",
            "extracted_email": extracted_email,
            "account_exists": account_exists,
            "extracted_skills": cv_skills
        }
    }

# ─────────────────────────────
# GET /public/jobs/{job_id}
# Get single job detail
# No login required
# ─────────────────────────────

@router.get("/jobs/{job_id}")
def get_job_detail(
    job_id: str,
    db: Session = Depends(get_db)
):
    job = db.query(JobOffer).filter(
        JobOffer.job_id == job_id,
        JobOffer.is_active == True
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return format_job(job)

# ─────────────────────────────
# GET /public/jobs/{job_id}/similar
# Get similar jobs based on department or company
# No login required
# ─────────────────────────────

@router.get("/jobs/{job_id}/similar")
def get_similar_jobs(
    job_id: str,
    db: Session = Depends(get_db)
):
    # Get the current job
    job = db.query(JobOffer).filter(
        JobOffer.job_id == job_id,
        JobOffer.is_active == True
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    similar = []

    # Strategy 1 — same department
    if hasattr(job, "department") and job.department:
        similar = db.query(JobOffer).filter(
            JobOffer.job_id != job_id,
            JobOffer.is_active == True,
            JobOffer.department == job.department
        ).limit(4).all()

    # Strategy 2 — same company if not enough results
    if len(similar) < 4:
        existing_ids = [j.job_id for j in similar] + [job_id]
        more = db.query(JobOffer).filter(
            JobOffer.job_id.notin_(existing_ids),
            JobOffer.is_active == True,
            JobOffer.company_id == job.company_id
        ).limit(4 - len(similar)).all()
        similar.extend(more)

    # Strategy 3 — same contract type if still not enough
    if len(similar) < 4:
        existing_ids = [j.job_id for j in similar] + [job_id]
        more = db.query(JobOffer).filter(
            JobOffer.job_id.notin_(existing_ids),
            JobOffer.is_active == True,
            JobOffer.contract_type == job.contract_type
        ).limit(4 - len(similar)).all()
        similar.extend(more)

    return {
        "total": len(similar),
        "jobs": [format_job(j) for j in similar]
    }

# ─────────────────────────────
# GET /public/companies/{slug}/jobs
# Browse jobs by company slug
# e.g. /public/companies/techcorp/jobs
# No login required
# ─────────────────────────────

@router.get("/companies/{slug}/jobs")
def get_company_jobs(
    slug: str,
    db: Session = Depends(get_db)
):
    from models.company import Company

    company = db.query(Company).filter(
        Company.slug == slug,
        Company.is_active == True
    ).first()

    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    jobs = db.query(JobOffer).filter(
        JobOffer.company_id == company.company_id,
        JobOffer.is_active == True
    ).order_by(JobOffer.posted_date.desc()).all()

    return {
        "company_id": company.company_id,
        "company_name": company.name,
        "company_slug": company.slug,
        "total": len(jobs),
        "jobs": [format_job(j) for j in jobs]
    }

# ─────────────────────────────
# GET /public/filters
# Returns all available filter options
# Used by frontend to build filter sidebar dynamically
# ─────────────────────────────

@router.get("/filters")
def get_filter_options(
    db: Session = Depends(get_db)
):
    return {
        "location_types": ["REMOTE", "HYBRID", "ON_SITE"],
        "contract_types": ["CDI", "CDD", "INTERNSHIP", "FREELANCE"],
        "departments": [
            "Engineering",
            "Sales",
            "Marketing",
            "Product",
            "Customer Success",
            "Customer Support",
            "G&A",
            "Transformation Office"
        ],
        "experience_levels": [
            "ENTRY",
            "MID_SENIOR",
            "INTERN",
            "DIRECTOR"
        ],
        "suggested_skills": [
            "Python", "React", "FastAPI", "SQL",
            "Node.js", "Java", "Machine Learning",
            "Data Science", "DevOps", "Cloud Computing",
            "Docker", "Kubernetes", "API", "TypeScript",
            "Django", "PostgreSQL", "MongoDB", "Redis"
        ]
    }
