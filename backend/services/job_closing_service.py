"""Close jobs when closing_date is reached (works without Celery worker)."""
import logging
import os
import threading
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from core.closing_date import is_closing_due
from core.config import settings
from models.application import Application, ApplicationStatus
from models.candidate import Candidate
from models.interview import Interview, InterviewStatus
from services.interview_scheduling import (
    ensure_schedule_token,
    candidate_interviews_url,
    schedule_pick_url,
)
from models.job_offer import JobOffer
from models.notification import Notification
from models.user import User
from services.mailer import send_email
logger = logging.getLogger(__name__)
_pipeline_lock = threading.Lock()
_pipeline_running: set[str] = set()


def generate_interview_days(start_date: datetime, days: int = 7) -> list:
    """One bookable day per offset (weekends included)."""
    base = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    return [base + timedelta(days=offset) for offset in range(days)]


def _jobs_past_closing(db: Session) -> list[JobOffer]:
    """All jobs whose closing time has passed (timezone-aware check)."""
    candidates = (
        db.query(JobOffer)
        .filter(JobOffer.closing_date.isnot(None))
        .all()
    )
    return [j for j in candidates if is_closing_due(j.closing_date)]


def deactivate_expired_jobs(db: Session) -> list[str]:
    """Hide expired jobs from public listings (is_active=False). Rows stay in DB."""
    due_jobs = [j for j in _jobs_past_closing(db) if j.is_active]
    due_ids = [j.job_id for j in due_jobs]
    if not due_ids:
        return []

    db.query(JobOffer).filter(JobOffer.job_id.in_(due_ids)).update(
        {JobOffer.is_active: False},
        synchronize_session=False,
    )
    db.commit()
    logger.info("Deactivated %d expired job(s) from public listings", len(due_ids))
    return due_ids


def jobs_pending_closing_pipeline(db: Session) -> list[str]:
    """Closed jobs that still need shortlist + interview invites."""
    pending = []
    for job in _jobs_past_closing(db):
        if job.closing_processed is True:
            continue
        pending.append(job.job_id)
    return pending


def run_closing_pipeline(db: Session, job_ids: list[str]) -> int:
    processed = 0
    for job_id in job_ids:
        try:
            execute_job_closing(db, job_id)
            processed += 1
        except Exception as exc:
            logger.error("Failed to process closing for job %s: %s", job_id, exc)
            db.rollback()
    return processed


def _run_closing_pipeline_background(job_ids: list[str]) -> None:
    if not job_ids:
        return
    with _pipeline_lock:
        batch = [jid for jid in job_ids if jid not in _pipeline_running]
        if not batch:
            return
        _pipeline_running.update(batch)

    def worker():
        from database import SessionLocal

        session = SessionLocal()
        try:
            run_closing_pipeline(session, batch)
        finally:
            session.close()
            with _pipeline_lock:
                _pipeline_running.difference_update(batch)

    threading.Thread(target=worker, daemon=True, name="job-closing-pipeline").start()


def close_due_jobs(db: Session) -> int:
    """Deactivate expired jobs, then run shortlist/interview pipeline (sync)."""
    deactivate_expired_jobs(db)
    job_ids = jobs_pending_closing_pipeline(db)
    return run_closing_pipeline(db, job_ids)


def sync_job_closings(db: Session, background: bool = False) -> None:
    """
    Hide expired jobs from public listings and run interview-invite pipeline.
    Runs synchronously by default so notifications/emails are not lost.
    """
    try:
        deactivate_expired_jobs(db)
        job_ids = jobs_pending_closing_pipeline(db)
        if not job_ids:
            return
        logger.info("Running closing pipeline for %d job(s): %s", len(job_ids), job_ids)
        if background:
            _run_closing_pipeline_background(job_ids)
        else:
            run_closing_pipeline(db, job_ids)
    except Exception as exc:
        logger.exception("sync_job_closings failed: %s", exc)


