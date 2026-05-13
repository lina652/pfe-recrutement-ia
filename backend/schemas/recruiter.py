from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

class ContractType(str, Enum):
    CDI = "CDI"
    CDD = "CDD"
    INTERNSHIP = "INTERNSHIP"
    FREELANCE = "FREELANCE"

class ApplicationStatus(str, Enum):
    PENDING = "PENDING"
    UNDER_REVIEW = "UNDER_REVIEW"
    SHORTLISTED = "SHORTLISTED"
    REJECTED = "REJECTED"
    ACCEPTED = "ACCEPTED"

# ─────────────────────────────
# Job Offer
# ─────────────────────────────

class CreateJobOfferRequest(BaseModel):
    title: str
    description: Optional[str] = None
    requirements: Optional[str] = None
    location: Optional[str] = None
    location_type: Optional[str] = None
    contract_type: ContractType = ContractType.CDI
    department: Optional[str] = None
    experience_level: Optional[str] = None
    required_skills: Optional[str] = None
    salary_range: Optional[str] = None
    closing_date: Optional[datetime] = None

class UpdateJobOfferRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    location: Optional[str] = None
    location_type: Optional[str] = None
    contract_type: Optional[ContractType] = None
    department: Optional[str] = None
    experience_level: Optional[str] = None
    required_skills: Optional[str] = None
    salary_range: Optional[str] = None
    closing_date: Optional[datetime] = None
    is_active: Optional[bool] = None

class JobOfferResponse(BaseModel):
    job_id: str
    posted_by: str
    company_id: str
    company_name: str
    title: str
    description: Optional[str] = None
    requirements: Optional[str] = None
    location: Optional[str] = None
    location_type: Optional[str] = None
    contract_type: str
    department: Optional[str] = None
    experience_level: Optional[str] = None
    required_skills: Optional[str] = None
    salary_range: Optional[str] = None
    is_active: bool
    posted_date: datetime
    closing_date: Optional[datetime] = None

    class Config:
        from_attributes = True

class JobOfferListResponse(BaseModel):
    total: int
    jobs: List[JobOfferResponse]

# ─────────────────────────────
# Application
# ─────────────────────────────

class ApplicationResponse(BaseModel):
    app_id: str
    candidate_id: str
    job_id: str
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    candidate_name: Optional[str] = None
    status: ApplicationStatus
    cover_letter: Optional[str] = None
    final_score: Optional[float] = None
    ai_recommendation: Optional[str] = None
    hr_override: bool
    hr_override_reason: Optional[str] = None
    submission_date: datetime
    last_updated: datetime

    class Config:
        from_attributes = True

class ApplicationListResponse(BaseModel):
    total: int
    applications: List[ApplicationResponse]

class OverrideRequest(BaseModel):
    status: ApplicationStatus
    reason: str

# ─────────────────────────────
# Dashboard Stats
# ─────────────────────────────

class RecruiterStats(BaseModel):
    total_jobs: int
    active_jobs: int
    closed_jobs: int
    total_applications: int
    pending_applications: int
    shortlisted_applications: int
    rejected_applications: int
    accepted_applications: int

# ─────────────────────────────
# Requirement Requests (HR Review)
# ─────────────────────────────

class RequirementRequestForHR(BaseModel):
    request_id: str
    submitted_by: str
    submitter_name: Optional[str] = None
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
    status: str
    rejection_reason: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class RequirementRequestListForHR(BaseModel):
    total: int
    requests: List[RequirementRequestForHR]

class RejectRequirementRequest(BaseModel):
    reason: str
