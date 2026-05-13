"""
Celery tasks for interview processing: STT, emotion analysis, LLM, TTS, report generation.
"""
import logging
from celery_app import celery_app
from database import SessionLocal

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=15)
def process_interview_turn_async(self, interview_id: str, audio_path: str, video_path: str = None):
    """Process one interview turn asynchronously: STT + emotion + LLM + TTS."""
    db = SessionLocal()
    try:
        from services.interview_service import get_interview_service

        service = get_interview_service()
        result = service.process_turn(
            db=db,
            interview_id=interview_id,
            audio_webm_path=audio_path,
            video_webm_path=video_path
        )

        logger.info(f"Interview turn processed for {interview_id}, turn {result['turn']}")
        return result

    except Exception as exc:
        logger.error(f"Interview turn processing failed for {interview_id}: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=15)
def generate_interview_report_async(self, interview_id: str):
    """Generate AI evaluation report after interview ends."""
    db = SessionLocal()
    try:
        from services.interview_service import get_interview_service

        service = get_interview_service()
        report = service.generate_report(db, interview_id)

        logger.info(f"Interview report generated for {interview_id}")
        return report

    except Exception as exc:
        logger.error(f"Report generation failed for {interview_id}: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()
