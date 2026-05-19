from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from services.job_closing_service import sync_job_closings
from models.job_offer import JobOffer
from models.user import User, UserRole
from models.candidate import Candidate
from models.interview import Interview, InterviewStatus
from core.dependencies import require_role
from services.ocr_service import ocr_service
from services.ner_service import ner_service
from services.interview_scheduling import (
    build_slots_payload,
    apply_interview_schedule,
    ensure_schedule_token,
    get_interview_by_schedule_token,
)
from schemas.interview_schemas import SelectTimeSlotRequest, InterviewLanguageUpdate

router = APIRouter(prefix="/public", tags=["Public"])


def _sync_close_expired_jobs(db: Session) -> None:
    """Hide expired jobs and trigger interview invites (notifications + email)."""
    sync_job_closings(db, background=True)


def _public_jobs_query(db: Session):
    """Only jobs visible on the public careers page."""
    _sync_close_expired_jobs(db)
    return db.query(JobOffer).filter(JobOffer.is_active == True)


# ─────────────────────────────
# Helper — format job object
# ─────────────────────────────

def _enum_value(value):
    if value is None:
        return None
    return value.value if hasattr(value, "value") else str(value)


def format_job(j) -> dict:
    return {
        "job_id": j.job_id,
        "title": j.title,
        "description": j.description,
        "requirements": j.requirements,
        "required_skills": _split_csv_skills(j.required_skills),
        "experience_years": getattr(j, "experience_years", None),
        "education_level": getattr(j, "education_level", None),
        "location": j.location,
        "location_type": _enum_value(getattr(j, "location_type", None)),
        "contract_type": _enum_value(getattr(j, "contract_type", None)),
        "department": getattr(j, "department", None),
        "experience_level": _enum_value(getattr(j, "experience_level", None)),
        "languages_required": _split_csv_skills(getattr(j, "languages_required", None)),
        "languages_other": getattr(j, "languages_other", None),
        "soft_skills": _split_csv_skills(getattr(j, "soft_skills", None)),
        "soft_skills_other": getattr(j, "soft_skills_other", None),
        "certifications": _split_csv_skills(getattr(j, "certifications", None)),
        "certifications_other": getattr(j, "certifications_other", None),
        "salary_range": j.salary_range,
        "company_id": j.company_id,
        "company_name": j.company_name,
        "posted_date": j.posted_date,
        "closing_date": j.closing_date,
    }


