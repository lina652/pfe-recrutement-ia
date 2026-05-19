"""
API routes for the recruitment workflow orchestrator.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from database import get_db
from core.dependencies import require_role
from models.user import User, UserRole
from models.job_offer import JobOffer
from services.recruitment_orchestrator import get_orchestrator

router = APIRouter(
    prefix="/orchestrator",
    tags=["Recruitment Orchestrator"]
)

logger = logging.getLogger(__name__)


class StartWorkflowRequest(BaseModel):
    job_id: str


class WorkflowResponse(BaseModel):
    thread_id: str
    status: str
    message: str


class WorkflowStatusResponse(BaseModel):
    thread_id: str
    current_step: Optional[str] = None
    phase: Optional[str] = None
    is_complete: bool = False
    messages: List[str] = []
    errors: List[str] = []


@router.post("/start", response_model=WorkflowResponse)
def start_recruitment_workflow(
    payload: StartWorkflowRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    """Start a new recruitment workflow for a job."""
    job = db.query(JobOffer).filter(
        JobOffer.job_id == payload.job_id,
        JobOffer.company_id == current_user.company_id
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    try:
        orchestrator = get_orchestrator()
        thread_id = orchestrator.start_workflow(
            job_id=payload.job_id,
            company_id=current_user.company_id
        )
        
        return WorkflowResponse(
            thread_id=thread_id,
            status="started",
            message=f"Recruitment workflow started for job: {job.title}"
        )
    except Exception as e:
        logger.error(f"Failed to start workflow: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resume/{thread_id}", response_model=WorkflowStatusResponse)
def resume_recruitment_workflow(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    """Resume an existing recruitment workflow."""
    try:
        orchestrator = get_orchestrator()
        result = orchestrator.resume_workflow(thread_id)
        
        return WorkflowStatusResponse(
            thread_id=thread_id,
            current_step=result.get("current_step"),
            phase=result.get("phase"),
            is_complete=result.get("is_complete", False),
            messages=result.get("messages", [])[-10:],
            errors=result.get("errors", [])
        )
    except Exception as e:
        logger.error(f"Failed to resume workflow: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{thread_id}", response_model=WorkflowStatusResponse)
def get_workflow_status(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    """Get the current status of a recruitment workflow."""
    try:
        orchestrator = get_orchestrator()
        status = orchestrator.get_workflow_status(thread_id)
        
        if "error" in status and status["error"] == "Workflow not found":
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        return WorkflowStatusResponse(
            thread_id=thread_id,
            current_step=status.get("current_step"),
            phase=status.get("phase"),
            is_complete=status.get("is_complete", False),
            messages=status.get("messages", []),
            errors=status.get("errors", [])
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get workflow status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trigger-closing/{job_id}")
def trigger_job_closing(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    """Manually trigger job closing process (for testing or manual override)."""
    from tasks.cv_tasks import process_job_closing
    
    job = db.query(JobOffer).filter(
        JobOffer.job_id == job_id,
        JobOffer.company_id == current_user.company_id
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    try:
        from services.job_closing_service import execute_job_closing

        job.is_active = False
        job.closing_processed = False
        db.commit()

        result = execute_job_closing(db, job_id)
        return {
            "message": f"Job closing processed for: {job.title}",
            "job_id": job_id,
            "result": result,
        }
    except Exception as e:
        logger.error(f"Failed to trigger job closing: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
