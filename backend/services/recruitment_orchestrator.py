"""
LangGraph Orchestrator for End-to-End Recruitment Workflow.

This service uses LangGraph to orchestrate the entire recruitment process:
1. Job Posting (after HR approval)
2. Application Processing (CV OCR + NER)
3. Semantic Matching
4. Job Closing & Top 10 Selection
5. Interview Scheduling
6. Interview Execution
7. Report Generation
8. Final Selection & Notification
"""
import logging
import uuid
from datetime import datetime, timedelta
from typing import TypedDict, Annotated, List, Optional, Literal
from operator import add

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from sqlalchemy.orm import Session

from core.config import settings

logger = logging.getLogger(__name__)


class RecruitmentState(TypedDict):
    """State for the recruitment workflow."""
    job_id: str
    company_id: str
    phase: str
    applications: List[dict]
    top_candidates: List[dict]
    scheduled_interviews: List[dict]
    completed_interviews: List[dict]
    final_selection: Optional[dict]
    messages: Annotated[List[str], add]
    errors: Annotated[List[str], add]
    current_step: str
    is_complete: bool


class RecruitmentOrchestrator:
    """
    LangGraph-based orchestrator for the recruitment workflow.
    """
    
    def __init__(self):
        self.memory = MemorySaver()
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow."""
        workflow = StateGraph(RecruitmentState)
        
        # Add nodes
        workflow.add_node("process_applications", self._process_applications)
        workflow.add_node("compute_matching", self._compute_matching)
        workflow.add_node("check_closing_date", self._check_closing_date)
        workflow.add_node("select_top_candidates", self._select_top_candidates)
        workflow.add_node("schedule_interviews", self._schedule_interviews)
        workflow.add_node("process_interviews", self._process_interviews)
        workflow.add_node("generate_reports", self._generate_reports)
        workflow.add_node("prepare_final_selection", self._prepare_final_selection)
        workflow.add_node("complete_workflow", self._complete_workflow)
        
        # Set entry point
        workflow.set_entry_point("process_applications")
        
        # Add edges
        workflow.add_edge("process_applications", "compute_matching")
        workflow.add_edge("compute_matching", "check_closing_date")
        
        # Conditional edge: if closing date reached, select top candidates
        workflow.add_conditional_edges(
            "check_closing_date",
            self._should_close_job,
            {
                "close": "select_top_candidates",
                "wait": END  # Wait until closing date
            }
        )
        
        workflow.add_edge("select_top_candidates", "schedule_interviews")
        workflow.add_edge("schedule_interviews", "process_interviews")
        
        # Conditional edge: check if all interviews are done
        workflow.add_conditional_edges(
            "process_interviews",
            self._all_interviews_complete,
            {
                "complete": "generate_reports",
                "pending": END  # Wait for interviews
            }
        )
        
        workflow.add_edge("generate_reports", "prepare_final_selection")
        workflow.add_edge("prepare_final_selection", "complete_workflow")
        workflow.add_edge("complete_workflow", END)
        
        return workflow.compile(checkpointer=self.memory)
    
    def _should_close_job(self, state: RecruitmentState) -> Literal["close", "wait"]:
        """Check if job should be closed based on closing date."""
        return state.get("phase") == "closing" and "close" or "wait"
    
    def _all_interviews_complete(self, state: RecruitmentState) -> Literal["complete", "pending"]:
        """Check if all scheduled interviews are complete."""
        scheduled = len(state.get("scheduled_interviews", []))
        completed = len(state.get("completed_interviews", []))
        return "complete" if completed >= scheduled else "pending"
    
    def _process_applications(self, state: RecruitmentState) -> RecruitmentState:
        """Process new applications: OCR and NER on CVs."""
        from database import SessionLocal
        from models.application import Application
        from models.candidate import Candidate
        from models.cv_version import CVVersion
        from services.ocr_service import ocr_service
        from services.ner_service import ner_service
        import os
        
        db = SessionLocal()
        try:
            job_id = state["job_id"]
            applications = db.query(Application).filter(
                Application.job_id == job_id
            ).all()
            
            processed_apps = []
            for app in applications:
                candidate = db.query(Candidate).filter(
                    Candidate.candidate_id == app.candidate_id
                ).first()
                
                if not candidate:
                    continue
                
                # Get CV and process
                cv = db.query(CVVersion).filter(
                    CVVersion.candidate_id == candidate.candidate_id,
                    CVVersion.is_active == True
                ).order_by(CVVersion.version_number.desc()).first()
                
                ner_data = None
                if cv and cv.file_path and os.path.exists(cv.file_path):
                    try:
                        cv_text = ocr_service.extract_text(cv.file_path)
                        if cv_text and len(cv_text.strip()) >= 30:
                            ner_data = ner_service.parse_cv(cv_text)
                    except Exception as e:
                        state["errors"].append(f"CV processing error for {candidate.candidate_id}: {str(e)}")
                
                processed_apps.append({
                    "app_id": app.app_id,
                    "candidate_id": candidate.candidate_id,
                    "ner_data": ner_data,
                    "skills": candidate.skills
                })
            
            state["applications"] = processed_apps
            state["current_step"] = "applications_processed"
            state["messages"].append(f"Processed {len(processed_apps)} applications for job {job_id}")
            
            return state
        finally:
            db.close()
    
    def _compute_matching(self, state: RecruitmentState) -> RecruitmentState:
        """Compute semantic matching for all applications."""
        from database import SessionLocal
        from models.application import Application
        from models.job_offer import JobOffer
        from models.candidate import Candidate
        from services.cv_job_matching import match_parsed_cv_to_job, persist_application_match
        
        db = SessionLocal()
        try:
            job_id = state["job_id"]
            job = db.query(JobOffer).filter(JobOffer.job_id == job_id).first()
            
            if not job:
                state["errors"].append(f"Job not found: {job_id}")
                return state
            
            for app_data in state["applications"]:
                app = db.query(Application).filter(
                    Application.app_id == app_data["app_id"]
                ).first()
                
                if not app:
                    continue
                
                ner_data = app_data.get("ner_data")
                if ner_data:
                    parsed_cv = ner_data
                else:
                    skills = app_data.get("skills", "")
                    skill_list = [s.strip() for s in skills.split(",") if s.strip()]
                    parsed_cv = {
                        "skills": {"technical": skill_list, "soft": []},
                        "education": [],
                        "work_experience": [],
                        "languages": [],
                        "certifications": [],
                        "projects": [],
                    }
                
                result = match_parsed_cv_to_job(parsed_cv, job)
                persist_application_match(db, app, result)
                
                app_data["matching_score"] = result.get("overall_score", 0)
                app_data["matching_result"] = result
            
            db.commit()
            
            state["current_step"] = "matching_computed"
            state["messages"].append(f"Computed semantic matching for {len(state['applications'])} applications")
            
            return state
        finally:
            db.close()
    
    def _check_closing_date(self, state: RecruitmentState) -> RecruitmentState:
        """Check if job closing date has been reached."""
        from database import SessionLocal
        from models.job_offer import JobOffer
        
        db = SessionLocal()
        try:
            job_id = state["job_id"]
            job = db.query(JobOffer).filter(JobOffer.job_id == job_id).first()
            
            if job and job.closing_date:
                if datetime.utcnow() >= job.closing_date:
                    state["phase"] = "closing"
                    state["messages"].append(f"Job closing date reached: {job.closing_date}")
                else:
                    state["phase"] = "open"
                    state["messages"].append(f"Job still open until: {job.closing_date}")
            else:
                state["phase"] = "open"
                state["messages"].append("No closing date set for job")
            
            state["current_step"] = "closing_checked"
            return state
        finally:
            db.close()
    
    def _select_top_candidates(self, state: RecruitmentState) -> RecruitmentState:
        """Select top 10 candidates based on matching scores."""
        from database import SessionLocal
        from models.job_offer import JobOffer
        from models.application import Application, ApplicationStatus
        
        db = SessionLocal()
        try:
            job_id = state["job_id"]
            job = db.query(JobOffer).filter(JobOffer.job_id == job_id).first()
            
            if job:
                job.is_active = False
                db.commit()
            
            # Sort applications by matching score
            sorted_apps = sorted(
                state["applications"],
                key=lambda x: x.get("matching_score", 0),
                reverse=True
            )
            
            # Select top 10
            top_10 = sorted_apps[:10]
            
            # Update application statuses
            for app_data in top_10:
                app = db.query(Application).filter(
                    Application.app_id == app_data["app_id"]
                ).first()
                if app:
                    app.status = ApplicationStatus.SHORTLISTED
            
            db.commit()
            
            state["top_candidates"] = top_10
            state["current_step"] = "top_selected"
            state["messages"].append(f"Selected top {len(top_10)} candidates")
            
            return state
        finally:
            db.close()
    
    def _schedule_interviews(self, state: RecruitmentState) -> RecruitmentState:
        """Schedule interviews for top candidates."""
        from database import SessionLocal
        from models.interview import Interview, InterviewStatus
        from models.candidate import Candidate
        from models.notification import Notification
        from tasks.notification_tasks import send_interview_email_async
        
        db = SessionLocal()
        try:
            job_id = state["job_id"]
            scheduled = []
            
            # Generate time slots
            start_date = datetime.utcnow() + timedelta(days=1)
            
            for app_data in state["top_candidates"]:
                candidate = db.query(Candidate).filter(
                    Candidate.candidate_id == app_data["candidate_id"]
                ).first()
                
                if not candidate:
                    continue
                
                # Check for existing interview
                existing = db.query(Interview).filter(
                    Interview.application_id == app_data["app_id"]
                ).first()
                
                if existing:
                    interview = existing
                    interview.status = InterviewStatus.INVITED
                else:
                    interview = Interview(
                        interview_id=str(uuid.uuid4()),
                        application_id=app_data["app_id"],
                        candidate_id=candidate.candidate_id,
                        job_id=job_id,
                        language="en",
                        status=InterviewStatus.INVITED,
                        auto_scheduled=False
                    )
                    db.add(interview)
                    db.flush()
                    interview.meeting_link = f"{settings.FRONTEND_URL}/candidate/interview/{interview.interview_id}"
                
                # Create notification
                notification = Notification(
                    notification_id=str(uuid.uuid4()),
                    user_id=candidate.user_id,
                    company_id=state["company_id"],
                    title="Interview Invitation - Select Your Time",
                    message="You've been selected as a top candidate! Please select your preferred interview time slot.",
                    type="INTERVIEW_TIME_SELECTION",
                    reference_id=interview.interview_id,
                    is_read=False
                )
                db.add(notification)
                
                scheduled.append({
                    "interview_id": interview.interview_id,
                    "candidate_id": candidate.candidate_id,
                    "app_id": app_data["app_id"]
                })
                
                # Queue email
                send_interview_email_async.delay(candidate.user_id, interview.interview_id)
            
            db.commit()
            
            state["scheduled_interviews"] = scheduled
            state["current_step"] = "interviews_scheduled"
            state["messages"].append(f"Scheduled {len(scheduled)} interviews")
            
            return state
        finally:
            db.close()
    
    def _process_interviews(self, state: RecruitmentState) -> RecruitmentState:
        """Check status of scheduled interviews."""
        from database import SessionLocal
        from models.interview import Interview, InterviewStatus
        
        db = SessionLocal()
        try:
            completed = []
            
            for interview_data in state["scheduled_interviews"]:
                interview = db.query(Interview).filter(
                    Interview.interview_id == interview_data["interview_id"]
                ).first()
                
                if interview and interview.status == InterviewStatus.COMPLETED:
                    completed.append({
                        "interview_id": interview.interview_id,
                        "candidate_id": interview.candidate_id,
                        "completed_at": interview.completed_at
                    })
            
            state["completed_interviews"] = completed
            state["current_step"] = "interviews_checked"
            state["messages"].append(f"Completed interviews: {len(completed)}/{len(state['scheduled_interviews'])}")
            
            return state
        finally:
            db.close()
    
    def _generate_reports(self, state: RecruitmentState) -> RecruitmentState:
        """Generate reports for completed interviews."""
        from database import SessionLocal
        from models.interview import InterviewReport
        from services.interview_service import get_interview_service
        
        db = SessionLocal()
        try:
            interview_service = get_interview_service()
            
            for interview_data in state["completed_interviews"]:
                # Check if report exists
                existing = db.query(InterviewReport).filter(
                    InterviewReport.interview_id == interview_data["interview_id"]
                ).first()
                
                if not existing:
                    try:
                        interview_service.generate_report(db, interview_data["interview_id"])
                    except Exception as e:
                        state["errors"].append(f"Report generation error: {str(e)}")
            
            state["current_step"] = "reports_generated"
            state["messages"].append(f"Generated reports for {len(state['completed_interviews'])} interviews")
            
            return state
        finally:
            db.close()
    
    def _prepare_final_selection(self, state: RecruitmentState) -> RecruitmentState:
        """Prepare data for final selection by manager."""
        from database import SessionLocal
        from models.interview import InterviewReport
        
        db = SessionLocal()
        try:
            ranked_candidates = []
            
            for interview_data in state["completed_interviews"]:
                report = db.query(InterviewReport).filter(
                    InterviewReport.interview_id == interview_data["interview_id"]
                ).first()
                
                if report:
                    ranked_candidates.append({
                        "interview_id": interview_data["interview_id"],
                        "candidate_id": interview_data["candidate_id"],
                        "overall_score": report.overall_score,
                        "recommendation": report.recommendation.value if hasattr(report.recommendation, 'value') else report.recommendation
                    })
            
            # Sort by score
            ranked_candidates.sort(key=lambda x: x["overall_score"], reverse=True)
            
            state["final_selection"] = {
                "ranked_candidates": ranked_candidates,
                "ready_for_decision": True
            }
            state["current_step"] = "ready_for_selection"
            state["messages"].append(f"Ready for final selection with {len(ranked_candidates)} candidates")
            
            return state
        finally:
            db.close()
    
    def _complete_workflow(self, state: RecruitmentState) -> RecruitmentState:
        """Complete the workflow."""
        state["is_complete"] = True
        state["current_step"] = "workflow_complete"
        state["messages"].append("Recruitment workflow completed successfully")
        return state
    
    def start_workflow(self, job_id: str, company_id: str) -> str:
        """Start a new recruitment workflow for a job."""
        thread_id = f"recruitment_{job_id}_{uuid.uuid4().hex[:8]}"
        
        initial_state = {
            "job_id": job_id,
            "company_id": company_id,
            "phase": "open",
            "applications": [],
            "top_candidates": [],
            "scheduled_interviews": [],
            "completed_interviews": [],
            "final_selection": None,
            "messages": [f"Starting recruitment workflow for job {job_id}"],
            "errors": [],
            "current_step": "initialized",
            "is_complete": False
        }
        
        config = {"configurable": {"thread_id": thread_id}}
        
        try:
            result = self.graph.invoke(initial_state, config)
            logger.info(f"Workflow started: {thread_id}")
            return thread_id
        except Exception as e:
            logger.error(f"Workflow start error: {str(e)}")
            raise
    
    def resume_workflow(self, thread_id: str) -> dict:
        """Resume an existing workflow."""
        config = {"configurable": {"thread_id": thread_id}}
        
        try:
            state = self.graph.get_state(config)
            if state and not state.values.get("is_complete"):
                result = self.graph.invoke(None, config)
                return result
            return state.values if state else {}
        except Exception as e:
            logger.error(f"Workflow resume error: {str(e)}")
            raise
    
    def get_workflow_status(self, thread_id: str) -> dict:
        """Get current status of a workflow."""
        config = {"configurable": {"thread_id": thread_id}}
        
        try:
            state = self.graph.get_state(config)
            if state:
                return {
                    "thread_id": thread_id,
                    "current_step": state.values.get("current_step"),
                    "phase": state.values.get("phase"),
                    "is_complete": state.values.get("is_complete"),
                    "messages": state.values.get("messages", [])[-5:],
                    "errors": state.values.get("errors", [])
                }
            return {"error": "Workflow not found"}
        except Exception as e:
            logger.error(f"Workflow status error: {str(e)}")
            return {"error": str(e)}


# Singleton instance
_orchestrator = None


def get_orchestrator() -> RecruitmentOrchestrator:
    """Get the singleton orchestrator instance."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = RecruitmentOrchestrator()
    return _orchestrator
