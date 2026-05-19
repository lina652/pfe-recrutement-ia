import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from database import get_db
from models.user import User, UserRole
from models.job_offer import JobOffer
from models.application import Application, ApplicationStatus
from models.candidate import Candidate
from models.interview import Interview, InterviewMessage, InterviewReport
from core.dependencies import get_current_user, require_role
from core.security import hash_password
from core.email_utils import normalize_email
from pydantic import BaseModel, EmailStr
from services.ocr_service import ocr_service
from services.ner_service import ner_service
from models.notification import Notification
from schemas.notification import NotificationListResponse, NotificationResponse

router = APIRouter(
    prefix="/candidate",
    tags=["Candidate"]
)


# ─────────────────────────────
# PUBLIC — GET /candidate/jobs
# ─────────────────────────────

@router.get("/jobs")
def get_public_jobs(
    search: Optional[str] = None,
    location: Optional[str] = None,
    contract_type: Optional[str] = None,
    company_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(JobOffer).filter(
        JobOffer.is_active == True
    )

    if search:
        query = query.filter(
            JobOffer.title.ilike(f"%{search}%") |
            JobOffer.description.ilike(f"%{search}%")
        )

    if location:
        query = query.filter(
            JobOffer.location.ilike(f"%{location}%")
        )

    if contract_type:
        query = query.filter(
            JobOffer.contract_type == contract_type
        )

    if company_id:
        query = query.filter(
            JobOffer.company_id == company_id
        )

    jobs = query.order_by(JobOffer.posted_date.desc()).all()

    return {
        "total": len(jobs),
        "jobs": [
            {
                "job_id": j.job_id,
                "title": j.title,
                "description": j.description,
                "requirements": j.requirements,
                "location": j.location,
                "contract_type": j.contract_type,
                "salary_range": j.salary_range,
                "company_id": j.company_id,
                "company_name": j.company_name,
                "posted_date": j.posted_date,
                "closing_date": j.closing_date
            }
            for j in jobs
        ]
    }

# ─────────────────────────────
# PUBLIC — GET /candidate/jobs/{id}
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
        raise HTTPException(
            status_code=404,
            detail="Job offer not found"
        )

    return {
        "job_id": job.job_id,
        "title": job.title,
        "description": job.description,
        "requirements": job.requirements,
        "location": job.location,
        "contract_type": job.contract_type,
        "salary_range": job.salary_range,
        "company_id": job.company_id,
        "company_name": job.company_name,
        "posted_date": job.posted_date,
        "closing_date": job.closing_date
    }

# ─────────────────────────────
# PUBLIC — POST /candidate/signup/cv
# ─────────────────────────────

@router.post("/signup/cv")
async def signup_by_cv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Read file
    contents = await file.read()

    # Basic validation
    if not file.filename.endswith(('.pdf', '.doc', '.docx')):
        raise HTTPException(
            status_code=400,
            detail="Only PDF, DOC, DOCX files are accepted"
        )

    # Parse CV using integrated OCR + NER pipeline
    try:
        if file.filename.lower().endswith(".pdf"):
            cv_text = ocr_service.extract_text_from_bytes(contents)
        else:
            cv_text = contents.decode("utf-8", errors="ignore")

        if not cv_text or len(cv_text.strip()) < 30:
            raise HTTPException(
                status_code=400,
                detail="Unable to extract enough text from CV"
            )

        parsed = ner_service.parse_cv(cv_text)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"CV parsing failed: {str(e)}"
        )

    contact = parsed.get("contact", {}) if isinstance(parsed, dict) else {}
    skills_obj = parsed.get("skills", {}) if isinstance(parsed, dict) else {}
    technical = skills_obj.get("technical", []) if isinstance(skills_obj, dict) else []
    soft = skills_obj.get("soft", []) if isinstance(skills_obj, dict) else []
    all_skills = [s for s in (technical + soft) if isinstance(s, str) and s.strip()]

    extracted_email = normalize_email(contact.get("email") or "")
    extracted = {
        "name": (parsed.get("name") or "").strip() if isinstance(parsed, dict) else "",
        "email": extracted_email,
        "phone": (contact.get("phone") or "").strip(),
        "skills": all_skills,
    }

    # Confidence based on availability of key fields
    populated = sum(
        1 for v in [extracted["name"], extracted["email"], extracted["skills"]]
        if (v if not isinstance(v, list) else len(v) > 0)
    )
    confidence_score = round(populated / 3, 2)

    account_exists = False
    # Check if email already exists
    if extracted.get("email"):
        existing = db.query(User).filter(
            User.email.ilike(extracted["email"])
        ).first()
        if existing:
            if existing.role != UserRole.CANDIDATE:
                raise HTTPException(
                    status_code=409,
                    detail="This email is already used by a staff account. Please use another email."
                )
            account_exists = True

    return {
        "extracted_name": extracted.get("name", ""),
        "extracted_email": extracted.get("email", ""),
        "extracted_phone": extracted.get("phone", ""),
        "extracted_skills": extracted.get("skills", []),
        "account_exists": account_exists,
        "confidence_score": confidence_score,
        "file_name": file.filename,
        "message": "CV parsed successfully. Please confirm your information."
    }

