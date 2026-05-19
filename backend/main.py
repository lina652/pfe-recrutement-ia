from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os
from database import engine, Base
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError
from core.config import settings
from api.routes.auth import router as auth_router
from api.routes.admin import router as admin_router
from api.routes.recruiter import router as recruiter_router
from api.routes.manager import router as manager_router
from api.routes.superAdmin import router as super_admin_router
from api.routes.candidate import router as candidate_router
from api.routes.public import router as public_router
from api.routes.interview import router as interview_router
from api.routes.rag import router as rag_router
from api.routes.orchestrator import router as orchestrator_router
from models import user, invitation, log, report
from models.job_offer import JobOffer
from models.application import Application
from models.company import Company
from models.candidate import Candidate
from models.cv_version import CVVersion
from models.otp import OTP
from models.requirement_request import RequirementRequest
from models.notification import Notification
from models.interview import Interview, InterviewMessage, InterviewReport
from models.rag_conversation import RAGConversation, RAGMessage

Base.metadata.create_all(bind=engine)


def sync_requirement_requests_schema():
    inspector = inspect(engine)
    if "requirement_requests" not in inspector.get_table_names():
        return

    cols = {c["name"] for c in inspector.get_columns("requirement_requests")}
    with engine.begin() as conn:
        if "title" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN title VARCHAR(255)"))
            conn.execute(text("UPDATE requirement_requests SET title = 'Untitled Role' WHERE title IS NULL"))
            conn.execute(text("ALTER TABLE requirement_requests ALTER COLUMN title SET NOT NULL"))
        if "description" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN description TEXT"))
        if "location" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN location VARCHAR(255)"))
        if "contract_type" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN contract_type VARCHAR(50)"))
            conn.execute(text("UPDATE requirement_requests SET contract_type = 'CDI' WHERE contract_type IS NULL"))
        if "department" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN department VARCHAR(100)"))
        if "salary_range" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN salary_range VARCHAR(100)"))
        if "created_job_id" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN created_job_id VARCHAR(36)"))
        if "closing_date" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN closing_date TIMESTAMP"))
        if "job_id" in cols:
            conn.execute(text("ALTER TABLE requirement_requests ALTER COLUMN job_id DROP NOT NULL"))
        if "location_type" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN location_type VARCHAR(20)"))
        if "experience_level" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN experience_level VARCHAR(30)"))
        if "languages_required" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN languages_required TEXT"))
        if "languages_other" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN languages_other TEXT"))
        if "soft_skills" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN soft_skills TEXT"))
        if "soft_skills_other" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN soft_skills_other TEXT"))
        if "certifications" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN certifications TEXT"))
        if "certifications_other" not in cols:
            conn.execute(text("ALTER TABLE requirement_requests ADD COLUMN certifications_other TEXT"))


def sync_job_offers_schema():
    inspector = inspect(engine)
    if "job_offers" not in inspector.get_table_names():
        return

    cols = {c["name"] for c in inspector.get_columns("job_offers")}
    with engine.begin() as conn:
        for col, ddl in [
            ("languages_required", "TEXT"),
            ("languages_other", "TEXT"),
            ("soft_skills", "TEXT"),
            ("soft_skills_other", "TEXT"),
            ("certifications", "TEXT"),
            ("certifications_other", "TEXT"),
            ("closing_processed", "BOOLEAN DEFAULT FALSE"),
        ]:
            if col not in cols:
                conn.execute(text(f"ALTER TABLE job_offers ADD COLUMN {col} {ddl}"))


def sync_interviews_schema():
    inspector = inspect(engine)
    if "interviews" not in inspector.get_table_names():
        return

    cols = {c["name"] for c in inspector.get_columns("interviews")}
    with engine.begin() as conn:
        if "scheduled_at" not in cols:
            conn.execute(text("ALTER TABLE interviews ADD COLUMN scheduled_at TIMESTAMP"))
        if "meeting_link" not in cols:
            conn.execute(text("ALTER TABLE interviews ADD COLUMN meeting_link TEXT"))
        if "candidate_response" not in cols:
            conn.execute(text("ALTER TABLE interviews ADD COLUMN candidate_response VARCHAR(20)"))
        if "candidate_response_reason" not in cols:
            conn.execute(text("ALTER TABLE interviews ADD COLUMN candidate_response_reason TEXT"))
        if "candidate_responded_at" not in cols:
            conn.execute(text("ALTER TABLE interviews ADD COLUMN candidate_responded_at TIMESTAMP"))
        if "schedule_token" not in cols:
            conn.execute(text("ALTER TABLE interviews ADD COLUMN schedule_token VARCHAR(64)"))
            try:
                conn.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_interviews_schedule_token "
                    "ON interviews (schedule_token)"
                ))
            except Exception:
                pass
        if "session_state" not in cols:
            # JSON column to persist interview session state (silences, identity_warnings, etc.)
            try:
                conn.execute(text("ALTER TABLE interviews ADD COLUMN session_state JSON"))
            except Exception:
                # Some DBs (SQLite) don't support JSON type; fall back to TEXT
                conn.execute(text("ALTER TABLE interviews ADD COLUMN session_state TEXT"))


