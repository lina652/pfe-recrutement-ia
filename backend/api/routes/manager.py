from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from core.closing_date import parse_and_validate_closing
import uuid

from database import get_db
from models.user import User, UserRole
from models.job_offer import JobOffer
from models.application import Application, ApplicationStatus
from models.candidate import Candidate
from models.log import Log
from models.requirement_request import RequirementRequest, RequestStatus
from models.notification import Notification
from core.dependencies import require_role
from schemas.manager import (
    SubmitRequirementsRequest,
    JobOfferResponse,
    JobOfferListResponse,
    CandidateApplicationResponse,
    CandidateListResponse,
    FinalSelectionRequest,
    FinalSelectionJobItem,
    FinalSelectionJobListResponse,
    FinalSelectionJobDetailResponse,
    FinalSelectionCandidateItem,
    ReopenJobRequest,
    ManagerStats,
    RequirementRequestResponse,
    RequirementRequestListResponse
)
from schemas.notification import NotificationResponse, NotificationListResponse

router = APIRouter(
    prefix="/manager",
    tags=["Hiring Manager"]
)

def save_log(db, action, user_id=None, user_email=None,
             company_id=None, details=None, ip_address=None):
    log = Log(
        user_id=user_id,
        user_email=user_email,
        company_id=company_id,
        action=action,
        details=details,
        ip_address=ip_address
    )
    db.add(log)
    db.commit()

# ─────────────────────────────
# GET /manager/stats
# ─────────────────────────────

@router.get("/stats", response_model=ManagerStats)
def get_manager_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER))
):
    pending_reqs = db.query(RequirementRequest).filter(
        RequirementRequest.submitted_by == current_user.user_id,
        RequirementRequest.status == RequestStatus.PENDING
    ).count()

    return ManagerStats(
        total_jobs=db.query(JobOffer).filter(
            JobOffer.company_id == current_user.company_id
        ).count(),
        active_jobs=db.query(JobOffer).filter(
            JobOffer.company_id == current_user.company_id,
            JobOffer.is_active == True
        ).count(),
        total_shortlisted=db.query(Application).filter(
            Application.status == ApplicationStatus.SHORTLISTED
        ).count(),
        total_accepted=db.query(Application).filter(
            Application.status == ApplicationStatus.ACCEPTED
        ).count(),
        total_rejected=db.query(Application).filter(
            Application.status == ApplicationStatus.REJECTED
        ).count(),
        pending_review=db.query(Application).filter(
            Application.status == ApplicationStatus.UNDER_REVIEW
        ).count(),
        pending_requests=pending_reqs
    )

# ─────────────────────────────
# POST /manager/submit-requirements
# Manager writes a new job from scratch
# ─────────────────────────────