# ─────────────────────────────
# PUBLIC — POST /candidate/signup/confirm
# ─────────────────────────────

class SignupConfirmRequest(BaseModel):
    extracted_name: str
    extracted_email: EmailStr
    extracted_phone: Optional[str] = None
    extracted_skills: Optional[list] = []
    password: str
    job_id: Optional[str] = None

@router.post("/signup/confirm", status_code=201)
def confirm_signup(
    payload: SignupConfirmRequest,
    db: Session = Depends(get_db)
):
    normalized_email = normalize_email(payload.extracted_email)

    # Final check
    existing = db.query(User).filter(
        User.email.ilike(normalized_email)
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Email already registered"
        )

    # Split name
    name_parts = payload.extracted_name.strip().split(" ")
    first_name = name_parts[0] if name_parts else "Unknown"
    last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

    # Create user
    user = User(
        user_id=str(uuid.uuid4()),
        first_name=first_name,
        last_name=last_name,
        email=normalized_email,
        password_hash=hash_password(payload.password),
        role=UserRole.CANDIDATE,
        is_active=True,
        company_id=None
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create candidate profile
    candidate = Candidate(
        candidate_id=str(uuid.uuid4()),
        user_id=user.user_id,
        phone=payload.extracted_phone,
        skills=",".join(payload.extracted_skills)
    )
    db.add(candidate)
    db.commit()

    # NOTE: We intentionally do NOT auto-create an application here.
    # The candidate must explicitly apply via POST /candidate/apply/{job_id}.
    # This ensures that just creating an account (e.g. from CV drop) does NOT
    # produce phantom applications in the admin dashboard.

    return {
        "message": "Account created successfully",
        "user_id": user.user_id,
        "email": user.email
    }

# ─────────────────────────────
# PRIVATE — GET /candidate/profile
# ─────────────────────────────

@router.get("/profile")
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.CANDIDATE)
    )
):
    candidate = db.query(Candidate).filter(
        Candidate.user_id == current_user.user_id
    ).first()

    return {
        "user_id": current_user.user_id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
        "phone": candidate.phone if candidate else None,
        "skills": candidate.skills.split(",") if candidate and candidate.skills else [],
        "linkedin_url": candidate.linkedin_url if candidate else None,
        "portfolio_url": candidate.portfolio_url if candidate else None
    }

# ─────────────────────────────
# PRIVATE — GET /candidate/applications
# ─────────────────────────────

@router.get("/applications")
def get_my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.CANDIDATE)
    )
):
    candidate = db.query(Candidate).filter(
        Candidate.user_id == current_user.user_id
    ).first()

    if not candidate:
        return {"total": 0, "applications": []}

    applications = db.query(Application).filter(
        Application.candidate_id == candidate.candidate_id
    ).order_by(Application.submission_date.desc()).all()

    result = []
    for app in applications:
        job = db.query(JobOffer).filter(
            JobOffer.job_id == app.job_id
        ).first()

        status_val = (
            app.status.value if hasattr(app.status, "value") else app.status
        )
        result.append({
            "app_id": app.app_id,
            "job_id": app.job_id,
            "job_title": job.title if job else "Unknown",
            "company_name": job.company_name if job else "Unknown",
            "location": job.location if job else None,
            "status": status_val,
            "can_withdraw": status_val != ApplicationStatus.ACCEPTED.value,
            "submission_date": app.submission_date,
            "last_updated": app.last_updated
        })

    return {
        "total": len(result),
        "applications": result
    }

# ─────────────────────────────
# PRIVATE — POST /candidate/apply/{job_id}
# ─────────────────────────────

