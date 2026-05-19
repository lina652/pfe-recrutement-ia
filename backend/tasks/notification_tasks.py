"""
Celery tasks for sending emails and creating notifications asynchronously.
"""
import logging
import uuid
from datetime import datetime
from celery_app import celery_app
from database import SessionLocal

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def send_interview_email_async(self, candidate_user_id: str, interview_id: str):
    """Send interview invitation email to a candidate."""
    db = SessionLocal()
    try:
        from models.user import User
        from models.interview import Interview
        from models.candidate import Candidate
        from services.mailer import send_email
        from core.config import settings

        user = db.query(User).filter(User.user_id == candidate_user_id).first()
        interview = db.query(Interview).filter(
            Interview.interview_id == interview_id
        ).first()

        if not user or not interview:
            logger.warning(f"User or interview not found for email task")
            return {"status": "skipped"}

        candidate = db.query(Candidate).filter(
            Candidate.user_id == candidate_user_id
        ).first()

        first_name = candidate.first_name if candidate and hasattr(candidate, 'first_name') else user.first_name
        schedule_text = interview.scheduled_at.strftime("%Y-%m-%d %H:%M UTC") if interview.scheduled_at else "To be confirmed"
        meeting_link = interview.meeting_link or ""

        subject = "Your interview has been scheduled — TalentOs"
        body = (
            f"Hello {first_name},\n\n"
            f"Your interview has been automatically scheduled for {schedule_text}.\n"
            f"Join using this link: {meeting_link}\n\n"
            f"You can accept or refuse this invitation from your dashboard.\n\n"
            f"Best,\n{settings.APP_NAME}"
        )

        html_body = f"""<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#7B5AC8,#9683EC);padding:30px;border-radius:12px 12px 0 0;">
            <h1 style="color:white;margin:0;font-family:cursive;">Talent<span style="color:#f97316;">Os</span></h1>
        </div>
        <div style="padding:30px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <p>Hello <strong>{first_name}</strong>,</p>
            <p>Your interview has been automatically scheduled for <strong>{schedule_text}</strong>.</p>
            <div style="margin:20px 0;">
                <a href="{meeting_link}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#7B5AC8,#9683EC);color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
                    Open Interview
                </a>
            </div>
            <p style="color:#6b7280;font-size:13px;">You can accept or refuse this invitation from your dashboard.</p>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;"/>
            <p style="color:#9ca3af;font-size:12px;">Best regards,<br/>{settings.APP_NAME}</p>
        </div>
        </body></html>"""

        send_email(user.email, subject, body, html=html_body)
        logger.info(f"Interview email sent to {user.email}")
        return {"status": "sent", "email": user.email}

    except Exception as exc:
        logger.error(f"Email sending failed: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def send_notification_async(self, user_id: str, title: str, message: str,
                            notif_type: str, reference_id: str = None, company_id: str = None):
    """Create a notification record in the database."""
    db = SessionLocal()
    try:
        from models.notification import Notification

        notification = Notification(
            notification_id=str(uuid.uuid4()),
            user_id=user_id,
            company_id=company_id,
            title=title,
            message=message,
            type=notif_type,
            reference_id=reference_id,
            is_read=False
        )
        db.add(notification)
        db.commit()

        logger.info(f"Notification created for user {user_id}: {title}")
        return {"status": "created", "notification_id": notification.notification_id}

    except Exception as exc:
        logger.error(f"Notification creation failed: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def send_decision_email_async(self, candidate_user_id: str, application_id: str, 
                               decision: str, job_title: str, company_name: str):
    """Send acceptance or rejection email to a candidate."""
    db = SessionLocal()
    try:
        from models.user import User
        from services.selection_notification_service import send_decision_email

        user = db.query(User).filter(User.user_id == candidate_user_id).first()
        if not user:
            logger.warning("User not found for decision email task: %s", candidate_user_id)
            return {"status": "skipped"}

        sent = send_decision_email(
            user,
            decision if decision in ("ACCEPTED", "REJECTED") else "REJECTED",
            job_title,
            company_name,
        )
        return {"status": "sent" if sent else "skipped", "email": user.email, "decision": decision}

    except Exception as exc:
        logger.error("Decision email sending failed: %s", exc)
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def send_interview_reminder(self, interview_id: str):
    """
    Send a reminder notification to the candidate at the scheduled interview time.
    This task is meant to be scheduled to run at the interview's scheduled_at time.
    """
    db = SessionLocal()
    try:
        from models.interview import Interview
        from models.notification import Notification
        from models.candidate import Candidate

        interview = db.query(Interview).filter(
            Interview.interview_id == interview_id
        ).first()

        if not interview:
            logger.warning(f"Interview {interview_id} not found for reminder")
            return {"status": "skipped"}

        candidate = db.query(Candidate).filter(
            Candidate.candidate_id == interview.candidate_id
        ).first()

        if not candidate:
            logger.warning(f"Candidate not found for interview {interview_id}")
            return {"status": "skipped"}

        # Check if interview has been responded to or already started
        if interview.candidate_response or interview.status.value == "IN_PROGRESS":
            logger.info(f"Interview {interview_id} already responded to or in progress. Skipping reminder.")
            return {"status": "skipped"}

        scheduled_time_str = interview.scheduled_at.strftime("%Y-%m-%d %H:%M UTC") if interview.scheduled_at else ""

        # Create reminder notification for candidate
        reminder_notification = Notification(
            notification_id=str(uuid.uuid4()),
            user_id=candidate.user_id,
            company_id=interview.job_id,  # Using job context
            title="Interview Reminder",
            message=f"Your interview is starting now at {scheduled_time_str}. Please be ready to begin. Click to open the interview.",
            type="INTERVIEW_INVITED",
            reference_id=interview.interview_id,
            is_read=False
        )
        db.add(reminder_notification)
        db.commit()

        logger.info(f"Interview reminder sent to candidate for interview {interview_id}")
        return {"status": "sent", "interview_id": interview_id}

    except Exception as exc:
        logger.error(f"Interview reminder failed: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()