@router.post("/submit-requirements")
def submit_requirements(
    payload: SubmitRequirementsRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER))
):
    closing_date_dt = parse_and_validate_closing(payload.closing_date)

    # Create the requirement request
    req = RequirementRequest(
        request_id=str(uuid.uuid4()),
        submitted_by=current_user.user_id,
        company_id=current_user.company_id,
        title=payload.title,
        description=payload.description,
        requirements=payload.requirements,
        required_skills=payload.required_skills,
        experience_years=payload.experience_years if payload.experience_years is not None else None,
        experience_level=payload.experience_level,
        education_level=payload.education_level,
        location=payload.location,
        location_type=payload.location_type,
        languages_required=payload.languages_required,
        languages_other=payload.languages_other,
        soft_skills=payload.soft_skills,
        soft_skills_other=payload.soft_skills_other,
        certifications=payload.certifications,
        certifications_other=payload.certifications_other,
        contract_type=payload.contract_type or "CDI",
        department=payload.department,
        closing_date=closing_date_dt,
        status=RequestStatus.PENDING
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    # Notify every active recruiter in the same company
    hr_users = db.query(User).filter(
        User.company_id == current_user.company_id,
        User.role == UserRole.RECRUITER,
        User.is_active == True
    ).all()

    if hr_users:
        manager_name = f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email
        notification_title = "Requirement Request Submitted"
        notification_message = (
            f"{manager_name} submitted a requirement request for \"{payload.title}\". "
            "Please consult the Requirement Requests section in your dashboard."
        )
        for hr_user in hr_users:
            notification = Notification(
                notification_id=str(uuid.uuid4()),
                user_id=hr_user.user_id,
                company_id=current_user.company_id,
                title=notification_title,
                message=notification_message,
                type="REQUIREMENT_SUBMITTED",
                reference_id=req.request_id,
                is_read=False
            )
            db.add(notification)
        db.commit()

    save_log(
        db=db,
        action="SUBMIT_REQUIREMENTS",
        user_id=current_user.user_id,
        user_email=current_user.email,
        company_id=current_user.company_id,
        details=f"Submitted job requirements: {payload.title} (awaiting HR approval)",
        ip_address=request.client.host
    )

    return {
        "message": "Job requirements sent to HR for approval",
        "request_id": req.request_id,
        "title": payload.title,
        "status": "PENDING"
    }

# ─────────────────────────────
# PUT /manager/requirement-requests/{id}
# Manager edits a PENDING requirement
# ─────────────────────────────

@router.put("/requirement-requests/{request_id}")
def edit_requirement_request(
    request_id: str,
    payload: SubmitRequirementsRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER))
):
    req = db.query(RequirementRequest).filter(
        RequirementRequest.request_id == request_id,
        RequirementRequest.submitted_by == current_user.user_id
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Requirement request not found")

    if req.status != RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending requests can be edited")

    closing_date_dt = parse_and_validate_closing(payload.closing_date)

    # Update the requirement request
    req.title = payload.title
    req.description = payload.description
    req.requirements = payload.requirements
    req.required_skills = payload.required_skills
    req.experience_years = payload.experience_years if payload.experience_years is not None else None
    req.experience_level = payload.experience_level
    req.education_level = payload.education_level
    req.location = payload.location
    req.location_type = payload.location_type
    req.languages_required = payload.languages_required
    req.languages_other = payload.languages_other
    req.soft_skills = payload.soft_skills
    req.soft_skills_other = payload.soft_skills_other
    req.certifications = payload.certifications
    req.certifications_other = payload.certifications_other
    req.contract_type = payload.contract_type or "CDI"
    req.department = payload.department
    req.closing_date = closing_date_dt

    db.commit()
    db.refresh(req)

    save_log(
        db=db,
        action="EDIT_REQUIREMENTS",
        user_id=current_user.user_id,
        user_email=current_user.email,
        company_id=current_user.company_id,
        details=f"Edited pending job requirements: {payload.title}",
        ip_address=request.client.host
    )

    return {
        "message": "Job requirements updated",
        "request_id": request_id,
        "title": payload.title,
        "status": "PENDING"
    }

# ─────────────────────────────
# GET /manager/requirement-requests
# ─────────────────────────────

@router.get("/requirement-requests", response_model=RequirementRequestListResponse)
def get_my_requirement_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER))
):
    query = db.query(RequirementRequest).filter(
        RequirementRequest.submitted_by == current_user.user_id
    )

    if status:
        query = query.filter(RequirementRequest.status == status)

    requests = query.order_by(
        RequirementRequest.created_at.desc()
    ).all()

    result = []
    for r in requests:
        data = RequirementRequestResponse.model_validate(r)
        result.append(data)

    return RequirementRequestListResponse(
        total=len(result),
        requests=result
    )

# ─────────────────────────────
# GET /manager/jobs
# ─────────────────────────────

@router.get("/jobs", response_model=JobOfferListResponse)
def get_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER))
):
    jobs = db.query(JobOffer).filter(
        JobOffer.company_id == current_user.company_id
    ).order_by(
        JobOffer.posted_date.desc()
    ).all()

    return JobOfferListResponse(
        total=len(jobs),
        jobs=[JobOfferResponse.model_validate(j) for j in jobs]
    )

# ─────────────────────────────
# GET /manager/notifications
# ─────────────────────────────

@router.get("/notifications", response_model=NotificationListResponse)
def get_manager_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER))
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
# PUT /manager/notifications/{id}/read
# ─────────────────────────────

@router.put("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER))
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
# GET /manager/notifications/unread-count
# ─────────────────────────────

@router.get("/notifications/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER))
):
    count = db.query(Notification).filter(
        Notification.user_id == current_user.user_id,
        Notification.is_read == False
    ).count()

    return {"unread_count": count}


@router.delete("/notifications")
def clear_manager_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER))
):
    deleted = db.query(Notification).filter(
        Notification.user_id == current_user.user_id
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": "Notifications cleared", "deleted": deleted}

# ─────────────────────────────
# GET /manager/applications
# ─────────────────────────────

@router.get("/applications", response_model=CandidateListResponse)
def get_all_applications(
    status: Optional[str] = None,
    job_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER))
):
    query = db.query(Application)

    if status:
        query = query.filter(Application.status == status)

    if job_id:
        query = query.filter(Application.job_id == job_id)

    applications = query.order_by(
        Application.submission_date.desc()
    ).all()

    return CandidateListResponse(
        total=len(applications),
        applications=[
            CandidateApplicationResponse.model_validate(a)
            for a in applications
        ]
    )

# ─────────────────────────────
# GET /manager/final-selection/jobs
# ─────────────────────────────

