"""
Interview API routes for candidates and recruiters.
"""
import logging
import re
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
from pathlib import Path
from datetime import datetime, timedelta

from database import get_db
from core.dependencies import require_role
from models.user import User, UserRole
from models.interview import Interview, InterviewMessage, InterviewReport, InterviewStatus, InterviewPhase
from models.application import Application
from models.candidate import Candidate
from models.job_offer import JobOffer
from models.notification import Notification
from services.interview_service import get_interview_service
from services.mailer import send_email
from schemas.interview_schemas import (
    InterviewCreate,
    InterviewInviteRequest,
    InterviewInviteResponse,
    InterviewCandidateResponseRequest,
    ProposeTimeRequest,
    InterviewCandidateDetail,
    InterviewMessageItem,
    InterviewStart,
    InterviewMessageResponse,
    InterviewScoreResponse,
    InterviewReportResponse,
    InterviewListItem,
    InterviewDetail,
    TimeSlot,
    TimeSlotListResponse,
    SelectTimeSlotRequest,
    SelectTimeSlotResponse,
    InterviewLanguageUpdate,
)
from core.config import settings

router = APIRouter(prefix="/interviews", tags=["interviews"])
logger = logging.getLogger(__name__)


def _summary_looks_french(summary: str) -> bool:
    """Detect legacy French reports without matching English words like 'candidate'."""
    if not summary or not summary.strip():
        return False
    french_patterns = (
        r"\bLe candidat\b",
        r"\bLa candidate\b",
        r"\bcompétences\b",
        r"\bentretien\b",
        r"travail d['']équipe",
        r"\brecommandé\b",
        r"\bpoints forts\b",
    )
    hits = sum(1 for pattern in french_patterns if re.search(pattern, summary, re.I))
    return hits >= 2


def _build_candidate_interview_detail(db: Session, interview: Interview) -> InterviewCandidateDetail:
    messages = []
    if interview.status in (InterviewStatus.IN_PROGRESS, InterviewStatus.COMPLETED):
        rows = (
            db.query(InterviewMessage)
            .filter(InterviewMessage.interview_id == interview.interview_id)
            .order_by(InterviewMessage.turn_number.asc())
            .all()
        )
        messages = [
            InterviewMessageItem(
                role=r.role,
                content=r.content,
                audio_url=r.audio_url,
                turn_number=r.turn_number,
            )
            for r in rows
        ]

    return InterviewCandidateDetail(
        interview_id=interview.interview_id,
        application_id=interview.application_id,
        job_id=interview.job_id,
        language=interview.language,
        status=interview.status.value,
        scheduled_at=interview.scheduled_at,
        meeting_link=interview.meeting_link,
        candidate_response=interview.candidate_response,
        candidate_response_reason=interview.candidate_response_reason,
        candidate_responded_at=interview.candidate_responded_at,
        auto_scheduled=interview.auto_scheduled,
        candidate_availability_comment=interview.candidate_availability_comment,
        phase=interview.phase.value if interview.phase else None,
        turn_count=interview.turn_count,
        messages=messages,
    )


# ==================== CANDIDATE ENDPOINTS ====================

@router.get("/candidate/my-interviews", response_model=list[InterviewListItem])
def get_candidate_interviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE)),
):
    """Get all interviews for the logged-in candidate."""
    try:
        from services.job_closing_service import sync_job_closings

        sync_job_closings(db)

        candidate = db.query(Candidate).filter(Candidate.user_id == current_user.user_id).first()
        if not candidate:
            return []

        interviews = (
            db.query(Interview)
            .filter(Interview.candidate_id == candidate.candidate_id)
            .order_by(Interview.created_at.desc())
            .all()
        )

        candidate_name = f"{current_user.first_name} {current_user.last_name}".strip()
        result = []
        for interview in interviews:
            job = db.query(JobOffer).filter(JobOffer.job_id == interview.job_id).first()
            result.append(
                InterviewListItem(
                    interview_id=interview.interview_id,
                    candidate_name=candidate_name,
                    job_title=job.title if job else "Unknown",
                    status=interview.status.value,
                    language=interview.language,
                    created_at=interview.created_at,
                    scheduled_at=interview.scheduled_at,
                    meeting_link=interview.meeting_link,
                    candidate_response=interview.candidate_response,
                    candidate_response_reason=interview.candidate_response_reason,
                    completed_at=interview.completed_at,
                    phase=interview.phase.value,
                    turn_count=interview.turn_count,
                )
            )

        return result
    except Exception as e:
        logger.error(f"Error fetching candidate interviews: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/candidate/{interview_id}/start")
