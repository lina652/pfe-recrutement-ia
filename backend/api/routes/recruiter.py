from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import uuid

from database import get_db
from models.user import User, UserRole
from models.job_offer import JobOffer
from models.application import Application, ApplicationStatus
from models.candidate import Candidate
from models.log import Log
from models.company import Company
from models.requirement_request import RequirementRequest, RequestStatus
from models.notification import Notification
from core.dependencies import require_role
from schemas.recruiter import (
    CreateJobOfferRequest,
    UpdateJobOfferRequest,
    JobOfferResponse,
    JobOfferListResponse,
    ApplicationResponse,
    ApplicationListResponse,
    OverrideRequest,
    RecruiterStats,
    RequirementRequestForHR,
    RequirementRequestListForHR,
    RejectRequirementRequest
)
from schemas.notification import NotificationResponse, NotificationListResponse

router = APIRouter(
    prefix="/recruiter",
    tags=["Recruiter / HR"]
)

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
# POST /recruiter/jobs
# ─────────────────────────────

@router.post("/jobs", response_model=JobOfferResponse, status_code=201)
def create_job_offer(
    payload: CreateJobOfferRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    company = db.query(Company).filter(
        Company.company_id == current_user.company_id
    ).first()
    company_name = company.name if company else "Unknown"

    job = JobOffer(
        job_id=str(uuid.uuid4()),
        posted_by=current_user.user_id,
        company_id=current_user.company_id,
        company_name=company_name,
        title=payload.title,
        description=payload.description,
        requirements=payload.requirements,
        location=payload.location,
        location_type=payload.location_type,
        contract_type=payload.contract_type,
        department=payload.department,
        experience_level=payload.experience_level,
        required_skills=payload.required_skills,
        salary_range=payload.salary_range,
        closing_date=payload.closing_date
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    save_log(
        db=db,
        action="CREATE_JOB",
        user_id=current_user.user_id,
        user_email=current_user.email,
        details=f"Created job: {payload.title}",
        ip_address=request.client.host
    )

    return job

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
        JobOffer.posted_by == current_user.user_id
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
    if payload.closing_date is not None:
        job.closing_date = payload.closing_date
    if payload.is_active is not None:
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
# GET /recruiter/applications
# ─────────────────────────────

@router.get("/applications", response_model=ApplicationListResponse)
def get_applications(
    job_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    # Only show applications for this company's jobs
    company_job_ids = [
        j.job_id for j in db.query(JobOffer).filter(
            JobOffer.company_id == current_user.company_id
        ).all()
    ]

    query = db.query(Application).filter(
        Application.job_id.in_(company_job_ids)
    )

    if job_id:
        query = query.filter(Application.job_id == job_id)

    if status:
        query = query.filter(Application.status == status)

    applications = query.order_by(
        Application.submission_date.desc()
    ).all()

    job_ids = [a.job_id for a in applications]
    candidate_ids = [a.candidate_id for a in applications]
    jobs = db.query(JobOffer).filter(JobOffer.job_id.in_(job_ids)).all() if job_ids else []
    candidates = db.query(Candidate).filter(Candidate.candidate_id.in_(candidate_ids)).all() if candidate_ids else []

    job_map = {j.job_id: j for j in jobs}
    candidate_map = {c.candidate_id: c for c in candidates}
    user_ids = [c.user_id for c in candidates if c.user_id]
    users = db.query(User).filter(User.user_id.in_(user_ids)).all() if user_ids else []
    user_map = {u.user_id: u for u in users}

    enriched = []
    for app in applications:
        job = job_map.get(app.job_id)
        candidate = candidate_map.get(app.candidate_id)
        user = user_map.get(candidate.user_id) if candidate else None
        row = ApplicationResponse.model_validate(app).model_dump()
        row["job_title"] = job.title if job else None
        row["company_name"] = job.company_name if job else None
        row["candidate_name"] = f"{user.first_name} {user.last_name}".strip() if user else None
        enriched.append(ApplicationResponse.model_validate(row))

    return ApplicationListResponse(
        total=len(enriched),
        applications=enriched
    )

# ─────────────────────────────
# GET /recruiter/applications/{id}
# ─────────────────────────────

@router.get("/applications/{app_id}", response_model=ApplicationResponse)
def get_application(
    app_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    application = db.query(Application).filter(
        Application.app_id == app_id
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    return application

# ─────────────────────────────
# PUT /recruiter/applications/{id}/override
# ─────────────────────────────

@router.put("/applications/{app_id}/override")
def override_ai_decision(
    app_id: str,
    payload: OverrideRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    application = db.query(Application).filter(
        Application.app_id == app_id
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    old_status = application.status
    application.status = payload.status
    application.hr_override = True
    application.hr_override_reason = payload.reason
    application.last_updated = datetime.utcnow()
    db.commit()

    save_log(
        db=db,
        action="OVERRIDE_AI_DECISION",
        user_id=current_user.user_id,
        user_email=current_user.email,
        details=f"Override app {app_id} from {old_status} to {payload.status}. Reason: {payload.reason}",
        ip_address=request.client.host
    )

    return {
        "message": "AI decision overridden successfully",
        "app_id": app_id,
        "old_status": old_status,
        "new_status": payload.status,
        "reason": payload.reason
    }

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
            education_level=r.education_level,
            location=r.location,
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
        education_level=req.education_level,
        location=req.location,
        contract_type=req.contract_type or "CDI",
        department=req.department,
        salary_range=req.salary_range,
        closing_date=req.closing_date  # Manager's specified closing date
    )
    
    # Schedule the job closing task when closing_date is set
    if req.closing_date:
        from tasks.cv_tasks import process_job_closing
        process_job_closing.apply_async(args=[job.job_id], eta=req.closing_date)
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
