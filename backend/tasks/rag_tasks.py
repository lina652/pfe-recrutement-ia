"""
Celery tasks for RAG chatbot: vector store building and query processing.
"""
import logging
from celery_app import celery_app
from database import SessionLocal

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def build_vector_store_async(self, job_id: str):
    """Build or rebuild the RAG vector store for a job."""
    db = SessionLocal()
    try:
        from services.rag_service import get_rag_service

        service = get_rag_service()
        service.refresh_vector_store(job_id)
        vs, chunks = service.get_or_build_vector_store(db, job_id, force_rebuild=True)

        if vs and chunks:
            logger.info(f"Vector store built for job {job_id}")
            return {"status": "completed", "job_id": job_id}
        else:
            return {"status": "no_data", "job_id": job_id}

    except Exception as exc:
        logger.error(f"Vector store build failed for job {job_id}: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=15)
def rag_chat_async(self, job_id: str, question: str):
    """Process a RAG query asynchronously."""
    db = SessionLocal()
    try:
        from services.rag_service import get_rag_service

        service = get_rag_service()
        answer = service.chat(db, job_id, question)

        logger.info(f"RAG query answered for job {job_id}")
        return {"status": "completed", "answer": answer}

    except Exception as exc:
        logger.error(f"RAG chat failed for job {job_id}: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()