def start_interview(
    interview_id: str,
    request: InterviewStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE))
):
    """
    Start interview: select language and receive opening question.
    """
    try:
        candidate = db.query(Candidate).filter(Candidate.user_id == current_user.user_id).first()
        if not candidate:
            raise HTTPException(status_code=403, detail="Unauthorized")

        interview = db.query(Interview).filter(
            Interview.interview_id == interview_id
        ).first()

        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        if interview.candidate_id != candidate.candidate_id:
            raise HTTPException(status_code=403, detail="Unauthorized")

        from services.interview_scheduling import is_interview_start_allowed

        if interview.status == InterviewStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="This interview is already completed.")
        if interview.status == InterviewStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=400,
                detail="This interview is already in progress and cannot be resumed.",
            )
        if interview.status != InterviewStatus.INVITED:
            raise HTTPException(status_code=400, detail="This interview cannot be started.")

        if not is_interview_start_allowed(interview.scheduled_at):
            raise HTTPException(
                status_code=400,
                detail="The interview cannot start before the scheduled day.",
            )

        interview_service = get_interview_service()
        result = interview_service.start_interview(
            db=db,
            interview_id=interview_id,
            language=request.language,
        )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting interview {interview_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/candidate/{interview_id}/turn", response_model=InterviewMessageResponse)
def process_interview_turn(
    interview_id: str,
    audio_file: UploadFile = File(...),
    video_file: UploadFile = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE))
):
    """
    Process one interview turn: receive audio/video, generate response.
    """
    try:
        candidate = db.query(Candidate).filter(Candidate.user_id == current_user.user_id).first()
        if not candidate:
            raise HTTPException(status_code=403, detail="Unauthorized")

        interview = db.query(Interview).filter(
            Interview.interview_id == interview_id
        ).first()

        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        if interview.candidate_id != candidate.candidate_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Save uploaded files
        media_dir = Path(settings.INTERVIEW_MEDIA_DIR)
        media_dir.mkdir(exist_ok=True)
        
        # Save audio
        audio_path = media_dir / f"audio_{interview_id}_{interview.turn_count}.webm"
        content = audio_file.file.read()
        with open(audio_path, "wb") as f:
            f.write(content)
        
        # Save video if provided
        video_path = None
        if video_file:
            video_path = media_dir / f"video_{interview_id}_{interview.turn_count}.webm"
            content = video_file.file.read()
            with open(video_path, "wb") as f:
                f.write(content)
        
        # Process turn
        interview_service = get_interview_service()
        result = interview_service.process_turn(
            db=db,
            interview_id=interview_id,
            audio_webm_path=str(audio_path),
            video_webm_path=str(video_path) if video_path else None
        )
        
        return InterviewMessageResponse(**result)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing turn for interview {interview_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/candidate/{interview_id}/end")
def end_interview(
    interview_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE))
):
    """
    End interview manually before max turns.
    """
    try:
        candidate = db.query(Candidate).filter(Candidate.user_id == current_user.user_id).first()
        if not candidate:
            raise HTTPException(status_code=403, detail="Unauthorized")

        interview = db.query(Interview).filter(
            Interview.interview_id == interview_id
        ).first()

        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        if interview.candidate_id != candidate.candidate_id:
            raise HTTPException(status_code=403, detail="Unauthorized")

        if interview.status == InterviewStatus.COMPLETED:
            return {
                "status": "ended",
                "message": "Interview already completed.",
            }

        if interview.status != InterviewStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=400,
                detail="Interview is not in progress",
            )

        ended_early = interview.phase != InterviewPhase.DONE
        state = dict(interview.session_state or {})
        if ended_early:
            state["ended_early"] = True
            interview.session_state = state

        interview.status = InterviewStatus.COMPLETED
        interview.completed_at = datetime.utcnow()
        interview.phase = InterviewPhase.DONE
        db.commit()

        interview_service = get_interview_service()
        interview_service.ensure_interview_report(
            db, interview_id, ended_early=ended_early
        )

        return {
            "status": "ended",
            "message": "Interview completed. Thank you for participating.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ending interview {interview_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/candidate/{interview_id}/scores", response_model=InterviewReportResponse)
