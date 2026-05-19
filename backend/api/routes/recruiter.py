from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import uuid

from database import get_db
from models.user import User, UserRole
from models.job_offer import JobOffer, LocationType, ExperienceLevel, LocationType, ExperienceLevel
from models.application import Application, ApplicationStatus
from models.log import Log
from models.company import Company
from models.requirement_request import RequirementRequest, RequestStatus
from models.notification import Notification
from core.dependencies import require_role
from core.closing_date import is_closing_due, parse_and_validate_closing, validate_closing_datetime
from schemas.manager import ReopenJobRequest
from schemas.recruiter import (
    CreateJobOfferRequest,
    UpdateJobOfferRequest,
    JobOfferResponse,
    JobOfferListResponse,
    RecruiterStats,
    RequirementRequestForHR,
    RequirementRequestListForHR,
    AcceptRequirementRequest,
    RejectRequirementRequest
)
from schemas.notification import NotificationResponse, NotificationListResponse

router = APIRouter(
    prefix="/recruiter",
    tags=["Recruiter / HR"]
)


def _parse_location_type(value: Optional[str]):
    if not value:
        return None
    try:
        return LocationType(value)
    except ValueError:
        return None


def _parse_experience_level(value: Optional[str]):
    if not value:
        return None
    try:
        return ExperienceLevel(value)
    except ValueError:
        return None


def save_log(db, action, user_id=None, user_email=None, details=None, ip_address=None):
    log = Log(
        user_id=user_id,
        user_email=user_email,
        action=action,
        details=details,
        ip_address=ip_address
    )
    db.add(log)
    db.commit()

# ─────────────────────────────
# GET /recruiter/stats
# ─────────────────────────────

@router.get("/stats", response_model=RecruiterStats)
def get_recruiter_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    return RecruiterStats(
        total_jobs=db.query(JobOffer).filter(
            JobOffer.posted_by == current_user.user_id
        ).count(),
        active_jobs=db.query(JobOffer).filter(
            JobOffer.posted_by == current_user.user_id,
            JobOffer.is_active == True
        ).count(),
        closed_jobs=db.query(JobOffer).filter(
            JobOffer.posted_by == current_user.user_id,
            JobOffer.is_active == False
        ).count(),
        total_applications=db.query(Application).count(),
        pending_applications=db.query(Application).filter(
            Application.status == ApplicationStatus.PENDING
        ).count(),
        shortlisted_applications=db.query(Application).filter(
            Application.status == ApplicationStatus.SHORTLISTED
        ).count(),
        rejected_applications=db.query(Application).filter(
            Application.status == ApplicationStatus.REJECTED
        ).count(),
        accepted_applications=db.query(Application).filter(
            Application.status == ApplicationStatus.ACCEPTED
        ).count()
    )

# ─────────────────────────────
# GET /recruiter/jobs
# ─────────────────────────────

