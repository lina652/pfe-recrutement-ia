"""
Send in-app notifications when candidates are shortlisted.
"""
import logging
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from core.config import settings
from models.application import Application
from models.candidate import Candidate
from models.job_offer import JobOffer
from models.notification import Notification
from models.user import User

logger = logging.getLogger(__name__)


def notify_candidate_shortlisted(
    db: Session,
    *,
    application: Application,
    job: JobOffer,
    candidate: Candidate,
) -> Optional[Notification]:
    """Create in-app notification when a candidate is shortlisted."""
    user = db.query(User).filter(User.user_id == candidate.user_id).first()
    if not user:
        logger.warning("User not found for candidate %s", candidate.candidate_id)
        return None

    job_title = job.title or "the position"
    company_name = job.company_name or "the company"

    title = f"Congratulations! You've Been Shortlisted for {job_title}"
    message = (
        f"Great news! You have been shortlisted for {job_title} at {company_name}. "
        f"You will receive further details about the interview process soon."
    )
    notification_type = "SHORTLISTED"

    notification = Notification(
        notification_id=str(uuid.uuid4()),
        user_id=user.user_id,
        company_id=job.company_id,
        title=title,
        message=message,
        type=notification_type,
        reference_id=application.app_id,
        is_read=False,
    )
    db.add(notification)
    logger.info(
        "Shortlist notification created: job=%s candidate=%s notification=%s",
        job.job_id,
        candidate.candidate_id,
        notification.notification_id,
    )
    return notification