def get_interview_scores(
    interview_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE))
):
    """Candidate can view their interview evaluation after completion."""
    from models.interview import InterviewReport
    from services.interview_service import get_interview_service

    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.user_id).first()
    if not candidate:
        raise HTTPException(status_code=403, detail="Unauthorized")

    interview = db.query(Interview).filter(Interview.interview_id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    if interview.candidate_id != candidate.candidate_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    report = (
        db.query(InterviewReport)
        .filter(InterviewReport.interview_id == interview_id)
        .first()
    )

    if interview.status != InterviewStatus.COMPLETED and not report:
        raise HTTPException(
            status_code=400,
            detail="Results are available after the interview is completed",
        )

    interview_service = get_interview_service()

    if report and report.summary and _summary_looks_french(report.summary):
        interview_service.generate_report(db, interview_id, force=True)
        report = (
            db.query(InterviewReport)
            .filter(InterviewReport.interview_id == interview_id)
            .first()
        )

    if not report and interview.status == InterviewStatus.COMPLETED:
        ended_early = bool((interview.session_state or {}).get("ended_early"))
        interview_service._generate_fallback_report(
            db, interview_id, ended_early=ended_early
        )
        report = (
            db.query(InterviewReport)
            .filter(InterviewReport.interview_id == interview_id)
            .first()
        )

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Evaluation report is not ready yet. Please check back shortly.",
        )

    rec = report.recommendation
    if hasattr(rec, "value"):
        rec = rec.value

    return InterviewReportResponse(
        overall_score=report.overall_score,
        communication_score=report.communication_score,
        technical_score=report.technical_score,
        motivation_score=report.motivation_score,
        recommendation=rec,
        strengths=report.strengths or [],
        weaknesses=report.weaknesses or [],
        technical_competencies=report.technical_competencies or [],
        soft_skills=report.soft_skills or {},
        red_flags=report.red_flags or [],
        follow_up_questions=report.follow_up_questions or [],
        summary=report.summary or "",
    )


# ==================== TIME SLOT SELECTION ENDPOINTS ====================

from services.interview_scheduling import build_slots_payload, apply_interview_schedule


@router.get("/candidate/{interview_id}/time-slots", response_model=TimeSlotListResponse)
def get_available_time_slots(
    interview_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE))
):
    """Get available interview days (7 days including today, one slot per day)."""
    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.user_id).first()
    if not candidate:
        raise HTTPException(status_code=403, detail="Unauthorized")

    interview = db.query(Interview).filter(
        Interview.interview_id == interview_id
    ).first()

    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if interview.candidate_id != candidate.candidate_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    job = db.query(JobOffer).filter(JobOffer.job_id == interview.job_id).first()
    job_title = job.title if job else "Unknown Position"
    payload = build_slots_payload(db, interview, job_title)

    slots = [
        TimeSlot(
            datetime=s["datetime"],
            formatted=s["formatted"],
            available=s["available"],
        )
        for s in payload["slots"]
    ]

    return TimeSlotListResponse(
        interview_id=interview_id,
        job_title=job_title,
        slots=slots,
        week_start=payload["week_start"],
        week_end=payload["week_end"],
    )