@router.post("/apply/{job_id}")
def apply_to_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.CANDIDATE)
    )
):
    candidate = db.query(Candidate).filter(
        Candidate.user_id == current_user.user_id
    ).first()

    if not candidate:
        raise HTTPException(
            status_code=404,
            detail="Candidate profile not found"
        )

    from services.job_closing_service import deactivate_expired_jobs

    deactivate_expired_jobs(db)

    job = db.query(JobOffer).filter(
        JobOffer.job_id == job_id,
        JobOffer.is_active == True,
    ).first()

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job offer not found or closed",
        )

    # Check not already applied
    existing = db.query(Application).filter(
        Application.candidate_id == candidate.candidate_id,
        Application.job_id == job_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="You have already applied to this job"
        )

    application = Application(
        app_id=str(uuid.uuid4()),
        candidate_id=candidate.candidate_id,
        job_id=job_id,
        status=ApplicationStatus.PENDING
    )
    db.add(application)
    db.flush()

    # Notify candidate of application received
    cand_notification = Notification(
        notification_id=str(uuid.uuid4()),
        user_id=candidate.user_id,
        company_id=job.company_id,
        title="Application Received",
        message=f"Your application for {job.title} has been received. We will review your profile and contact you if you are shortlisted for an interview. The position closes on {job.closing_date.strftime('%B %d, %Y') if job.closing_date else 'TBD'}.",
        type="APPLICATION_RECEIVED",
        reference_id=application.app_id,
        is_read=False
    )
    db.add(cand_notification)

    db.commit()
    db.refresh(application)

    from services.cv_job_matching import match_and_persist_application, cv_match_percentage

    try:
        match_result = match_and_persist_application(db, application)
        db.commit()
        db.refresh(application)
    except Exception as match_exc:
        logger.warning("CV match on apply failed for %s: %s", application.app_id, match_exc)
        match_result = {}

    return {
        "message": "Application submitted successfully",
        "app_id": application.app_id,
        "job_title": job.title,
        "status": application.status,
        "closing_date": job.closing_date.isoformat() if job.closing_date else None,
        "match_percentage": cv_match_percentage(match_result) if match_result else None,
        "ai_recommendation": application.ai_recommendation,
    }


def _delete_application_cascade(db: Session, application: Application) -> None:
    """Remove interviews (messages, reports), related notifications, then the application."""
    interviews = (
        db.query(Interview)
        .filter(Interview.application_id == application.app_id)
        .all()
    )
    interview_ids = [i.interview_id for i in interviews]

    if interview_ids:
        db.query(Notification).filter(
            Notification.reference_id.in_(interview_ids)
        ).delete(synchronize_session=False)

    for interview in interviews:
        db.query(InterviewMessage).filter(
            InterviewMessage.interview_id == interview.interview_id
        ).delete(synchronize_session=False)
        db.query(InterviewReport).filter(
            InterviewReport.interview_id == interview.interview_id
        ).delete(synchronize_session=False)

    db.query(Interview).filter(
        Interview.application_id == application.app_id
    ).delete(synchronize_session=False)
    db.query(Notification).filter(
        Notification.reference_id == application.app_id
    ).delete(synchronize_session=False)
    db.delete(application)


# ─────────────────────────────
# PRIVATE — DELETE /candidate/applications/{app_id}
# ─────────────────────────────

@router.delete("/applications/{app_id}")
def withdraw_application(
    app_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE)),
):
    """Candidate withdraws / deletes their own application."""
    candidate = db.query(Candidate).filter(
        Candidate.user_id == current_user.user_id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate profile not found")

    application = db.query(Application).filter(Application.app_id == app_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.candidate_id != candidate.candidate_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    status_val = (
        application.status.value
        if hasattr(application.status, "value")
        else application.status
    )
    if status_val == ApplicationStatus.ACCEPTED.value:
        raise HTTPException(
            status_code=400,
            detail="You cannot withdraw an application after you have been accepted for the role",
        )

    job = db.query(JobOffer).filter(JobOffer.job_id == application.job_id).first()
    job_title = job.title if job else "the position"

    _delete_application_cascade(db, application)
    db.commit()

    return {
        "message": f"Your application for {job_title} has been withdrawn",
        "app_id": app_id,
    }


# -----------------------
# Candidate Notifications
# -----------------------


@router.get("/notifications", response_model=NotificationListResponse)
def get_candidate_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE))
):
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.user_id
    ).order_by(Notification.created_at.desc()).all()

    unread = sum(1 for n in notifications if not n.is_read)

    return NotificationListResponse(
        total=len(notifications),
        unread_count=unread,
        notifications=[NotificationResponse.model_validate(n) for n in notifications]
    )


@router.put("/notifications/{notification_id}/read")
def mark_candidate_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE))
):
    n = db.query(Notification).filter(
        Notification.notification_id == notification_id,
        Notification.user_id == current_user.user_id
    ).first()

    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")

    n.is_read = True
    db.commit()

    return {"message": "Notification marked as read"}


@router.delete("/notifications")
def clear_candidate_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE))
):
    deleted = db.query(Notification).filter(
        Notification.user_id == current_user.user_id
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": "Notifications cleared", "deleted": deleted}