@router.get("/final-selection/jobs", response_model=FinalSelectionJobListResponse)
def list_final_selection_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER)),
):
    from services.final_selection_service import list_manager_final_selection_jobs

    rows = list_manager_final_selection_jobs(
        db, current_user.user_id, current_user.company_id
    )
    items = [FinalSelectionJobItem(**row) for row in rows]
    items.sort(
        key=lambda j: (
            not j.ready_for_selection,
            j.title.lower(),
            (j.subtitle or "").lower(),
        )
    )
    return FinalSelectionJobListResponse(total=len(items), jobs=items)


# ─────────────────────────────
# GET /manager/final-selection/{job_id}
# ─────────────────────────────

@router.get("/final-selection/{job_id}", response_model=FinalSelectionJobDetailResponse)
def get_final_selection_for_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER)),
):
    from services.final_selection_service import manager_job_ids, get_final_selection_candidates

    if job_id not in manager_job_ids(db, current_user.user_id, current_user.company_id):
        raise HTTPException(status_code=404, detail="Job not found")

    job = db.query(JobOffer).filter(
        JobOffer.job_id == job_id,
        JobOffer.company_id == current_user.company_id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    data = get_final_selection_candidates(db, job_id)
    if data.get("error") == "job_not_found":
        raise HTTPException(status_code=404, detail="Job not found")

    from schemas.manager import ShortlistedPreviewItem

    return FinalSelectionJobDetailResponse(
        job_id=data["job_id"],
        title=data["title"],
        ready=data["ready"],
        message=data.get("message"),
        pending_interviews=data.get("pending_interviews", 0),
        total_shortlisted=data.get("total_shortlisted", 0),
        shortlisted_preview=[
            ShortlistedPreviewItem(**p) for p in data.get("shortlisted_preview", [])
        ],
        candidates=[FinalSelectionCandidateItem(**c) for c in data.get("candidates", [])],
    )


# ─────────────────────────────
# POST /manager/select
# ─────────────────────────────

@router.post("/select")
def make_final_selection(
    payload: FinalSelectionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER))
):
    from services.selection_notification_service import notify_application_decision

    application = db.query(Application).filter(
        Application.app_id == payload.app_id
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    job = db.query(JobOffer).filter(JobOffer.job_id == application.job_id).first()
    if not job or job.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized for this application")

    if application.status != ApplicationStatus.SHORTLISTED:
        raise HTTPException(
            status_code=400,
            detail="Only shortlisted candidates can be selected"
        )

    application.status = ApplicationStatus.ACCEPTED
    application.last_updated = datetime.utcnow()

    accepted_candidate = db.query(Candidate).filter(
        Candidate.candidate_id == application.candidate_id
    ).first()

    if accepted_candidate and job:
        notify_application_decision(
            db,
            application=application,
            job=job,
            candidate=accepted_candidate,
            decision="ACCEPTED",
        )

    other_applications = db.query(Application).filter(
        Application.job_id == application.job_id,
        Application.app_id != payload.app_id,
        Application.status == ApplicationStatus.SHORTLISTED
    ).all()

    for other in other_applications:
        other.status = ApplicationStatus.REJECTED
        other.last_updated = datetime.utcnow()
        
        # Get rejected candidate info
        rejected_candidate = db.query(Candidate).filter(
            Candidate.candidate_id == other.candidate_id
        ).first()
        
        if rejected_candidate and job:
            notify_application_decision(
                db,
                application=other,
                job=job,
                candidate=rejected_candidate,
                decision="REJECTED",
            )

    if job:
        job.is_active = False

    db.commit()

    save_log(
        db=db,
        action="FINAL_SELECTION",
        user_id=current_user.user_id,
        user_email=current_user.email,
        details=f"Selected candidate {payload.app_id} for job {application.job_id}",
        ip_address=request.client.host
    )

    return {
        "message": "Final selection made successfully",
        "accepted_app_id": payload.app_id,
        "rejected_count": len(other_applications),
        "job_closed": True
    }

# ─────────────────────────────
# POST /manager/request-more
# ─────────────────────────────

@router.post("/request-more/{job_id}")
def request_more_candidates(
    job_id: str,
    body: ReopenJobRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER))
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
        action="REQUEST_MORE_CANDIDATES",
        user_id=current_user.user_id,
        user_email=current_user.email,
        company_id=current_user.company_id,
        details=f"Requested more candidates for job: {job.title} with new closing date: {closing_date.isoformat()}",
        ip_address=request.client.host
    )

    return {
        "message": "Job reopened — more candidates can now apply",
        "job_id": job_id,
        "job_title": job.title,
        "is_active": job.is_active,
        "closing_processed": job.closing_processed,
        "new_closing_date": job.closing_date.isoformat() if job.closing_date else None,
    }