@router.patch("/candidate/{interview_id}/language")
def update_interview_language(
    interview_id: str,
    payload: InterviewLanguageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE)),
):
    """Set interview language (English or French) before the session starts."""
    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.user_id).first()
    if not candidate:
        raise HTTPException(status_code=403, detail="Unauthorized")

    interview = db.query(Interview).filter(Interview.interview_id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    if interview.candidate_id != candidate.candidate_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    if interview.status not in (InterviewStatus.INVITED,):
        raise HTTPException(status_code=400, detail="Language can only be changed before the interview starts")

    interview.language = payload.language
    db.commit()
    return {"interview_id": interview_id, "language": interview.language}


@router.post("/candidate/{interview_id}/select-time", response_model=SelectTimeSlotResponse)
def select_interview_time_slot(
    interview_id: str,
    payload: SelectTimeSlotRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE))
):
    """Select an interview day from the available options."""
    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.user_id).first()
    if not candidate:
        raise HTTPException(status_code=403, detail="Unauthorized")

    interview = db.query(Interview).filter(
        Interview.interview_id == interview_id
    ).first()

    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if interview.candidate_id != candidate.candidate_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    try:
        result = apply_interview_schedule(
            db,
            interview,
            payload.selected_datetime,
            via_email=False,
            language=payload.language,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    scheduled = result["scheduled_at"]
    if isinstance(scheduled, str):
        scheduled = datetime.fromisoformat(scheduled)

    return SelectTimeSlotResponse(
        message=result["message"],
        interview_id=result["interview_id"],
        scheduled_at=scheduled,
        meeting_link=result["meeting_link"],
    )


# ==================== RECRUITER ENDPOINTS ====================

@router.post("/candidate/{interview_id}/propose-time")
def propose_interview_time(
    interview_id: str,
    payload: ProposeTimeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE))
):
    interview = db.query(Interview).filter(
        Interview.interview_id == interview_id
    ).first()

    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.user_id).first()
    if not candidate or candidate.candidate_id != interview.candidate_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    interview.candidate_availability_comment = payload.availability_comment.strip()
    
    # Normally here we would parse the comment to update `scheduled_at`,
    # but for now we'll just save the comment and notify the recruiter.
    
    job_offer = db.query(JobOffer).filter(JobOffer.job_id == interview.job_id).first()
    recruiter_id = job_offer.posted_by if job_offer else None

    if recruiter_id:
        recruiter_notification = Notification(
            notification_id=str(uuid.uuid4()),
            user_id=recruiter_id,
            company_id=job_offer.company_id if job_offer else current_user.company_id,
            title="Interview Time Proposed",
            message=f"{current_user.first_name} {current_user.last_name} proposed a new time: {interview.candidate_availability_comment}",
            type="INTERVIEW_RESPONSE",
            reference_id=interview.interview_id,
            is_read=False
        )
        db.add(recruiter_notification)

    db.commit()

    return {"message": "Availability proposed"}


@router.get("/candidate/{interview_id}", response_model=InterviewCandidateDetail)
def get_candidate_interview_detail(
    interview_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE))
):
    interview = db.query(Interview).filter(
        Interview.interview_id == interview_id
    ).first()

    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.user_id).first()
    if not candidate or candidate.candidate_id != interview.candidate_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    return _build_candidate_interview_detail(db, interview)