@router.get("/jobs", response_model=JobOfferListResponse)
def get_job_offers(
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    query = db.query(JobOffer).filter(
        JobOffer.company_id == current_user.company_id
    )

    if is_active is not None:
        query = query.filter(JobOffer.is_active == is_active)

    if search:
        query = query.filter(
            JobOffer.title.ilike(f"%{search}%")
        )

    jobs = query.order_by(JobOffer.posted_date.desc()).all()

    return JobOfferListResponse(
        total=len(jobs),
        jobs=[JobOfferResponse.model_validate(j) for j in jobs]
    )

# ─────────────────────────────
# GET /recruiter/jobs/{id}
# ─────────────────────────────

@router.get("/jobs/{job_id}", response_model=JobOfferResponse)
def get_job_offer(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    job = db.query(JobOffer).filter(
        JobOffer.job_id == job_id,
        JobOffer.company_id == current_user.company_id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job offer not found")

    return job

# ─────────────────────────────
# PUT /recruiter/jobs/{id}
# ─────────────────────────────

@router.put("/jobs/{job_id}", response_model=JobOfferResponse)
def update_job_offer(
    job_id: str,
    payload: UpdateJobOfferRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    job = db.query(JobOffer).filter(
        JobOffer.job_id == job_id,
        JobOffer.company_id == current_user.company_id,
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job offer not found")

    if payload.title is not None:
        job.title = payload.title
    if payload.description is not None:
        job.description = payload.description
    if payload.requirements is not None:
        job.requirements = payload.requirements
    if payload.location is not None:
        job.location = payload.location
    if payload.location_type is not None:
        job.location_type = payload.location_type
    if payload.contract_type is not None:
        job.contract_type = payload.contract_type
    if payload.department is not None:
        job.department = payload.department
    if payload.experience_level is not None:
        job.experience_level = payload.experience_level
    if payload.required_skills is not None:
        job.required_skills = payload.required_skills
    if payload.salary_range is not None:
        job.salary_range = payload.salary_range

    reopening = payload.is_active is True and not job.is_active
    if payload.closing_date is not None:
        closing_dt = payload.closing_date
        if closing_dt.tzinfo is not None:
            closing_dt = closing_dt.astimezone().replace(tzinfo=None)
        validate_closing_datetime(closing_dt)
        if reopening:
            from services.job_closing_service import reopen_job_for_applications
            reopen_job_for_applications(db, job, closing_dt)
        else:
            job.closing_date = closing_dt
            job.closing_processed = False
            from services.job_closing_service import schedule_job_closing_task
            schedule_job_closing_task(closing_dt, job.job_id)
    elif reopening:
        if job.closing_date and is_closing_due(job.closing_date):
            raise HTTPException(
                status_code=400,
                detail="Closing date has passed. Set a new closing date to reopen this job.",
            )
        job.is_active = True
        job.closing_processed = False
    elif payload.is_active is not None:
        job.is_active = payload.is_active

    db.commit()
    db.refresh(job)

    save_log(
        db=db,
        action="UPDATE_JOB",
        user_id=current_user.user_id,
        user_email=current_user.email,
        details=f"Updated job: {job.title}",
        ip_address=request.client.host
    )

    return job


@router.put("/jobs/{job_id}/salary")
def edit_job_salary(
    job_id: str,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    """Update only the salary range of a job offer"""
    job = db.query(JobOffer).filter(
        JobOffer.job_id == job_id,
        JobOffer.company_id == current_user.company_id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job offer not found")

    salary_range = payload.get("salary_range", "").strip()
    if not salary_range:
        raise HTTPException(status_code=400, detail="Salary range is required")

    job.salary_range = salary_range
    db.commit()
    db.refresh(job)

    save_log(
        db=db,
        action="EDIT_JOB_SALARY",
        user_id=current_user.user_id,
        user_email=current_user.email,
        details=f"Updated salary range for job: {job.title}. New range: {salary_range}",
        ip_address=request.client.host
    )

    return job


@router.post("/jobs/{job_id}/reopen")
def reopen_job_offer(
    job_id: str,
    body: ReopenJobRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
):
    from services.job_closing_service import reopen_job_for_applications

    job = db.query(JobOffer).filter(
        JobOffer.job_id == job_id,
        JobOffer.company_id == current_user.company_id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job offer not found")

    closing_date = parse_and_validate_closing(body.new_closing_date)
    reopen_job_for_applications(db, job, closing_date)
    db.commit()
    db.refresh(job)

    save_log(
        db=db,
        action="REOPEN_JOB",
        user_id=current_user.user_id,
        user_email=current_user.email,
        details=f"Reopened job {job.title} until {closing_date.isoformat()}",
        ip_address=request.client.host,
    )

    return {
        "message": "Job reopened",
        "job_id": job.job_id,
        "job_title": job.title,
        "is_active": job.is_active,
        "closing_processed": job.closing_processed,
        "closing_date": job.closing_date.isoformat() if job.closing_date else None,
    }

# ─────────────────────────────
# DELETE /recruiter/jobs/{id}
# ─────────────────────────────

@router.delete("/jobs/{job_id}")
def delete_job_offer(
    job_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    job = db.query(JobOffer).filter(
        JobOffer.job_id == job_id,
        JobOffer.posted_by == current_user.user_id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job offer not found")

    db.delete(job)
    db.commit()

    save_log(
        db=db,
        action="DELETE_JOB",
        user_id=current_user.user_id,
        user_email=current_user.email,
        details=f"Deleted job: {job.title}",
        ip_address=request.client.host
    )

    return {"message": "Job offer deleted successfully"}

# ─────────────────────────────
# GET /recruiter/requirement-requests
# ─────────────────────────────

@router.get("/requirement-requests", response_model=RequirementRequestListForHR)
def get_requirement_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    query = db.query(RequirementRequest).filter(
        RequirementRequest.company_id == current_user.company_id
    )

    if status:
        query = query.filter(RequirementRequest.status == status)

    requests = query.order_by(
        RequirementRequest.created_at.desc()
    ).all()

    result = []
    for r in requests:
        submitter = db.query(User).filter(User.user_id == r.submitted_by).first()
        data = RequirementRequestForHR(
            request_id=r.request_id,
            submitted_by=r.submitted_by,
            submitter_name=f"{submitter.first_name} {submitter.last_name}" if submitter else "Unknown",
            company_id=r.company_id,
            title=r.title,
            description=r.description,
            requirements=r.requirements,
            required_skills=r.required_skills,
            experience_years=r.experience_years,
            experience_level=getattr(r, "experience_level", None),
            education_level=r.education_level,
            location=r.location,
            location_type=getattr(r, "location_type", None),
            languages_required=getattr(r, "languages_required", None),
            languages_other=getattr(r, "languages_other", None),
            soft_skills=getattr(r, "soft_skills", None),
            soft_skills_other=getattr(r, "soft_skills_other", None),
            certifications=getattr(r, "certifications", None),
            certifications_other=getattr(r, "certifications_other", None),
            contract_type=r.contract_type,
            department=r.department,
            salary_range=r.salary_range,
            status=r.status.value if hasattr(r.status, "value") else r.status,
            rejection_reason=r.rejection_reason,
            created_at=r.created_at,
            reviewed_at=r.reviewed_at
        )
        result.append(data)

    return RequirementRequestListForHR(
        total=len(result),
        requests=result
    )

# ─────────────────────────────
# PUT /recruiter/requirement-requests/{id}/accept
# ─────────────────────────────

@router.put("/requirement-requests/{request_id}/accept")
def accept_requirement_request(
    request_id: str,
    payload: AcceptRequirementRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    req = db.query(RequirementRequest).filter(
        RequirementRequest.request_id == request_id,
        RequirementRequest.company_id == current_user.company_id
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Requirement request not found")

    if req.status != RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="This request has already been reviewed")

    # Accept the request
    req.status = RequestStatus.ACCEPTED
    req.reviewed_by = current_user.user_id
    req.reviewed_at = datetime.utcnow()

    salary_from_hr = (payload.salary_range or "").strip()
    if not salary_from_hr:
        raise HTTPException(status_code=400, detail="Salary range is required")
    req.salary_range = salary_from_hr
    job_salary_range = salary_from_hr

    if not req.closing_date:
        raise HTTPException(status_code=400, detail="Requirement has no closing date")
    validate_closing_datetime(req.closing_date, reference=datetime.utcnow())

    company = db.query(Company).filter(
        Company.company_id == req.company_id
    ).first()
    company_name = company.name if company else "Unknown"

    # HR creates the job only after approving manager requirements
    job = JobOffer(
        job_id=str(uuid.uuid4()),
        posted_by=current_user.user_id,
        company_id=req.company_id,
        company_name=company_name,
        title=req.title,
        description=req.description,
        requirements=req.requirements,
        required_skills=req.required_skills,
        experience_years=req.experience_years,
        experience_level=_parse_experience_level(getattr(req, "experience_level", None)),
        education_level=req.education_level,
        location=req.location,
        location_type=_parse_location_type(getattr(req, "location_type", None)),
        languages_required=getattr(req, "languages_required", None),
        languages_other=getattr(req, "languages_other", None),
        soft_skills=getattr(req, "soft_skills", None),
        soft_skills_other=getattr(req, "soft_skills_other", None),
        certifications=getattr(req, "certifications", None),
        certifications_other=getattr(req, "certifications_other", None),
        contract_type=req.contract_type or "CDI",
        department=req.department,
        salary_range=job_salary_range,
        closing_date=req.closing_date  # Manager's specified closing date
    )
    
    db.add(job)
    db.flush()
    req.created_job_id = job.job_id

    # Notify the manager
    notification = Notification(
        notification_id=str(uuid.uuid4()),
        user_id=req.submitted_by,
        company_id=current_user.company_id,
        title="Requirements Approved ✅",
        message=f"Your requirements for \"{req.title}\" were approved by {current_user.first_name} {current_user.last_name}. HR has created the job offer.",
        type="REQUIREMENT_ACCEPTED",
        reference_id=request_id,
        is_read=False
    )
    db.add(notification)
    db.commit()

    if req.closing_date:
        from services.job_closing_service import schedule_job_closing_task
        schedule_job_closing_task(req.closing_date, job.job_id)

    save_log(
        db=db,
        action="ACCEPT_REQUIREMENTS",
        user_id=current_user.user_id,
        user_email=current_user.email,
        details=f"Accepted requirements and created job: {job.title}",
        ip_address=request.client.host
    )

    return {
        "message": "Requirements accepted and job offer created",
        "request_id": request_id,
        "job_id": job.job_id,
        "job_title": job.title
    }

# ─────────────────────────────
# PUT /recruiter/requirement-requests/{id}/reject
# ─────────────────────────────

@router.put("/requirement-requests/{request_id}/reject")
def reject_requirement_request(
    request_id: str,
    payload: RejectRequirementRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    req = db.query(RequirementRequest).filter(
        RequirementRequest.request_id == request_id,
        RequirementRequest.company_id == current_user.company_id
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Requirement request not found")

    if req.status != RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="This request has already been reviewed")

    # Reject the request
    req.status = RequestStatus.REJECTED
    req.rejection_reason = payload.reason
    req.reviewed_by = current_user.user_id
    req.reviewed_at = datetime.utcnow()
    db.commit()

    # Notify the manager with the rejection reason
    notification = Notification(
        notification_id=str(uuid.uuid4()),
        user_id=req.submitted_by,
        company_id=current_user.company_id,
        title="Requirements Rejected ❌",
        message=f"Your requirements for \"{req.title}\" were rejected by {current_user.first_name} {current_user.last_name}.\n\nReason: {payload.reason}",
        type="REQUIREMENT_REJECTED",
        reference_id=request_id,
        is_read=False
    )
    db.add(notification)
    db.commit()

    save_log(
        db=db,
        action="REJECT_REQUIREMENTS",
        user_id=current_user.user_id,
        user_email=current_user.email,
        details=f"Rejected requirements for job draft: {req.title}. Reason: {payload.reason}",
        ip_address=request.client.host
    )

    return {
        "message": "Requirements rejected",
        "request_id": request_id,
        "reason": payload.reason
    }

# ─────────────────────────────
# PUT /recruiter/requirement-requests/{id}/salary
# HR edits only the salary of a PENDING requirement
# ─────────────────────────────

@router.put("/requirement-requests/{request_id}/salary")
def edit_requirement_salary_as_hr(
    request_id: str,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    req = db.query(RequirementRequest).filter(
        RequirementRequest.request_id == request_id,
        RequirementRequest.company_id == current_user.company_id
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Requirement request not found")

    if req.status != RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending requirements can have salary edited")

    salary_range = payload.get("salary_range", "").strip()
    if not salary_range:
        raise HTTPException(status_code=400, detail="Salary range is required")

    req.salary_range = salary_range
    db.commit()
    db.refresh(req)

    save_log(
        db=db,
        action="EDIT_SALARY_AS_HR",
        user_id=current_user.user_id,
        user_email=current_user.email,
        details=f"Updated salary range for requirement: {req.title}. New range: {salary_range}",
        ip_address=request.client.host
    )

    return {
        "message": "Salary range updated",
        "request_id": request_id,
        "salary_range": salary_range
    }

# ─────────────────────────────
# GET /recruiter/notifications
# ─────────────────────────────

@router.get("/notifications", response_model=NotificationListResponse)
def get_recruiter_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.user_id
    ).order_by(
        Notification.created_at.desc()
    ).all()

    unread = sum(1 for n in notifications if not n.is_read)

    return NotificationListResponse(
        total=len(notifications),
        unread_count=unread,
        notifications=[NotificationResponse.model_validate(n) for n in notifications]
    )

# ─────────────────────────────
# PUT /recruiter/notifications/{id}/read
# ─────────────────────────────

@router.put("/notifications/{notification_id}/read")
def mark_recruiter_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
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

# ─────────────────────────────
# GET /recruiter/notifications/unread-count
# ─────────────────────────────

@router.get("/notifications/unread-count")
def get_recruiter_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    count = db.query(Notification).filter(
        Notification.user_id == current_user.user_id,
        Notification.is_read == False
    ).count()

    return {"unread_count": count}


# ─────────────────────────────
# DELETE /recruiter/notifications
# ─────────────────────────────

@router.delete("/notifications")
def clear_recruiter_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    deleted = db.query(Notification).filter(
        Notification.user_id == current_user.user_id
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": "Notifications cleared", "deleted": deleted}
