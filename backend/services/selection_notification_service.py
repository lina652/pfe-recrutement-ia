"""
In-app notifications and emails when a manager makes final candidate selection.
"""
import logging
import uuid
from typing import Literal, Optional, Tuple

from sqlalchemy.orm import Session

from core.config import settings
from models.application import Application
from models.candidate import Candidate
from models.job_offer import JobOffer
from models.notification import Notification
from models.user import User
from services.mailer import send_email

logger = logging.getLogger(__name__)

Decision = Literal["ACCEPTED", "REJECTED"]


def build_decision_email(
    first_name: str,
    decision: Decision,
    job_title: str,
    company_name: str,
) -> Tuple[str, str, str]:
    """Return (subject, plain body, html body) for acceptance or rejection."""
    if decision == "ACCEPTED":
        subject = f"Congratulations! You've Been Selected for {job_title} | {settings.APP_NAME}"
        body = (
            f"Hello {first_name},\n\n"
            f"Congratulations! You have been selected for the position of {job_title} "
            f"at {company_name}.\n\n"
            f"Our HR team will contact you shortly with next steps.\n\n"
            f"Best regards,\n{settings.APP_NAME}"
        )
        html_body = f"""<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#16a34a,#22c55e);padding:30px;border-radius:12px 12px 0 0;">
            <h1 style="color:white;margin:0;">{settings.APP_NAME}</h1>
        </div>
        <div style="padding:30px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <p>Hello <strong>{first_name}</strong>,</p>
            <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
                <p style="font-size:22px;margin:0;color:#16a34a;font-weight:bold;">Congratulations!</p>
                <p style="color:#166534;margin-top:8px;">You have been selected</p>
            </div>
            <p>You have been selected for <strong>{job_title}</strong> at <strong>{company_name}</strong>.</p>
            <p>Our HR team will contact you shortly with next steps.</p>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;"/>
            <p style="color:#9ca3af;font-size:12px;">Best regards,<br/>{settings.APP_NAME}</p>
        </div>
        </body></html>"""
        return subject, body, html_body

    subject = f"Application Update for {job_title} | {settings.APP_NAME}"
    body = (
        f"Hello {first_name},\n\n"
        f"Thank you for your interest in the {job_title} position at {company_name}.\n\n"
        f"After careful consideration, we have decided to move forward with another candidate.\n\n"
        f"We encourage you to apply for future opportunities.\n\n"
        f"Best regards,\n{settings.APP_NAME}"
    )
    html_body = f"""<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#7B5AC8,#9683EC);padding:30px;border-radius:12px 12px 0 0;">
        <h1 style="color:white;margin:0;">{settings.APP_NAME}</h1>
    </div>
    <div style="padding:30px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <p>Hello <strong>{first_name}</strong>,</p>
        <p>Thank you for your interest in <strong>{job_title}</strong> at <strong>{company_name}</strong>.</p>
        <p>After careful consideration, we have decided to move forward with another candidate.</p>
        <p>We encourage you to apply for future opportunities that match your profile.</p>
        <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;"/>
        <p style="color:#9ca3af;font-size:12px;">Best regards,<br/>{settings.APP_NAME}</p>
    </div>
    </body></html>"""
    return subject, body, html_body


def send_decision_email(
    user: User,
    decision: Decision,
    job_title: str,
    company_name: str,
) -> bool:
    if not user.email:
        logger.warning("No email for user %s — skipping decision email", user.user_id)
        return False
    subject, body, html = build_decision_email(
        user.first_name or "Candidate",
        decision,
        job_title,
        company_name,
    )
    sent = send_email(user.email, subject, body, html=html)
    if sent:
        logger.info("Decision email (%s) sent to %s", decision, user.email)
    else:
        logger.warning("Decision email (%s) not sent to %s (check SMTP)", decision, user.email)
    return sent


def notify_application_decision(
    db: Session,
    *,
    application: Application,
    job: JobOffer,
    candidate: Candidate,
    decision: Decision,
) -> Optional[Notification]:
    """Create platform notification and send email for acceptance or rejection."""
    user = db.query(User).filter(User.user_id == candidate.user_id).first()
    if not user:
        logger.warning("User not found for candidate %s", candidate.candidate_id)
        return None

    job_title = job.title or "the position"
    company_name = job.company_name or "the company"

    if decision == "ACCEPTED":
        title = "Congratulations! You've Been Selected!"
        message = (
            f"Great news! You have been selected for {job_title} at {company_name}. "
            f"Our HR team will contact you shortly with next steps."
        )
        notif_type = "APPLICATION_ACCEPTED"
    else:
        title = "Application Update"
        message = (
            f"Thank you for your interest in {job_title} at {company_name}. "
            f"After careful consideration, we have decided to move forward with another candidate."
        )
        notif_type = "APPLICATION_REJECTED"

    notification = Notification(
        notification_id=str(uuid.uuid4()),
        user_id=user.user_id,
        company_id=job.company_id,
        title=title,
        message=message,
        type=notif_type,
        reference_id=application.app_id,
        is_read=False,
    )
    db.add(notification)
    send_decision_email(user, decision, job_title, company_name)
    return notification