@router.post("/candidate/{interview_id}/respond")
def respond_to_candidate_interview(
    interview_id: str,
    payload: InterviewCandidateResponseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CANDIDATE))
):
    interview = db.query(Interview).filter(
        Interview.interview_id == interview_id
    ).first()

    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.user_id).first()
    if not candidate or candidate.candidate_id != interview.candidate_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if interview.candidate_response:
        raise HTTPException(status_code=409, detail="You already responded to this invitation")

    if payload.action == "ACCEPTED":
        interview.candidate_response = "ACCEPTED"
        interview.candidate_response_reason = payload.reason.strip() if payload.reason else None
        interview.candidate_responded_at = datetime.utcnow()
        if not interview.meeting_link:
            interview.meeting_link = f"{settings.FRONTEND_URL}/candidate/interview/{interview.interview_id}"
        response_title = "Interview Accepted"
        response_message = f"{current_user.first_name} {current_user.last_name} accepted the interview invitation."
        if interview.candidate_response_reason:
            response_message += f"\n\nJustification: {interview.candidate_response_reason}"
    else:
        interview.candidate_response = "REFUSED"
        interview.candidate_response_reason = payload.reason.strip() if payload.reason else None
        interview.candidate_responded_at = datetime.utcnow()
        interview.status = InterviewStatus.CANCELLED
        interview.completed_at = datetime.utcnow()
        
        # Format scheduled time for original interview
        scheduled_time_str = interview.scheduled_at.strftime("%Y-%m-%d %H:%M UTC") if interview.scheduled_at else "TBD"

        # AI Approach: Try to extract a proposed time from the refusal reason using Groq
        proposed_time = None
        if interview.candidate_response_reason:
            try:
                from groq import Groq
                client = Groq(api_key=settings.GROQ_API_KEY)
                now_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
                original_time_str = interview.scheduled_at.strftime('%H:%M:%S') if interview.scheduled_at else "09:00:00"
                prompt = f"""The current UTC datetime is {now_str}.
The original interview was scheduled for a time of day of {original_time_str} UTC.
A candidate has refused an interview with the reason: "{interview.candidate_response_reason}"

If the candidate is proposing a new time (e.g. "in 5 minutes", "tomorrow at 3pm"), extract the exact UTC datetime they are proposing. 
If they only provide a date (e.g. "tomorrow", "next Monday") without specifying a time of day, default the time to exactly {original_time_str}.
If they are NOT proposing a new time (e.g. "I found a job", "not interested"), return exactly "NONE".

Respond ONLY with a JSON object in this exact format:
{{"proposed_time": "YYYY-MM-DD HH:MM:SS"}}
or
{{"proposed_time": "NONE"}}
Do not include any other markdown formatting or explanatory text.
"""
                response = client.chat.completions.create(
                    model=settings.GROQ_LLM_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.0
                )
                
                content = response.choices[0].message.content.strip()
                if content.startswith("```json"):
                    content = content[7:-3].strip()
                elif content.startswith("```"):
                    content = content[3:-3].strip()
                
                data = json.loads(content)
                proposed_time_str = data.get("proposed_time")
                
                if proposed_time_str and proposed_time_str != "NONE":
                    proposed_time = datetime.strptime(proposed_time_str, '%Y-%m-%d %H:%M:%S')
                    logger.info(f"AI extracted proposed time: {proposed_time} from reason: {interview.candidate_response_reason}")
            except Exception as e:
                logger.error(f"Failed to extract proposed time with Groq: {e}")

        job_offer = db.query(JobOffer).filter(JobOffer.job_id == interview.job_id).first()
        recruiter_id = job_offer.posted_by if job_offer else None

        if proposed_time:
            # We recreate a new auto-scheduled interview
            new_interview = Interview(
                application_id=interview.application_id,
                candidate_id=interview.candidate_id,
                job_id=interview.job_id,
                language=interview.language,
                scheduled_at=proposed_time,
                auto_scheduled=True
            )
            db.add(new_interview)
            db.flush()
            new_interview.meeting_link = f"{settings.FRONTEND_URL}/candidate/interview/{new_interview.interview_id}"
            
            new_schedule_text = proposed_time.strftime("%Y-%m-%d %H:%M UTC")
            
            candidate_message = (
                f"We understood you proposed a new time. "
                f"We have automatically rescheduled your interview to {new_schedule_text}. "
                f"You can see your new invitation in your dashboard."
            )
            
            # Dispatch email task for new interview
            try:
                from tasks.notification_tasks import send_interview_email_async, send_interview_reminder
                send_interview_email_async.delay(current_user.user_id, new_interview.interview_id)
                send_interview_reminder.apply_async(
                    args=[new_interview.interview_id],
                    eta=proposed_time
                )
            except Exception as e:
                logger.error(f"Could not queue tasks for rescheduled interview: {str(e)}")
        else:
            # Single notification for standard rejection without a proposed time
            candidate_message = (
                f"Thank you for your response. We understand you've declined the interview scheduled for {scheduled_time_str}. "
                f"We appreciate your interest and hope to connect with you in the future."
            )

        candidate_notification = Notification(
            notification_id=str(uuid.uuid4()),
            user_id=current_user.user_id,
            company_id=job_offer.company_id if job_offer else current_user.company_id,
            title="Interview Rescheduled" if proposed_time else "Interview Declined",
            message=candidate_message,
            type="INTERVIEW_INVITED" if proposed_time else "INTERVIEW_RESPONSE",
            reference_id=new_interview.interview_id if proposed_time else interview.interview_id,
            is_read=False
        )
        db.add(candidate_notification)
        
        # Create system log entry
        logger.info(f"Candidate {current_user.user_id} refused interview {interview.interview_id}. Reason: {interview.candidate_response_reason}")
        
        # Auto-generate system response to candidate (shown in chat transcript of the old interview)
        system_message = InterviewMessage(
            interview_id=interview.interview_id,
            role="bot",
            content=candidate_message,
            phase=InterviewPhase.CLOSING,
            turn_number=0,
            signals={}
        )
        db.add(system_message)
        
        db.commit()
        db.refresh(interview)
        return {
            "message": "Interview response saved and rescheduled" if proposed_time else "Interview response saved",
            "status": interview.status.value,
            "candidate_response": interview.candidate_response
        }

    # The ACCEPTED flow continues below
    job_offer = db.query(JobOffer).filter(JobOffer.job_id == interview.job_id).first()
    recruiter_id = job_offer.posted_by if job_offer else None

    if not recruiter_id:
        raise HTTPException(status_code=404, detail="Recruiter not found for this interview")

    # Format scheduled time for notification
    scheduled_time_str = interview.scheduled_at.strftime("%Y-%m-%d %H:%M UTC") if interview.scheduled_at else "TBD"

    # Notification 1: Confirmation with time and link
    confirmation_message = (
        f"Interview confirmed! Your interview is scheduled for {scheduled_time_str}. "
    )
    if interview.meeting_link:
        confirmation_message += f"Join using this link: {interview.meeting_link}"
    
    confirmation_notification = Notification(
        notification_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        company_id=job_offer.company_id if job_offer else current_user.company_id,
        title="Interview Confirmed",
        message=confirmation_message,
        type="INTERVIEW_RESPONSE",
        reference_id=interview.interview_id,
        is_read=False
    )
    db.add(confirmation_notification)
    
    # Notification 2: Auto-response with scheduled time
    auto_response_message = (
        f"Your interview with our team is confirmed for {scheduled_time_str}. "
        f"Please be ready a few minutes before. If you have any questions, feel free to reach out."
    )
    auto_response_notification = Notification(
        notification_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        company_id=job_offer.company_id if job_offer else current_user.company_id,
        title="Interview Details",
        message=auto_response_message,
        type="INTERVIEW_RESPONSE",
        reference_id=interview.interview_id,
        is_read=False
    )
    db.add(auto_response_notification)

    db.commit()
    db.refresh(interview)

    return {
        "message": "Interview response saved",
        "status": interview.status.value,
        "candidate_response": interview.candidate_response
    }


