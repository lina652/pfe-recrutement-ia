from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
import uuid

from database import get_db
from sqlalchemy import func, or_
from core.email_utils import normalize_email
from models.user import User, UserRole
from models.invitation import Invitation, InvitationStatus
from models.log import Log
from models.report import Report
from core.dependencies import require_role
from schemas.admin import (
    InviteRequest, InviteResponse,
    SetPasswordRequest,
    UserListResponse, UserListItem,
    ChangeRoleRequest, ToggleUserResponse,
    LogListResponse, LogItem,
    GenerateReportRequest, ReportListResponse,
    ReportItem, DashboardStats
)
from models.company import Company
from core.config import settings
from services.mailer import send_staff_invitation_email
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Administrator"])

STAFF_ROLES = (
    UserRole.RECRUITER,
    UserRole.HIRING_MANAGER,
    UserRole.ADMINISTRATOR,
)


def _apply_user_search(query, search: Optional[str]):
    """Match name/email; strip whitespace and support multi-word queries."""
    term = (search or "").strip()
    if not term:
        return query
    tokens = [part for part in term.split() if part]
    if not tokens:
        return query
    full_name = func.concat(
        func.coalesce(User.first_name, ""),
        " ",
        func.coalesce(User.last_name, ""),
    )
    for token in tokens:
        pattern = f"%{token}%"
        query = query.filter(
            or_(
                User.email.ilike(pattern),
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                full_name.ilike(pattern),
            )
        )
    return query


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

@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMINISTRATOR))
):
    cf = User.company_id == current_user.company_id
    staff_cf = (cf, User.role.in_(STAFF_ROLES))
    total_staff = db.query(User).filter(*staff_cf).count()
    active_staff = db.query(User).filter(*staff_cf, User.is_active == True).count()
    inactive_staff = total_staff - active_staff
    return DashboardStats(
        total_users=db.query(User).filter(cf).count(),
        total_candidates=db.query(User).filter(cf, User.role == UserRole.CANDIDATE).count(),
        total_recruiters=db.query(User).filter(cf, User.role == UserRole.RECRUITER).count(),
        total_hiring_managers=db.query(User).filter(cf, User.role == UserRole.HIRING_MANAGER).count(),
        total_admins=db.query(User).filter(cf, User.role == UserRole.ADMINISTRATOR).count(),
        active_users=db.query(User).filter(cf, User.is_active == True).count(),
        inactive_users=db.query(User).filter(cf, User.is_active == False).count(),
        total_staff=total_staff,
        active_staff=active_staff,
        inactive_staff=inactive_staff,
        total_logs=db.query(Log).filter(Log.company_id == current_user.company_id).count(),
        total_reports=db.query(Report).filter(Report.company_id == current_user.company_id).count()
    )

@router.post("/invite", response_model=InviteResponse, status_code=201)
def invite_staff(
    payload: InviteRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMINISTRATOR))
):
    norm_email = normalize_email(payload.email)
    if not norm_email:
        raise HTTPException(status_code=400, detail="Invalid email")

    existing = db.query(User).filter(func.lower(User.email) == norm_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    pending = db.query(Invitation).filter(
        Invitation.email == norm_email,
        Invitation.is_used == False,
        Invitation.expires_at > datetime.utcnow()
    ).first()
    if pending:
        raise HTTPException(status_code=400, detail="Active invitation already exists")

    user = User(
        user_id=str(uuid.uuid4()),
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=norm_email,
        password_hash="",
        role=UserRole(payload.role.value),
        is_active=False,
        company_id=current_user.company_id  # ← inherit company
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=3)

    invitation = Invitation(
        invitation_id=str(uuid.uuid4()),
        created_by=current_user.user_id,
        company_id=current_user.company_id,  # ← add company_id
        email=norm_email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=payload.role.value,
        token=token,
        expires_at=expires_at
    )
    db.add(invitation)
    db.commit()

    save_log(
        db=db,
        action="INVITE_STAFF",
        user_id=current_user.user_id,
        user_email=current_user.email,
        company_id=current_user.company_id,
        details=f"Invited {norm_email} as {payload.role.value}",
        ip_address=request.client.host
    )

    company = db.query(Company).filter(
        Company.company_id == current_user.company_id
    ).first()
    company_name = company.name if company else settings.APP_NAME
    invite_link = f"{settings.FRONTEND_URL.rstrip('/')}/staff/activate?token={token}"
    inviter_name = f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email

    email_sent = send_staff_invitation_email(
        norm_email,
        first_name=payload.first_name,
        invite_link=invite_link,
        role=payload.role.value,
        company_name=company_name,
        invited_by=inviter_name,
        expires_days=3,
    )

    if not email_sent:
        logger.warning(
            "Staff invitation created for %s but email was not delivered (check SMTP / Mailtrap).",
            norm_email,
        )
        print(f"\n📧 INVITATION (email not sent — SMTP issue or not configured)")
        print(f"   Email: {norm_email}")
        print(f"   Token: {token}")
        print(f"   Activate: {invite_link}\n")

    if email_sent:
        message = f"Invitation email sent to {norm_email}"
    elif settings.SMTP_HOST:
        message = (
            f"Invitation created for {norm_email}, but the email could not be delivered. "
            "Check SMTP settings."
        )
    else:
        message = (
            f"Invitation created for {norm_email}. Configure SMTP in .env to send emails."
        )

    return InviteResponse(
        message=message,
        email=norm_email,
        role=payload.role,
        expires_at=expires_at,
        email_sent=email_sent,
    )

@router.post("/set-password")
def set_password_from_invitation(
    payload: SetPasswordRequest,
    db: Session = Depends(get_db)
):
    token = payload.token
    password = payload.password
    invitation = db.query(Invitation).filter(
        Invitation.token == token,
        Invitation.is_used == False
    ).first()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid or already used token")

    if invitation.expires_at < datetime.utcnow():
        invitation.status = InvitationStatus.EXPIRED
        db.commit()
        raise HTTPException(status_code=400, detail="Token has expired")

    inv_email = normalize_email(invitation.email)
    user = db.query(User).filter(func.lower(User.email) == inv_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from core.security import hash_password
    user.password_hash = hash_password(password)
    user.is_active = True
    invitation.is_used = True
    invitation.status = InvitationStatus.ACCEPTED
    db.commit()

    return {
        "message": "Password set successfully. You can now login.",
        "email": user.email,
        "role": user.role
    }

@router.get("/users", response_model=UserListResponse)
def list_users(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMINISTRATOR))
):
    # Always filter by company first
    query = db.query(User).filter(
        User.company_id == current_user.company_id
    )

    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    query = _apply_user_search(query, search)

    users = query.order_by(User.created_at.desc()).all()
    return UserListResponse(
        total=len(users),
        users=[UserListItem.model_validate(u) for u in users]
    )

