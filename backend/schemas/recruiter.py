from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

class ContractType(str, Enum):
    CDI = "CDI"
    CDD = "CDD"
    INTERNSHIP = "INTERNSHIP"
    FREELANCE = "FREELANCE"

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
    experience_level: Optional[str] = None
    education_level: Optional[str] = None
    location: Optional[str] = None
    location_type: Optional[str] = None
    languages_required: Optional[str] = None
    languages_other: Optional[str] = None
    soft_skills: Optional[str] = None
    soft_skills_other: Optional[str] = None
    certifications: Optional[str] = None
    certifications_other: Optional[str] = None
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

class AcceptRequirementRequest(BaseModel):
    salary_range: str

class RejectRequirementRequest(BaseModel):
    reason: str
