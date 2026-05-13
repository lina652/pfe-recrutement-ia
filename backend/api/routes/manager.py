from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import uuid

from database import get_db
from models.user import User, UserRole
from models.job_offer import JobOffer
from models.application import Application, ApplicationStatus
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
    # Parse closing_date
    closing_date_dt = None
    if payload.closing_date:
        try:
            closing_date_dt = datetime.strptime(payload.closing_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid closing_date format. Use YYYY-MM-DD")

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
        education_level=payload.education_level,
        location=payload.location,
        contract_type=payload.contract_type or "CDI",
        department=payload.department,
        closing_date=closing_date_dt,
        status=RequestStatus.PENDING
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    # Find the HR user in the same company
    hr_user = db.query(User).filter(
        User.company_id == current_user.company_id,
        User.role == UserRole.RECRUITER,
        User.is_active == True
    ).first()

    if hr_user:
        notification = Notification(
            notification_id=str(uuid.uuid4()),
            user_id=hr_user.user_id,
            company_id=current_user.company_id,
            title="New Job Requirements Submitted",
            message=f"{current_user.first_name} {current_user.last_name} submitted job requirements for \"{payload.title}\". Please review and approve or reject.",
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

# ─────────────────────────────
# GET /manager/shortlisted
# ─────────────────────────────

@router.get("/shortlisted", response_model=CandidateListResponse)
def get_shortlisted_candidates(
    job_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER))
):
    query = db.query(Application).filter(
        Application.status == ApplicationStatus.SHORTLISTED
    )

    if job_id:
        query = query.filter(Application.job_id == job_id)

    applications = query.order_by(
        Application.final_score.desc()
    ).all()

    return CandidateListResponse(
        total=len(applications),
        applications=[
            CandidateApplicationResponse.model_validate(a)
            for a in applications
        ]
    )

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
# POST /manager/select
# ─────────────────────────────

@router.post("/select")
def make_final_selection(
    payload: FinalSelectionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER))
):
    from tasks.notification_tasks import send_decision_email_async
    
    application = db.query(Application).filter(
        Application.app_id == payload.app_id
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if application.status != ApplicationStatus.SHORTLISTED:
        raise HTTPException(
            status_code=400,
            detail="Only shortlisted candidates can be selected"
        )

    application.status = ApplicationStatus.ACCEPTED
    application.last_updated = datetime.utcnow()

    job = db.query(JobOffer).filter(
        JobOffer.job_id == application.job_id
    ).first()
    
    # Get accepted candidate info for notification
    accepted_candidate = db.query(Candidate).filter(
        Candidate.candidate_id == application.candidate_id
    ).first()
    
    # Create acceptance notification
    if accepted_candidate:
        acceptance_notification = Notification(
            notification_id=str(uuid.uuid4()),
            user_id=accepted_candidate.user_id,
            company_id=job.company_id if job else None,
            title="🎉 Congratulations! You've Been Selected!",
            message=f"Great news! You have been selected for the position of {job.title if job else 'the job'} at {job.company_name if job else 'our company'}. Our HR team will contact you shortly with next steps. Congratulations on your success!",
            type="APPLICATION_ACCEPTED",
            reference_id=application.app_id,
            is_read=False
        )
        db.add(acceptance_notification)
        
        # Queue acceptance email
        send_decision_email_async.delay(
            accepted_candidate.user_id, 
            application.app_id, 
            "ACCEPTED",
            job.title if job else "Unknown Position",
            job.company_name if job else "Unknown Company"
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
        
        if rejected_candidate:
            # Create rejection notification
            rejection_notification = Notification(
                notification_id=str(uuid.uuid4()),
                user_id=rejected_candidate.user_id,
                company_id=job.company_id if job else None,
                title="Application Update",
                message=f"Thank you for your interest in the {job.title if job else 'job'} position at {job.company_name if job else 'our company'}. After careful consideration, we have decided to move forward with another candidate. We appreciate your time and encourage you to apply for future opportunities.",
                type="APPLICATION_REJECTED",
                reference_id=other.app_id,
                is_read=False
            )
            db.add(rejection_notification)
            
            # Queue rejection email
            send_decision_email_async.delay(
                rejected_candidate.user_id,
                other.app_id,
                "REJECTED",
                job.title if job else "Unknown Position",
                job.company_name if job else "Unknown Company"
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
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.HIRING_MANAGER))
):
    job = db.query(JobOffer).filter(
        JobOffer.job_id == job_id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job offer not found")

    job.is_active = True
    db.commit()

    save_log(
        db=db,
        action="REQUEST_MORE_CANDIDATES",
        user_id=current_user.user_id,
        user_email=current_user.email,
        details=f"Requested more candidates for job: {job.title}",
        ip_address=request.client.host
    )

    return {
        "message": "Job reopened — more candidates can now apply",
        "job_id": job_id,
        "job_title": job.title
    }
