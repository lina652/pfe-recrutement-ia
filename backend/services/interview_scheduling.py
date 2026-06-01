"""Interview day scheduling and booking (app + email link)."""
import logging
import secrets
import uuid
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from core.config import settings


def interview_testing_mode() -> bool:
    return bool(getattr(settings, "INTERVIEW_TESTING_MODE", False))
from models.application import Application, ApplicationStatus
from models.candidate import Candidate
from models.interview import Interview, InterviewStatus
from models.job_offer import JobOffer
from models.notification import Notification
from models.user import User
from services.mailer import send_email

logger = logging.getLogger(__name__)


def generate_available_days(start_date: datetime, days: int = 7) -> list[datetime]:
    """One bookable slot per calendar day at 00:00 (naive local wall-clock)."""
    base = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    return [base + timedelta(days=offset) for offset in range(days)]


def _normalize_day(dt: datetime) -> datetime:
    if dt.tzinfo is not None:
        dt = dt.astimezone(tz=None).replace(tzinfo=None)
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def _day_key(dt: datetime) -> date:
    return _normalize_day(dt).date()


def is_interview_start_allowed(scheduled_at: Optional[datetime]) -> bool:
    """True on the scheduled calendar day or later (enabled for the whole day)."""
    if interview_testing_mode():
        return True
    if scheduled_at is None:
        return False
    scheduled_day = _normalize_day(scheduled_at).date()
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).date()
    return today >= scheduled_day


def _booked_days(db: Session, job_id: str, exclude_interview_id: Optional[str] = None) -> set[date]:
    q = db.query(Interview).filter(
        Interview.job_id == job_id,
        Interview.scheduled_at.isnot(None),
        Interview.status != InterviewStatus.CANCELLED,
    )
    if exclude_interview_id:
        q = q.filter(Interview.interview_id != exclude_interview_id)
    return {_day_key(i.scheduled_at) for i in q.all() if i.scheduled_at}


def build_slots_payload(
    db: Session,
    interview: Interview,
    job_title: str,
) -> dict:
    now = datetime.now().replace(second=0, microsecond=0)
    start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = start_date + timedelta(days=6)
    raw_days = generate_available_days(start_date, days=7)
    booked = _booked_days(db, interview.job_id, exclude_interview_id=interview.interview_id)

    slots = []
    for day_time in raw_days:
        norm = _normalize_day(day_time)
        if _day_key(norm) < now.date():
            continue
        if _day_key(norm) in booked:
            continue
        slots.append(
            {
                "datetime": norm,
                "formatted": norm.strftime("%A, %B %d"),
                "available": True,
            }
        )

    return {
        "interview_id": interview.interview_id,
        "job_title": job_title,
        "candidate_name": None,
        "slots": slots,
        "week_start": start_date,
        "week_end": end_date,
        "already_scheduled": interview.scheduled_at is not None,
        "scheduled_at": interview.scheduled_at,
    }


def ensure_schedule_token(interview: Interview) -> str:
    if not interview.schedule_token:
        interview.schedule_token = secrets.token_urlsafe(32)
    return interview.schedule_token


def schedule_pick_url(token: str) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/schedule-interview?token={token}"


def candidate_interviews_url() -> str:
    """Dashboard where candidates pick interview days (requires login)."""
    return f"{settings.FRONTEND_URL.rstrip('/')}/candidate/interviews"


def get_interview_by_schedule_token(db: Session, token: str) -> Optional[Interview]:
    if not token or len(token) < 16:
        return None
    return db.query(Interview).filter(Interview.schedule_token == token).first()


def apply_interview_schedule(
    db: Session,
    interview: Interview,
    selected_datetime: datetime,
    *,
    via_email: bool = False,
    language: Optional[str] = None,
) -> dict:
    """Book a day, update application, notify candidate + recruiter."""
    if interview.status == InterviewStatus.CANCELLED:
        raise ValueError("This interview invitation is no longer active")

    if language in ("en", "fr"):
        interview.language = language

    selected = _normalize_day(selected_datetime)
    now = datetime.utcnow()
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).date()

    if not interview_testing_mode() and _day_key(selected) < today:
        raise ValueError("Cannot schedule in the past")

    booked = _booked_days(db, interview.job_id, exclude_interview_id=interview.interview_id)
    if _day_key(selected) in booked:
        raise ValueError("This day is no longer available")

    job = db.query(JobOffer).filter(JobOffer.job_id == interview.job_id).first()
    candidate = db.query(Candidate).filter(Candidate.candidate_id == interview.candidate_id).first()
    user = db.query(User).filter(User.user_id == candidate.user_id).first() if candidate else None
    application = db.query(Application).filter(Application.app_id == interview.application_id).first()

    interview.scheduled_at = selected
    interview.candidate_response = "ACCEPTED"
    interview.candidate_responded_at = now
    if not interview.meeting_link:
        interview.meeting_link = f"{settings.FRONTEND_URL.rstrip('/')}/candidate/interview/{interview.interview_id}"

    if application:
        if application.status == ApplicationStatus.PENDING:
            application.status = ApplicationStatus.SHORTLISTED
        application.last_updated = now
        note = f"Interview scheduled for {selected.strftime('%Y-%m-%d')}"
        if via_email:
            note += " (via email link)"
        prev = (application.ai_recommendation or "").strip()
        application.ai_recommendation = f"{prev}\n{note}".strip() if prev else note

    job_title = job.title if job else "the position"
    schedule_text = selected.strftime("%A, %B %d, %Y")

    if user:
        db.add(
            Notification(
                notification_id=str(uuid.uuid4()),
                user_id=user.user_id,
                company_id=job.company_id if job else None,
                title="Interview Day Confirmed",
                message=(
                    f"Your interview for {job_title} is scheduled for {schedule_text}. "
                    f"You can start anytime that day from your dashboard. "
                    f"Meeting link: {interview.meeting_link}"
                ),
                type="INTERVIEW_CONFIRMED",
                reference_id=interview.interview_id,
                is_read=False,
            )
        )

    if job:
        db.add(
            Notification(
                notification_id=str(uuid.uuid4()),
                user_id=job.posted_by,
                company_id=job.company_id,
                title="Interview Day Selected",
                message=(
                    f"{user.first_name if user else 'A candidate'} {user.last_name if user else ''} "
                    f"chose {schedule_text} for {job_title}."
                ).strip(),
                type="INTERVIEW_TIME_SELECTED",
                reference_id=interview.interview_id,
                is_read=False,
            )
        )

    db.commit()
    db.refresh(interview)

    if user and user.email:
        subject = f"Interview Confirmed - {job_title} | TalentOs"
        body = f"""Hello {user.first_name},

Your interview for {job_title} has been confirmed!

Interview day: {schedule_text}
You can start the interview anytime during that day from your dashboard.

Meeting Link: {interview.meeting_link}

Best regards,
{settings.APP_NAME}"""
        html = f"""<html><body style="font-family:Arial,sans-serif;">
        <p>Hello <strong>{user.first_name}</strong>,</p>
        <p>Your interview for <strong>{job_title}</strong> is on <strong>{schedule_text}</strong>.</p>
        <p>You may start anytime during that day.</p>
        <p><a href="{interview.meeting_link}">Open interview room</a></p>
        </body></html>"""
        send_email(user.email, subject, body, html=html)

    logger.info("Interview %s scheduled for day %s (email=%s)", interview.interview_id, selected.date(), via_email)

    return {
        "message": "Interview day confirmed",
        "interview_id": interview.interview_id,
        "scheduled_at": interview.scheduled_at.isoformat(),
        "meeting_link": interview.meeting_link,
        "job_title": job_title,
    }