def _split_csv_skills(value: Optional[str]) -> list[str]:
    if not value:
        return []
    return [s.strip() for s in value.split(",") if s and s.strip()]


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
    query = _public_jobs_query(db)
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
    if not candidate:
        return {
            "total": 0,
            "jobs": [],
            "profile": {
                "name": f"{current_user.first_name} {current_user.last_name}".strip(),
                "email": current_user.email,
                "skills": [],
            },
        }

    from services.cv_job_matching import (
        cv_match_percentage,
        format_match_reason,
        load_parsed_cv,
        match_parsed_cv_to_job,
    )

    parsed_cv = load_parsed_cv(db, candidate)
    profile_skills = _split_csv_skills(candidate.skills if candidate else None)

    query = _public_jobs_query(db)
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
        result = match_parsed_cv_to_job(parsed_cv, job)
        item = format_job(job)
        item["match_percentage"] = cv_match_percentage(result)
        item["match_reason"] = format_match_reason(result)
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

    query = _public_jobs_query(db)
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

    from services.cv_job_matching import (
        cv_match_percentage,
        format_match_reason,
        match_parsed_cv_to_job,
    )

    jobs = query.all()
    ranked = []
    for job in jobs:
        result = match_parsed_cv_to_job(parsed, job)
        item = format_job(job)
        item["match_percentage"] = cv_match_percentage(result)
        item["match_reason"] = format_match_reason(result)
        ranked.append(item)

    contact = parsed.get("contact", {}) if isinstance(parsed, dict) else {}
    extracted_email = _normalize_email(
        (contact.get("email") or "") if isinstance(contact, dict) else ""
    )
    extracted_phone = (contact.get("phone") or "").strip() if isinstance(contact, dict) else ""
    
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
            "extracted_phone": extracted_phone,
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
    job = _public_jobs_query(db).filter(JobOffer.job_id == job_id).first()

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
    job = _public_jobs_query(db).filter(JobOffer.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    similar = []
    base = _public_jobs_query(db)

    # Strategy 1 — same department
    if hasattr(job, "department") and job.department:
        similar = base.filter(
            JobOffer.job_id != job_id,
            JobOffer.department == job.department
        ).limit(4).all()

    # Strategy 2 — same company if not enough results
    if len(similar) < 4:
        existing_ids = [j.job_id for j in similar] + [job_id]
        more = base.filter(
            JobOffer.job_id.notin_(existing_ids),
            JobOffer.company_id == job.company_id
        ).limit(4 - len(similar)).all()
        similar.extend(more)

    # Strategy 3 — same contract type if still not enough
    if len(similar) < 4:
        existing_ids = [j.job_id for j in similar] + [job_id]
        more = base.filter(
            JobOffer.job_id.notin_(existing_ids),
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

    jobs = (
        _public_jobs_query(db)
        .filter(JobOffer.company_id == company.company_id)
        .order_by(JobOffer.posted_date.desc())
        .all()
    )

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


# ─────────────────────────────
# Public interview scheduling (email magic link, no login)
# ─────────────────────────────

def _serialize_slots(payload: dict) -> list:
    return [
        {
            "datetime": s["datetime"].isoformat(),
            "formatted": s["formatted"],
            "available": s["available"],
        }
        for s in payload["slots"]
    ]


@router.get("/interview/schedule")
def get_public_interview_schedule(
    token: str = Query(..., min_length=16),
    db: Session = Depends(get_db),
):
    """Load interview time slots from email link (no authentication)."""
    interview = get_interview_by_schedule_token(db, token)
    if not interview:
        raise HTTPException(status_code=404, detail="Invalid or expired scheduling link")
    if interview.status == InterviewStatus.CANCELLED:
        raise HTTPException(status_code=410, detail="This interview invitation is no longer active")

    ensure_schedule_token(interview)
    db.commit()

    job = db.query(JobOffer).filter(JobOffer.job_id == interview.job_id).first()
    job_title = job.title if job else "Unknown Position"
    candidate = db.query(Candidate).filter(Candidate.candidate_id == interview.candidate_id).first()
    user = db.query(User).filter(User.user_id == candidate.user_id).first() if candidate else None
    candidate_name = f"{user.first_name} {user.last_name}".strip() if user else "Candidate"

    payload = build_slots_payload(db, interview, job_title)
    scheduled_at = payload["scheduled_at"]
    return {
        "interview_id": interview.interview_id,
        "job_title": job_title,
        "candidate_name": candidate_name,
        "company_name": job.company_name if job else None,
        "slots": _serialize_slots(payload),
        "week_start": payload["week_start"].isoformat(),
        "week_end": payload["week_end"].isoformat(),
        "already_scheduled": payload["already_scheduled"],
        "scheduled_at": scheduled_at.isoformat() if scheduled_at else None,
        "meeting_link": interview.meeting_link,
        "language": interview.language or "en",
    }


@router.patch("/interview/schedule/language")
def patch_public_interview_language(
    body: InterviewLanguageUpdate,
    token: str = Query(..., min_length=16),
    db: Session = Depends(get_db),
):
    """Set interview language from email link (no login)."""
    interview = get_interview_by_schedule_token(db, token)
    if not interview:
        raise HTTPException(status_code=404, detail="Invalid or expired scheduling link")
    if interview.status == InterviewStatus.CANCELLED:
        raise HTTPException(status_code=410, detail="This interview invitation is no longer active")
    if interview.status not in (InterviewStatus.INVITED,):
        raise HTTPException(status_code=400, detail="Language can only be changed before the interview starts")

    interview.language = body.language
    db.commit()
    return {"interview_id": interview.interview_id, "language": interview.language}


@router.post("/interview/schedule")
def submit_public_interview_schedule(
    payload: SelectTimeSlotRequest,
    token: str = Query(..., min_length=16),
    db: Session = Depends(get_db),
):
    """Confirm interview time from email link; syncs to application and notifies recruiter."""
    interview = get_interview_by_schedule_token(db, token)
    if not interview:
        raise HTTPException(status_code=404, detail="Invalid or expired scheduling link")
    if interview.status == InterviewStatus.CANCELLED:
        raise HTTPException(status_code=410, detail="This interview invitation is no longer active")
    if interview.scheduled_at:
        raise HTTPException(status_code=409, detail="Interview time was already scheduled")

    try:
        return apply_interview_schedule(
            db,
            interview,
            payload.selected_datetime,
            via_email=True,
            language=payload.language,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
