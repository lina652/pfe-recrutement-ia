"""Final selection: interview readiness checks and composite scoring."""

import logging
from typing import Any, Optional

from sqlalchemy.orm import Session

from models.application import Application, ApplicationStatus
from models.candidate import Candidate
from models.interview import Interview, InterviewReport, InterviewStatus
from models.job_offer import JobOffer
from models.requirement_request import RequirementRequest, RequestStatus
from models.user import User
from services.cv_job_matching import (
    cv_match_percentage,
    match_application,
)

logger = logging.getLogger(__name__)

CV_WEIGHT = 0.35
INTERVIEW_WEIGHT = 0.65


def _accepted_requirements_for_manager(
    db: Session, manager_user_id: str, company_id: str
):
    return (
        db.query(RequirementRequest)
        .filter(
            RequirementRequest.submitted_by == manager_user_id,
            RequirementRequest.company_id == company_id,
            RequirementRequest.status == RequestStatus.ACCEPTED,
        )
        .order_by(RequirementRequest.reviewed_at.desc().nullslast())
        .all()
    )


def _match_job_for_requirement(
    db: Session, req: RequirementRequest, company_id: str
) -> Optional[JobOffer]:
    """Resolve job for an accepted requirement (salary+title first, then created_job_id)."""
    req_salary = (req.salary_range or "").strip()

    if req_salary:
        by_salary = (
            db.query(JobOffer)
            .filter(
                JobOffer.company_id == company_id,
                JobOffer.title == req.title,
                JobOffer.salary_range == req_salary,
            )
            .order_by(JobOffer.posted_date.desc())
            .first()
        )
        if by_salary:
            return by_salary

    if req.created_job_id:
        job = (
            db.query(JobOffer)
            .filter(
                JobOffer.job_id == req.created_job_id,
                JobOffer.company_id == company_id,
            )
            .first()
        )
        if job:
            return job

    matches = (
        db.query(JobOffer)
        .filter(
            JobOffer.company_id == company_id,
            JobOffer.title == req.title,
        )
        .order_by(JobOffer.posted_date.desc())
        .all()
    )
    if len(matches) == 1:
        return matches[0]
    return None


def manager_job_ids(db: Session, manager_user_id: str, company_id: str) -> list[str]:
    """Distinct job IDs this manager may use in final selection."""
    return list(
        dict.fromkeys(
            row["job_id"]
            for row in list_manager_final_selection_jobs(
                db, manager_user_id, company_id
            )
        )
    )


def list_manager_final_selection_jobs(
    db: Session, manager_user_id: str, company_id: str
) -> list[dict[str, Any]]:
    """
    One entry per accepted requirement request (each can map to a different job
    even when titles match, e.g. two senior backend roles with different salary).
    """
    entries: list[dict[str, Any]] = []
    seen_request_ids: set[str] = set()

    for req in _accepted_requirements_for_manager(db, manager_user_id, company_id):
        if req.request_id in seen_request_ids:
            continue
        seen_request_ids.add(req.request_id)

        job = _match_job_for_requirement(db, req, company_id)
        if not job:
            continue

        readiness = interview_readiness(db, job.job_id)
        shortlisted = get_shortlisted_applications(db, job.job_id)

        salary = (job.salary_range or req.salary_range or "").strip()
        department = (job.department or req.department or "").strip()
        subtitle_parts = [p for p in (salary, department) if p]

        entries.append(
            {
                "job_id": job.job_id,
                "requirement_request_id": req.request_id,
                "title": job.title,
                "subtitle": " · ".join(subtitle_parts) if subtitle_parts else None,
                "salary_range": salary or None,
                "department": department or None,
                "closing_processed": bool(job.closing_processed),
                "ready_for_selection": readiness["ready"],
                "shortlisted_count": len(shortlisted),
                "interviews_completed": readiness["completed_interviews"],
            }
        )

    return entries


def _candidate_display_name(db: Session, candidate_id: str) -> str:
    candidate = db.query(Candidate).filter(Candidate.candidate_id == candidate_id).first()
    if not candidate:
        return "Unknown"
    user = db.query(User).filter(User.user_id == candidate.user_id).first()
    if not user:
        return "Unknown"
    name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return name or user.email or "Unknown"


def build_shortlisted_preview(db: Session, job_id: str) -> list[dict]:
    """Names + interview status for shortlisted apps (visible before all interviews complete)."""
    preview = []
    for app in get_shortlisted_applications(db, job_id):
        interview = (
            db.query(Interview)
            .filter(Interview.application_id == app.app_id)
            .order_by(Interview.created_at.desc())
            .first()
        )
        status = "not_invited"
        if interview:
            status = (
                interview.status.value
                if hasattr(interview.status, "value")
                else str(interview.status)
            )
        preview.append(
            {
                "app_id": app.app_id,
                "candidate_name": _candidate_display_name(db, app.candidate_id),
                "interview_status": status,
            }
        )
    return preview


def get_shortlisted_applications(db: Session, job_id: str) -> list[Application]:
    return (
        db.query(Application)
        .filter(
            Application.job_id == job_id,
            Application.status == ApplicationStatus.SHORTLISTED,
        )
        .all()
    )


