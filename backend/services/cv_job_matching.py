"""
Unified CV ↔ job matching: NER-parsed CV vs full job requirements (single source of truth).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional, Tuple

from sqlalchemy.orm import Session

from models.application import Application
from models.candidate import Candidate
from models.cv_version import CVVersion
from models.job_offer import JobOffer
from services.job_requirements import build_job_requirements
from services.matching_service import matching_service
from services import ocr_service, ner_service

logger = logging.getLogger(__name__)


def load_parsed_cv(db: Session, candidate: Candidate) -> dict:
    """OCR + NER on active CV, or fallback to profile skills only."""
    cv = (
        db.query(CVVersion)
        .filter(
            CVVersion.candidate_id == candidate.candidate_id,
            CVVersion.is_active == True,
        )
        .order_by(CVVersion.version_number.desc())
        .first()
    )

    if cv and cv.file_path and os.path.exists(cv.file_path):
        try:
            cv_text = ocr_service.extract_text(cv.file_path)
            if cv_text and len(cv_text.strip()) >= 30:
                return ner_service.parse_cv(cv_text)
        except Exception as exc:
            logger.warning(
                "CV parse failed for candidate %s: %s",
                candidate.candidate_id,
                exc,
            )

    raw_skills = candidate.skills or ""
    skills = [s.strip() for s in raw_skills.split(",") if s.strip()]
    return {
        "skills": {"technical": skills, "soft": []},
        "education": [],
        "work_experience": [],
        "languages": [],
        "certifications": [],
        "projects": [],
    }


def match_parsed_cv_to_job(parsed_cv: dict, job: JobOffer) -> dict:
    """Run semantic matching against all manager job requirement fields."""
    job_requirements = build_job_requirements(job)
    try:
        return matching_service.match(parsed_cv, job_requirements)
    except Exception as exc:
        logger.warning("CV job match failed for job %s: %s", job.job_id, exc)
        return {
            "overall_score": 0.0,
            "match_percentage": 0.0,
            "category_scores": {},
            "details": {},
            "classification": "LOW",
            "recommendation": "",
        }


def match_candidate_to_job(
    db: Session, candidate: Candidate, job: JobOffer
) -> dict:
    parsed_cv = load_parsed_cv(db, candidate)
    return match_parsed_cv_to_job(parsed_cv, job)


def match_application(
    db: Session,
    app: Application,
    job: Optional[JobOffer] = None,
) -> Tuple[dict, Optional[Candidate]]:
    """Match one application; returns (result dict, candidate)."""
    candidate = (
        db.query(Candidate).filter(Candidate.candidate_id == app.candidate_id).first()
    )
    if not candidate:
        empty = {
            "overall_score": 0.0,
            "match_percentage": 0.0,
            "recommendation": "",
        }
        return empty, None

    if job is None:
        job = db.query(JobOffer).filter(JobOffer.job_id == app.job_id).first()
    if not job:
        empty = {
            "overall_score": 0.0,
            "match_percentage": 0.0,
            "recommendation": "",
        }
        return empty, candidate

    result = match_candidate_to_job(db, candidate, job)
    return result, candidate


def persist_application_match(db: Session, app: Application, result: dict) -> None:
    """Store canonical match on the application row."""
    app.final_score = float(result.get("overall_score", 0) or 0)
    app.ai_recommendation = result.get("recommendation", "") or ""


def match_and_persist_application(db: Session, app: Application) -> dict:
    result, _ = match_application(db, app)
    persist_application_match(db, app, result)
    return result


def format_match_reason(result: dict) -> str:
    """Human-readable reason for job board / CV upload UI."""
    recommendation = (result.get("recommendation") or "").strip()
    if recommendation:
        return recommendation

    pct = result.get("match_percentage")
    if pct is None:
        pct = round(float(result.get("overall_score", 0) or 0) * 100, 1)

    classification = result.get("classification") or ""
    if classification:
        return f"{classification} match ({pct}% overall vs full job requirements)."

    return f"{pct}% match against full job requirements."


def cv_match_percentage(result: dict) -> float:
    """0–100 display percentage (consistent everywhere)."""
    if result.get("match_percentage") is not None:
        return round(float(result["match_percentage"]), 1)
    return round(float(result.get("overall_score", 0) or 0) * 100, 1)


def rematch_all_applications_for_candidate(db: Session, candidate_id: str) -> int:
    """Recompute stored match scores after CV upload or profile change."""
    apps = (
        db.query(Application)
        .filter(Application.candidate_id == candidate_id)
        .all()
    )
    count = 0
    for app in apps:
        job = db.query(JobOffer).filter(JobOffer.job_id == app.job_id).first()
        if not job:
            continue
        match_and_persist_application(db, app)
        count += 1
    if count:
        db.commit()
    return count