def execute_job_closing(db: Session, job_id: str) -> dict:
    """
    Deactivate job, rank applications, shortlist top 10, send interview invites.
    Idempotent: already-inactive jobs skip deactivation but still process if needed.
    """
    job = db.query(JobOffer).filter(JobOffer.job_id == job_id).first()
    if not job:
        return {"status": "error", "reason": "job_not_found"}

    applications = db.query(Application).filter(Application.job_id == job_id).all()

    if getattr(job, "closing_processed", False):
        return {"status": "already_processed", "job_id": job_id}

    if not job.is_active:
        logger.info("Job %s inactive — running closing pipeline", job_id)
    else:
        job.is_active = False
        db.commit()
        logger.info("Job %s closed: %s", job_id, job.title)

    applications = db.query(Application).filter(Application.job_id == job_id).all()
    if not applications:
        job.closing_processed = True
        db.commit()
        logger.info("Job %s closed with no applications", job_id)
        return {"status": "completed", "selected_count": 0, "reason": "no_applications"}

    scored_applications = []
    for app in applications:
        candidate = (
            db.query(Candidate).filter(Candidate.candidate_id == app.candidate_id).first()
        )
        if not candidate:
            continue

        from services.cv_job_matching import match_and_persist_application

        result = match_and_persist_application(db, app)
        score = float(result.get("overall_score", 0) or 0)
        scored_applications.append(
            {"application": app, "candidate": candidate, "score": score}
        )

    db.commit()

    scored_applications.sort(key=lambda x: x["score"], reverse=True)
    top_10 = scored_applications[:10]

    if not top_10:
        logger.info("Job %s closed: no scorable applications", job_id)
        for app in applications:
            if app.status == ApplicationStatus.PENDING:
                app.status = ApplicationStatus.REJECTED
        job.closing_processed = True
        db.commit()
        return {"status": "completed", "job_id": job_id, "total_applications": len(applications), "selected_count": 0, "reason": "no_scorable_candidates"}

    start_date = datetime.utcnow() + timedelta(days=1)
    available_days = generate_interview_days(start_date, days=7)

    for item in top_10:
        app = item["application"]
        candidate = item["candidate"]

        user = db.query(User).filter(User.user_id == candidate.user_id).first()
        if not user or not (user.first_name or user.last_name or user.email):
            logger.warning(
                "No valid user profile for candidate %s — skipping shortlist/invite",
                candidate.candidate_id,
            )
            continue

        app.status = ApplicationStatus.SHORTLISTED

        if not user.email:
            logger.warning("No email for user %s — skipping mail", user.user_id)

        existing_interview = (
            db.query(Interview).filter(Interview.application_id == app.app_id).first()
        )
        if existing_interview:
            interview = existing_interview
            interview.status = InterviewStatus.INVITED
        else:
            interview = Interview(
                interview_id=str(uuid.uuid4()),
                application_id=app.app_id,
                candidate_id=candidate.candidate_id,
                job_id=job_id,
                language="en",
                status=InterviewStatus.INVITED,
                auto_scheduled=False,
            )
            db.add(interview)
            db.flush()
            interview.meeting_link = (
                f"{settings.FRONTEND_URL}/candidate/interview/{interview.interview_id}"
            )

        schedule_token = ensure_schedule_token(interview)
        pick_url = schedule_pick_url(schedule_token)
        interviews_url = candidate_interviews_url()

        notification = Notification(
            notification_id=str(uuid.uuid4()),
            user_id=candidate.user_id,
            company_id=job.company_id,
            title=f"Congratulations! Interview Invitation for {job.title}",
            message=(
                f"You have been selected among the top candidates for {job.title}! "
                "Please select your preferred interview day in your dashboard."
            ),
            type="INTERVIEW_TIME_SELECTION",
            reference_id=interview.interview_id,
            is_read=False,
        )
        db.add(notification)
        db.flush()
        logger.info(
            "Interview invite: job=%s candidate=%s notification=%s",
            job_id,
            candidate.candidate_id,
            notification.notification_id,
        )

        days_text = "\n".join(
            [d.strftime("%A %d %B %Y") for d in available_days[:7]]
        )
        subject = f"Interview Invitation - {job.title} | TalentOs"
        body = f"""Hello {user.first_name},

Congratulations! You have been selected among the top candidates for {job.title} at {job.company_name}.

Choose your interview language and day (no login required):

{pick_url}

Or sign in to your dashboard: {interviews_url}

Available days (next week):
{days_text}

Best regards,
{settings.APP_NAME}"""

        html_body = f"""<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <p>Hello <strong>{user.first_name}</strong>,</p>
        <p>Congratulations! You have been shortlisted for <strong>{job.title}</strong> at {job.company_name}.</p>
        <p style="margin:24px 0;">
          <a href="{pick_url}" style="display:inline-block;padding:14px 28px;background:#7B5AC8;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
            Select language &amp; interview day
          </a>
        </p>
        <p style="color:#6b7280;font-size:14px;">Pick English or French, then choose a day on the calendar. You can start anytime that day. You can also <a href="{interviews_url}">sign in to your dashboard</a>.</p>
        </body></html>"""
        if user.email:
            sent = send_email(user.email, subject, body, html=html_body)
            if not sent:
                logger.warning("Email not sent to %s (check SMTP settings)", user.email)

    shortlisted_ids = {item["application"].app_id for item in top_10}
    for app in applications:
        if app.app_id not in shortlisted_ids and app.status == ApplicationStatus.PENDING:
            app.status = ApplicationStatus.REJECTED

    job.closing_processed = True
    db.commit()
    logger.info("Job closing completed for %s: %d shortlisted", job_id, len(top_10))
    return {
        "status": "completed",
        "job_id": job_id,
        "total_applications": len(applications),
        "selected_count": len(top_10),
    }


def reopen_job_for_applications(db: Session, job: JobOffer, closing_date: datetime) -> None:
    """
    Reactivate a closed job with a new closing date.
    Resets closing_processed so the pipeline runs again when the new date passes.
    Keeps the linked requirement request closing_date in sync when present.
    """
    job.is_active = True
    job.closing_date = closing_date
    job.closing_processed = False

    from models.requirement_request import RequirementRequest

    linked_req = (
        db.query(RequirementRequest)
        .filter(RequirementRequest.created_job_id == job.job_id)
        .first()
    )
    if linked_req:
        linked_req.closing_date = closing_date

    db.flush()
    schedule_job_closing_task(closing_date, job.job_id)
    logger.info("Reopened job %s (%s) until %s", job.job_id, job.title, closing_date)


def schedule_job_closing_task(closing_date: datetime, job_id: str) -> None:
    """Best-effort Celery ETA; sync close_due_jobs still runs on API requests."""
    try:
        from tasks.cv_tasks import process_job_closing

        eta = closing_date
        if eta.tzinfo is None:
            eta = eta.replace(tzinfo=timezone.utc)
        process_job_closing.apply_async(args=[job_id], eta=eta)
    except Exception as exc:
        logger.warning("Could not schedule Celery closing for %s: %s", job_id, exc)