@router.put("/users/{user_id}/toggle", response_model=ToggleUserResponse)
def toggle_user_status(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMINISTRATOR))
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    if user.role == UserRole.ADMINISTRATOR and user.is_active:
        admin_count = db.query(User).filter(
            User.role == UserRole.ADMINISTRATOR,
            User.is_active == True,
            User.company_id == current_user.company_id
        ).count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot deactivate the last active administrator")

    user.is_active = not user.is_active
    db.commit()

    action = "ACTIVATE_USER" if user.is_active else "DEACTIVATE_USER"
    save_log(
        db=db,
        action=action,
        user_id=current_user.user_id,
        user_email=current_user.email,
        company_id=current_user.company_id,
        details=f"{action} for {user.email}",
        ip_address=request.client.host
    )

    return ToggleUserResponse(
        message="User activated" if user.is_active else "User deactivated",
        user_id=user.user_id,
        is_active=user.is_active
    )

@router.put("/users/{user_id}/role")
def change_user_role(
    user_id: str,
    payload: ChangeRoleRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMINISTRATOR))
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    old_role = user.role
    user.role = UserRole(payload.role.value)
    db.commit()

    save_log(
        db=db,
        action="CHANGE_ROLE",
        user_id=current_user.user_id,
        user_email=current_user.email,
        company_id=current_user.company_id,
        details=f"Changed {user.email} from {old_role} to {payload.role}",
        ip_address=request.client.host
    )

    return {
        "message": "Role updated",
        "user_id": user.user_id,
        "old_role": old_role,
        "new_role": user.role
    }

@router.get("/logs", response_model=LogListResponse)
def get_logs(
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMINISTRATOR))
):
    query = db.query(Log).filter(
        Log.company_id == current_user.company_id
    )
    if search:
        query = query.filter(
            Log.action.ilike(f"%{search}%") |
            Log.user_email.ilike(f"%{search}%")
        )
    total = query.count()
    logs = query.order_by(Log.timestamp.desc()).offset(offset).limit(limit).all()
    return LogListResponse(total=total, logs=[LogItem.model_validate(l) for l in logs])

@router.get("/reports", response_model=ReportListResponse)
def get_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMINISTRATOR))
):
    reports = db.query(Report).filter(
        Report.company_id == current_user.company_id
    ).order_by(Report.generated_at.desc()).all()
    return ReportListResponse(
        total=len(reports),
        reports=[ReportItem.model_validate(r) for r in reports]
    )

@router.post("/reports", response_model=ReportItem, status_code=201)
def generate_report(
    payload: GenerateReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMINISTRATOR))
):
    cf = User.company_id == current_user.company_id
    import json
    content = json.dumps({
        "generated_at": datetime.utcnow().isoformat(),
        "generated_by": current_user.email,
        "company_id": current_user.company_id,
        "total_users": db.query(User).filter(cf).count(),
        "total_recruiters": db.query(User).filter(cf, User.role == UserRole.RECRUITER).count(),
        "total_hiring_managers": db.query(User).filter(cf, User.role == UserRole.HIRING_MANAGER).count(),
        "active_users": db.query(User).filter(cf, User.is_active == True).count(),
    }, indent=2)

    report = Report(
        report_id=str(uuid.uuid4()),
        title=payload.title,
        generated_by=current_user.user_id,
        company_id=current_user.company_id,
        content=content,
        format=payload.format
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    save_log(
        db=db,
        action="GENERATE_REPORT",
        user_id=current_user.user_id,
        user_email=current_user.email,
        company_id=current_user.company_id,
        details=f"Generated report: {payload.title}"
    )

    return ReportItem.model_validate(report)