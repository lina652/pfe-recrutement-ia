from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class ApplicationStatus(str, Enum):
    PENDING = "PENDING"
    UNDER_REVIEW = "UNDER_REVIEW"
    SHORTLISTED = "SHORTLISTED"
    REJECTED = "REJECTED"
    ACCEPTED = "ACCEPTED"

# ─────────────────────────────
# Submit Job Requirements (Manager writes from scratch)
# ─────────────────────────────

class SubmitRequirementsRequest(BaseModel):
    title: str
    description: Optional[str] = None
    requirements: str
    required_skills: Optional[str] = None
    experience_years: Optional[int] = Field(default=None, ge=0)
    education_level: Optional[str] = None
    location: Optional[str] = None
    contract_type: str = "CDI"
    department: Optional[str] = None
    closing_date: str  # Required: YYYY-MM-DD format

# ─────────────────────────────
# Requirement Request Response
# ─────────────────────────────

class RequirementRequestResponse(BaseModel):
    request_id: str
    submitted_by: str
    company_id: str
    title: str
    description: Optional[str] = None
    requirements: str
    required_skills: Optional[str] = None
    experience_years: Optional[int] = None
    education_level: Optional[str] = None
    location: Optional[str] = None
    contract_type: Optional[str] = None
    department: Optional[str] = None
    salary_range: Optional[str] = None
    closing_date: Optional[datetime] = None
    status: str
    rejection_reason: Optional[str] = None
    reviewed_by: Optional[str] = None
    created_job_id: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class RequirementRequestListResponse(BaseModel):
    total: int
    requests: List[RequirementRequestResponse]

# ─────────────────────────────
# Job Offer (read-only for manager)
# ─────────────────────────────

class JobOfferResponse(BaseModel):
    job_id: str
    title: str
    description: Optional[str] = None
    requirements: Optional[str] = None
    required_skills: Optional[str] = None
    experience_years: Optional[int] = None
    education_level: Optional[str] = None
    location: Optional[str] = None
    location_type: Optional[str] = None
    contract_type: str
    department: Optional[str] = None
    experience_level: Optional[str] = None
    salary_range: Optional[str] = None
    is_active: bool
    posted_date: datetime
    company_name: Optional[str] = None

    class Config:
        from_attributes = True

class JobOfferListResponse(BaseModel):
    total: int
    jobs: List[JobOfferResponse]

# ─────────────────────────────
# Candidates
# ─────────────────────────────

class CandidateApplicationResponse(BaseModel):
    app_id: str
    candidate_id: str
    job_id: str
    status: ApplicationStatus
    final_score: Optional[float] = None
    ai_recommendation: Optional[str] = None
    hr_override: bool
    submission_date: datetime

    class Config:
        from_attributes = True

class CandidateListResponse(BaseModel):
    total: int
    applications: List[CandidateApplicationResponse]

class FinalSelectionRequest(BaseModel):
    app_id: str
    reason: Optional[str] = None

class ManagerStats(BaseModel):
    total_jobs: int
    active_jobs: int
    total_shortlisted: int
    total_accepted: int
    total_rejected: int
    pending_review: int
    pending_requests: int
