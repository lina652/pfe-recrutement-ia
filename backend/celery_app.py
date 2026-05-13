"""
Celery application configuration for async task processing.
Uses Redis as the message broker.
"""
from celery import Celery
from core.config import settings

celery_app = Celery(
    "recruitment",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "tasks.cv_tasks",
        "tasks.interview_tasks",
        "tasks.rag_tasks",
        "tasks.notification_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,
)
