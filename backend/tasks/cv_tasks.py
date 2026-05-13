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
        if current_date.weekday() >= 5:  # Skip weekends
            continue
        
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
        logger.info(f"CV processed for candidate {candidate_id}: {len(cv_text)} chars")
        return {"status": "completed", "candidate_id": candidate_id}

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
        from models.candidate import Candidate
        from models.job_offer import JobOffer
        from services.matching_service import matching_service
        from services.ocr_service import ocr_service
        from services.ner_service import ner_service
        from models.cv_version import CVVersion
        import os

        app = db.query(Application).filter(
            Application.app_id == application_id
        ).first()
        if not app:
            return {"status": "error", "reason": "application_not_found"}

        candidate = db.query(Candidate).filter(
            Candidate.candidate_id == app.candidate_id
        ).first()
        job = db.query(JobOffer).filter(
            JobOffer.job_id == app.job_id
        ).first()

        if not candidate or not job:
            return {"status": "error", "reason": "candidate_or_job_not_found"}

        # Try to parse CV
        parsed_cv = None
        cv = db.query(CVVersion).filter(
            CVVersion.candidate_id == candidate.candidate_id,
            CVVersion.is_active == True
        ).order_by(CVVersion.version_number.desc()).first()

        if cv and cv.file_path and os.path.exists(cv.file_path):
            cv_text = ocr_service.extract_text(cv.file_path)
            if cv_text and len(cv_text.strip()) >= 30:
                parsed_cv = ner_service.parse_cv(cv_text)

        if not parsed_cv:
            raw_skills = (candidate.skills or "")
            skills = [s.strip() for s in raw_skills.split(",") if s.strip()]
            parsed_cv = {
                "skills": {"technical": skills, "soft": []},
                "education": [], "work_experience": [],
                "languages": [], "certifications": [], "projects": []
            }

        # Build job requirements
        required_skills = []
        if getattr(job, "required_skills", None):
            required_skills = [s.strip() for s in job.required_skills.split(",") if s.strip()]

        job_requirements = {
            "skills": {"required": required_skills, "preferred": []},
            "education": {"degree": getattr(job, "education_level", "") or ""},
            "experience": {"min_years": int(getattr(job, "experience_years", 0) or 0), "roles": []},
            "languages": []
        }

        result = matching_service.match(parsed_cv, job_requirements)

        # Update application with scores
        app.final_score = result.get("overall_score", 0)
        app.ai_recommendation = result.get("recommendation", "")
        db.commit()

        logger.info(f"Matching completed for application {application_id}: {result.get('match_percentage')}%")
        return {"status": "completed", "application_id": application_id, "score": result.get("overall_score")}

    except Exception as exc:
        logger.error(f"Matching failed for application {application_id}: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def process_job_closing(self, job_id: str):
    """
    Process job closing: deactivate job, rank CVs, select top 10 candidates,
    and send interview time proposals.
    """
    db = SessionLocal()
    try:
        from models.job_offer import JobOffer
        from models.application import Application, ApplicationStatus
        from models.candidate import Candidate
        from models.interview import Interview, InterviewStatus
        from models.notification import Notification
        from models.user import User
        from models.cv_version import CVVersion
        from services.matching_service import matching_service
        from services.ocr_service import ocr_service
        from services.ner_service import ner_service
        from services.mailer import send_email
        from core.config import settings
        import os

        job = db.query(JobOffer).filter(JobOffer.job_id == job_id).first()
        if not job:
            logger.warning(f"Job not found: {job_id}")
            return {"status": "error", "reason": "job_not_found"}

        # 1. Close the job
        job.is_active = False
        db.commit()
        logger.info(f"Job {job_id} closed: {job.title}")

        # 2. Get all applications for this job
        applications = db.query(Application).filter(
            Application.job_id == job_id
        ).all()

        if not applications:
            logger.info(f"No applications for job {job_id}")
            return {"status": "completed", "selected_count": 0}

        # 3. Compute/update semantic matching scores for all applications
        scored_applications = []
        for app in applications:
            candidate = db.query(Candidate).filter(
                Candidate.candidate_id == app.candidate_id
            ).first()
            if not candidate:
                continue

            # Try to parse CV
            parsed_cv = None
            cv = db.query(CVVersion).filter(
                CVVersion.candidate_id == candidate.candidate_id,
                CVVersion.is_active == True
            ).order_by(CVVersion.version_number.desc()).first()

            if cv and cv.file_path and os.path.exists(cv.file_path):
                try:
                    cv_text = ocr_service.extract_text(cv.file_path)
                    if cv_text and len(cv_text.strip()) >= 30:
                        parsed_cv = ner_service.parse_cv(cv_text)
                except Exception as e:
                    logger.warning(f"Could not parse CV for candidate {candidate.candidate_id}: {e}")

            if not parsed_cv:
                raw_skills = (candidate.skills or "")
                skills = [s.strip() for s in raw_skills.split(",") if s.strip()]
                parsed_cv = {
                    "skills": {"technical": skills, "soft": []},
                    "education": [], "work_experience": [],
                    "languages": [], "certifications": [], "projects": []
                }

            # Build job requirements
            required_skills = []
            if getattr(job, "required_skills", None):
                required_skills = [s.strip() for s in job.required_skills.split(",") if s.strip()]

            job_requirements = {
                "skills": {"required": required_skills, "preferred": []},
                "education": {"degree": getattr(job, "education_level", "") or ""},
                "experience": {"min_years": int(getattr(job, "experience_years", 0) or 0), "roles": []},
                "languages": []
            }

            result = matching_service.match(parsed_cv, job_requirements)
            score = result.get("overall_score", 0)
            
            # Update application score
            app.final_score = score
            app.ai_recommendation = result.get("recommendation", "")
            
            scored_applications.append({
                "application": app,
                "candidate": candidate,
                "score": score,
                "parsed_cv": parsed_cv
            })

        db.commit()

        # 4. Sort by score and select top 10
        scored_applications.sort(key=lambda x: x["score"], reverse=True)
        top_10 = scored_applications[:10]

        # 5. Generate interview time slots (next 7 days, 8am-5pm, every 45 min)
        start_date = datetime.utcnow() + timedelta(days=1)
        available_slots = generate_interview_time_slots(start_date, days=7)

        # 6. Create interview invitations with time proposals for top 10
        for item in top_10:
            app = item["application"]
            candidate = item["candidate"]

            # Update application status
            app.status = ApplicationStatus.SHORTLISTED
            
            # Get user info for email
            user = db.query(User).filter(User.user_id == candidate.user_id).first()
            if not user:
                continue

            # Check if interview already exists
            existing_interview = db.query(Interview).filter(
                Interview.application_id == app.app_id
            ).first()

            if existing_interview:
                interview = existing_interview
                interview.status = InterviewStatus.INVITED
            else:
                # Create new interview with time slot proposals
                interview = Interview(
                    interview_id=str(uuid.uuid4()),
                    application_id=app.app_id,
                    candidate_id=candidate.candidate_id,
                    job_id=job_id,
                    language="en",
                    status=InterviewStatus.INVITED,
                    auto_scheduled=False
                )
                db.add(interview)
                db.flush()
                interview.meeting_link = f"{settings.FRONTEND_URL}/candidate/interview/{interview.interview_id}"

            # Create notification with time slot proposals
            slots_text = "\n".join([s.strftime("%A %d %B %Y at %H:%M") for s in available_slots[:12]])
            notification = Notification(
                notification_id=str(uuid.uuid4()),
                user_id=candidate.user_id,
                company_id=job.company_id,
                title=f"Congratulations! Interview Invitation for {job.title}",
                message=f"You have been selected among the top candidates for the position of {job.title}! Please select your preferred interview time from the available slots in your dashboard.",
                type="INTERVIEW_TIME_SELECTION",
                reference_id=interview.interview_id,
                is_read=False
            )
            db.add(notification)

            # Send email with time slot proposals
            subject = f"Interview Invitation - {job.title} | TalentOs"
            body = f"""Hello {user.first_name},

Congratulations! You have been selected among the top candidates for the position of {job.title} at {job.company_name}.

Please log in to your dashboard to select your preferred interview time slot.

Available slots (next 7 days):
{slots_text}

Best regards,
{settings.APP_NAME}"""

            html_body = f"""<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:linear-gradient(135deg,#7B5AC8,#9683EC);padding:30px;border-radius:12px 12px 0 0;">
                <h1 style="color:white;margin:0;font-family:cursive;">Talent<span style="color:#f97316;">Os</span></h1>
            </div>
            <div style="padding:30px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
                <p>Hello <strong>{user.first_name}</strong>,</p>
                <p style="font-size:18px;color:#16a34a;font-weight:bold;">🎉 Congratulations!</p>
                <p>You have been selected among the <strong>top candidates</strong> for the position of <strong>{job.title}</strong> at {job.company_name}.</p>
                <p>Please select your preferred interview time slot from the available options:</p>
                <div style="background:#f5f3ff;border:1px solid #e9d5ff;border-radius:8px;padding:15px;margin:20px 0;">
                    <p style="margin:0;color:#5b21b6;font-weight:600;">Available Time Slots:</p>
                    <ul style="color:#374151;font-size:14px;">
                        {"".join([f"<li>{s.strftime('%A %d %B %Y at %H:%M')}</li>" for s in available_slots[:8]])}
                        <li>...and more</li>
                    </ul>
                </div>
                <div style="margin:20px 0;">
                    <a href="{settings.FRONTEND_URL}/candidate/interviews" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#7B5AC8,#9683EC);color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
                        Select Interview Time
                    </a>
                </div>
                <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;"/>
                <p style="color:#9ca3af;font-size:12px;">Best regards,<br/>{settings.APP_NAME}</p>
            </div>
            </body></html>"""

            send_email(user.email, subject, body, html=html_body)
            logger.info(f"Interview invitation sent to {user.email} for job {job.title}")

        db.commit()

        logger.info(f"Job closing completed for {job_id}: {len(top_10)} candidates selected")
        return {
            "status": "completed",
            "job_id": job_id,
            "total_applications": len(applications),
            "selected_count": len(top_10)
        }

    except Exception as exc:
        logger.error(f"Job closing failed for {job_id}: {exc}")
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()