@router.get("/recruiter/all", response_model=list[InterviewDetail])
def get_recruiter_interviews(
    recruiter_id: str,
    job_id: str = None,
    db: Session = Depends(get_db)
):
    """
    Get all interviews for recruiter's jobs.
    """
    try:
        query = db.query(Interview)
        if job_id:
            query = query.filter(Interview.job_id == job_id)
        
        interviews = query.all()
        return [
            InterviewDetail(
                interview_id=i.interview_id,
                application_id=i.application_id,
                candidate_id=i.candidate_id,
                job_id=i.job_id,
                language=i.language,
                status=i.status.value,
                phase=i.phase.value,
                turn_count=i.turn_count,
                created_at=i.created_at,
                scheduled_at=i.scheduled_at,
                meeting_link=i.meeting_link,
                started_at=i.started_at,
                completed_at=i.completed_at
            )
            for i in interviews
        ]
    except Exception as e:
        logger.error(f"Error fetching recruiter interviews: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recruiter/{interview_id}/detail", response_model=InterviewDetail)
def get_interview_detail(
    interview_id: str,
    recruiter_id: str,
    db: Session = Depends(get_db)
):
    """
    Get full interview details with transcript.
    """
    try:
        interview = db.query(Interview).filter(
            Interview.interview_id == interview_id
        ).first()
        
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        return InterviewDetail(
            interview_id=interview.interview_id,
            application_id=interview.application_id,
            candidate_id=interview.candidate_id,
            job_id=interview.job_id,
            language=interview.language,
            status=interview.status.value,
            phase=interview.phase.value,
            turn_count=interview.turn_count,
            created_at=interview.created_at,
            scheduled_at=interview.scheduled_at,
            meeting_link=interview.meeting_link,
            started_at=interview.started_at,
            completed_at=interview.completed_at
        )
    except Exception as e:
        logger.error(f"Error fetching interview detail: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recruiter/{interview_id}/report", response_model=InterviewReportResponse)
def get_interview_report(
    interview_id: str,
    recruiter_id: str,
    db: Session = Depends(get_db)
):
    """
    Get AI evaluation report.
    """
    try:
        report = db.query(InterviewReport).filter(
            InterviewReport.interview_id == interview_id
        ).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not available")
        
        return InterviewReportResponse(
            overall_score=report.overall_score,
            communication_score=report.communication_score,
            technical_score=report.technical_score,
            motivation_score=report.motivation_score,
            recommendation=report.recommendation.value,
            strengths=report.strengths or [],
            weaknesses=report.weaknesses or [],
            summary=report.summary or ""
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching interview report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