def interview_readiness(db: Session, job_id: str) -> dict:
    """
    Returns whether every shortlisted candidate has completed their interview
    and has an evaluation report.
    """
    apps = get_shortlisted_applications(db, job_id)
    if not apps:
        return {
            "ready": False,
            "total_shortlisted": 0,
            "completed_interviews": 0,
            "pending_interviews": 0,
            "missing_reports": 0,
        }

    completed = 0
    pending = 0
    missing_reports = 0

    for app in apps:
        interview = (
            db.query(Interview)
            .filter(Interview.application_id == app.app_id)
            .order_by(Interview.created_at.desc())
            .first()
        )
        if not interview or interview.status != InterviewStatus.COMPLETED:
            pending += 1
            continue

        report = (
            db.query(InterviewReport)
            .filter(InterviewReport.interview_id == interview.interview_id)
            .first()
        )
        if not report:
            missing_reports += 1
            pending += 1
            continue

        completed += 1

    ready = len(apps) > 0 and pending == 0
    return {
        "ready": ready,
        "total_shortlisted": len(apps),
        "completed_interviews": completed,
        "pending_interviews": pending,
        "missing_reports": missing_reports,
    }


def compute_cv_score(db: Session, app: Application, job: JobOffer) -> tuple[float, str, dict]:
    """Same NER + full job requirements matching as apply, job board, and closing."""
    from services.cv_job_matching import match_application, persist_application_match

    result, candidate = match_application(db, app, job)
    if not candidate:
        return 0.0, "", {}

    persist_application_match(db, app, result)
    score = float(result.get("overall_score", 0) or 0)
    recommendation = result.get("recommendation", "") or ""
    return score, recommendation, result


def compute_composite_score(cv_score_0_1: float, interview_score_0_100: float) -> float:
    """Return composite score on 0–100 scale."""
    interview_norm = max(0.0, min(interview_score_0_100 / 100.0, 1.0))
    cv_norm = max(0.0, min(cv_score_0_1, 1.0))
    composite = CV_WEIGHT * cv_norm + INTERVIEW_WEIGHT * interview_norm
    return round(composite * 100, 1)


def build_candidate_row(
    db: Session,
    app: Application,
    job: JobOffer,
    interview: Interview,
    report: InterviewReport,
) -> dict:
    candidate = (
        db.query(Candidate).filter(Candidate.candidate_id == app.candidate_id).first()
    )
    user = (
        db.query(User).filter(User.user_id == candidate.user_id).first()
        if candidate
        else None
    )
    candidate_name = (
        f"{user.first_name or ''} {user.last_name or ''}".strip()
        if user
        else "Unknown"
    )

    cv_score, cv_recommendation, match_result = compute_cv_score(db, app, job)
    interview_score = float(report.overall_score or 0)
    composite = compute_composite_score(cv_score, interview_score)

    rec_value = report.recommendation
    if hasattr(rec_value, "value"):
        rec_value = rec_value.value

    return {
        "app_id": app.app_id,
        "candidate_id": app.candidate_id,
        "candidate_name": candidate_name or "Unknown",
        "job_id": job.job_id,
        "job_title": job.title,
        "interview_id": interview.interview_id,
        "composite_score": composite,
        "cv_score": cv_match_percentage(match_result) if match_result else round(cv_score * 100, 1),
        "interview_score": round(interview_score, 1),
        "ai_recommendation": cv_recommendation or app.ai_recommendation,
        "interview_recommendation": rec_value,
        "interview_summary": report.summary,
    }


def get_final_selection_candidates(db: Session, job_id: str) -> dict:
    job = db.query(JobOffer).filter(JobOffer.job_id == job_id).first()
    if not job:
        return {"error": "job_not_found"}

    readiness = interview_readiness(db, job_id)
    preview = build_shortlisted_preview(db, job_id)

    if not readiness["ready"]:
        return {
            "job_id": job_id,
            "title": job.title,
            "ready": False,
            "message": (
                "Waiting for all shortlisted candidates to complete their interviews."
                if readiness["total_shortlisted"] > 0
                else "No shortlisted candidates for this job yet."
            ),
            "pending_interviews": readiness["pending_interviews"],
            "total_shortlisted": readiness["total_shortlisted"],
            "shortlisted_preview": preview,
            "candidates": [],
        }

    apps = get_shortlisted_applications(db, job_id)
    candidates = []

    for app in apps:
        interview = (
            db.query(Interview)
            .filter(Interview.application_id == app.app_id)
            .order_by(Interview.created_at.desc())
            .first()
        )
        if not interview:
            continue
        report = (
            db.query(InterviewReport)
            .filter(InterviewReport.interview_id == interview.interview_id)
            .first()
        )
        if not report:
            continue
        candidates.append(build_candidate_row(db, app, job, interview, report))

    candidates.sort(key=lambda c: c["composite_score"], reverse=True)
    db.commit()

    return {
        "job_id": job_id,
        "title": job.title,
        "ready": True,
        "message": None,
        "pending_interviews": 0,
        "total_shortlisted": len(apps),
        "shortlisted_preview": preview,
        "candidates": candidates,
    }
