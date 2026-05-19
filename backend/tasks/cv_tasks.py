"""
Celery tasks for CV processing: OCR, NER, and semantic matching.
"""
import logging
import uuid
from datetime import datetime, timedelta
from celery_app import celery_app
from database import SessionLocal

logger = logging.getLogger(__name__)


def generate_interview_time_slots(start_date: datetime, days: int = 7) -> list:
    """
    Generate interview time slots from 8:00 AM to 5:00 PM every 45 minutes
    for the specified number of days starting from start_date.
    """
    slots = []
    for day_offset in range(days):
        current_date = start_date + timedelta(days=day_offset)
        hour = 8
        minute = 0
        while hour < 17 or (hour == 17 and minute == 0):
            slot_time = current_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
            slots.append(slot_time)
            minute += 45
            if minute >= 60:
                hour += 1
                minute -= 60
    
    return slots


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def process_cv_async(self, candidate_id: str, file_path: str):
    """Run OCR + NER on a candidate CV in the background."""
    db = SessionLocal()
    try:
        from services.ocr_service import ocr_service
        from services.ner_service import ner_service
        from models.cv_version import CVVersion

        cv_text = ocr_service.extract_text(file_path)
        if not cv_text or len(cv_text.strip()) < 30:
            logger.warning(f"CV text too short for candidate {candidate_id}")
            return {"status": "skipped", "reason": "text_too_short"}

        parsed_cv = ner_service.parse_cv(cv_text)
        from services.cv_job_matching import rematch_all_applications_for_candidate

        rematched = rematch_all_applications_for_candidate(db, candidate_id)
        logger.info(
            "CV processed for candidate %s: %d chars, rematched %d application(s)",
            candidate_id,
            len(cv_text),
            rematched,
        )
        return {
            "status": "completed",
            "candidate_id": candidate_id,
            "rematched_applications": rematched,
        }

    except Exception as exc:
        logger.error(f"CV processing failed for {candidate_id}: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def compute_matching_async(self, application_id: str):
    """Run semantic matching for a candidate-job pair in the background."""
    db = SessionLocal()
    try:
        from models.application import Application
        from services.cv_job_matching import match_and_persist_application

        app = db.query(Application).filter(
            Application.app_id == application_id
        ).first()
        if not app:
            return {"status": "error", "reason": "application_not_found"}

        result = match_and_persist_application(db, app)
        db.commit()

        logger.info(
            "Matching completed for application %s: %s%%",
            application_id,
            result.get("match_percentage"),
        )
        return {
            "status": "completed",
            "application_id": application_id,
            "score": result.get("overall_score"),
        }

    except Exception as exc:
        logger.error(f"Matching failed for application {application_id}: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def process_job_closing(self, job_id: str):
    """Celery wrapper — core logic in services.job_closing_service."""
    from services.job_closing_service import execute_job_closing

    db = SessionLocal()
    try:
        return execute_job_closing(db, job_id)
    except Exception as exc:
        logger.error("Job closing failed for %s: %s", job_id, exc)
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()