def sync_rag_schema():
    """Ensure RAG conversation and message tables exist for existing deployments."""
    inspector = inspect(engine)
    with engine.begin() as conn:
        # Tables are auto-created by Base.metadata.create_all(), but we verify they exist
        if "rag_conversations" not in inspector.get_table_names():
            # This should not happen, but log if it does
            pass
        if "rag_messages" not in inspector.get_table_names():
            # This should not happen, but log if it does
            pass


def sync_interview_reports_schema():
    """Add new columns from bot_rh_final_v2 to interview_reports table."""
    inspector = inspect(engine)
    if "interview_reports" not in inspector.get_table_names():
        return

    cols = {c["name"] for c in inspector.get_columns("interview_reports")}
    with engine.begin() as conn:
        if "technical_competencies" not in cols:
            conn.execute(text("ALTER TABLE interview_reports ADD COLUMN technical_competencies JSON"))
        if "soft_skills" not in cols:
            conn.execute(text("ALTER TABLE interview_reports ADD COLUMN soft_skills JSON"))
        if "red_flags" not in cols:
            conn.execute(text("ALTER TABLE interview_reports ADD COLUMN red_flags JSON"))
        if "follow_up_questions" not in cols:
            conn.execute(text("ALTER TABLE interview_reports ADD COLUMN follow_up_questions JSON"))


sync_requirement_requests_schema()
sync_job_offers_schema()
sync_interviews_schema()


def backfill_interview_schedule_tokens():
    """Ensure existing invited interviews have email scheduling tokens."""
    from database import SessionLocal
    from models.interview import Interview
    from services.interview_scheduling import ensure_schedule_token

    db = SessionLocal()
    try:
        rows = db.query(Interview).filter(Interview.schedule_token.is_(None)).all()
        for row in rows:
            ensure_schedule_token(row)
        if rows:
            db.commit()
    finally:
        db.close()


backfill_interview_schedule_tokens()
sync_rag_schema()
sync_interview_reports_schema()

app = FastAPI(title="AI Recruitment Platform", version="1.0.0")


@app.on_event("startup")
def close_expired_jobs_on_startup():
    from database import SessionLocal
    from services.job_closing_service import close_due_jobs

    db = SessionLocal()
    try:
        n = close_due_jobs(db)
        if n:
            import logging
            logging.getLogger(__name__).info("Closed %d expired job(s) on startup", n)
    finally:
        db.close()

# CORS: browser requires Access-Control-Allow-Origin on API responses.
# If you see a CORS error but the backend is down, Chrome still labels it as CORS — verify GET /health.
_cors_origins = list({
    settings.FRONTEND_URL.rstrip("/"),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
})
_extra = os.getenv("CORS_EXTRA_ORIGINS", "").strip()
if _extra:
    for _o in _extra.split(","):
        _o = _o.strip()
        if _o and _o not in _cors_origins:
            _cors_origins.append(_o)

_cors_kw = dict(
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
if settings.DEBUG:
    # Any Vite port on localhost during dev (e.g. 5173, 5174)
    _cors_kw["allow_origin_regex"] = r"http://(localhost|127\.0\.0\.1):\d+$"

app.add_middleware(CORSMiddleware, **_cors_kw)


@app.exception_handler(OperationalError)
async def database_unavailable(_request: Request, _exc: OperationalError):
    """Return 503 with CORS headers so the browser shows DB errors instead of a fake CORS failure."""
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "Database is unavailable. Start PostgreSQL "
                "(e.g. docker compose up -d postgres) and check DATABASE_URL in backend/.env."
            )
        },
    )


os.makedirs("interview_media", exist_ok=True)
app.mount("/media", StaticFiles(directory="interview_media"), name="media")

app.include_router(auth_router)
app.include_router(super_admin_router)
app.include_router(admin_router)
app.include_router(recruiter_router)
app.include_router(manager_router)
app.include_router(candidate_router)
app.include_router(public_router)
app.include_router(interview_router)
app.include_router(rag_router)
app.include_router(orchestrator_router)

@app.get("/")
def root():
    return {"message": "AI Recruitment Platform API"}

@app.get("/health")
def health():
    return {"status": "ok"}
