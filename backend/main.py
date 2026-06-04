import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

from database import engine, Base, SessionLocal
from core.config import settings

# Import routers
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

# Import models
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

logger = logging.getLogger(__name__)

# --- MOVE SCHEMA SYNC FUNCTIONS INSIDE A SAFE STARTUP WRAPPER ---
def run_database_syncs():
    logger.info("Initializing database schemas and migrations...")
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    
    # 1. Sync requirement requests
    if "requirement_requests" in inspector.get_table_names():
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

    # 2. Sync job offers
    if "job_offers" in inspector.get_table_names():
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

    # 3. Sync interviews
    if "interviews" in inspector.get_table_names():
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
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_interviews_schedule_token ON interviews (schedule_token)"
                    ))
                except Exception:
                    pass
            if "session_state" not in cols:
                try:
                    conn.execute(text("ALTER TABLE interviews ADD COLUMN session_state JSON"))
                except Exception:
                    conn.execute(text("ALTER TABLE interviews ADD COLUMN session_state TEXT"))

    # 4. Backfill tokens
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

    # 5. Sync Interview Reports
    if "interview_reports" in inspector.get_table_names():
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
                
    logger.info("Database schemas fully synchronized.")


# --- INSTANTIATE FASTAPI APP FIRST ---
app = FastAPI(title="AI Recruitment Platform", version="1.0.0")


# --- RUN EVERYTHING ON APPLICATION STARTUP EVENT ---
@app.on_event("startup")
def on_startup():
    # Run structural database adjustments cleanly
    try:
        run_database_syncs()
    except Exception as e:
        logger.error(f"Failed to run database migrations on startup: {e}")

    # Close expired jobs
    from services.job_closing_service import close_due_jobs
    db = SessionLocal()
    try:
        n = close_due_jobs(db)
        if n:
            logger.info("Closed %d expired job(s) on startup", n)
    finally:
        db.close()


# --- CORS CONFIGURATION ---
_cors_origins = list({
    settings.FRONTEND_URL.rstrip("/"),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://pfe-recrutement-ia.vercel.app",
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
    _cors_kw["allow_origin_regex"] = r"http://(localhost|127\.0\.0\.1):\d+$"

app.add_middleware(CORSMiddleware, **_cors_kw)


@app.exception_handler(OperationalError)
async def database_unavailable(_request: Request, _exc: OperationalError):
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Database is unavailable. Verify DATABASE_URL."
        },
    )


os.makedirs("interview_media", exist_ok=True)
app.mount("/media", StaticFiles(directory="interview_media"), name="media")

from services.cv_storage import ensure_cv_dirs

ensure_cv_dirs()

# Include routers
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