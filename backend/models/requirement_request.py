from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, Enum as SAEnum
from database import Base
from datetime import datetime
import uuid
import enum


class RequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class RequirementRequest(Base):
    __tablename__ = "requirement_requests"

    request_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    submitted_by = Column(String(36), nullable=False)      # manager user_id
    company_id = Column(String(36), nullable=False)

    # ── Full job details written by manager ──
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    requirements = Column(Text, nullable=False)
    required_skills = Column(Text, nullable=True)
    experience_years = Column(Integer, nullable=True)
    experience_level = Column(String(30), nullable=True)
    education_level = Column(String(50), nullable=True)
    location = Column(String(255), nullable=True)
    location_type = Column(String(20), nullable=True)
    languages_required = Column(Text, nullable=True)
    languages_other = Column(Text, nullable=True)
    soft_skills = Column(Text, nullable=True)
    soft_skills_other = Column(Text, nullable=True)
    certifications = Column(Text, nullable=True)
    certifications_other = Column(Text, nullable=True)
    contract_type = Column(String(50), default="CDI")
    department = Column(String(100), nullable=True)
    salary_range = Column(String(100), nullable=True)
    closing_date = Column(DateTime, nullable=True)  # Job closing date for applications

    # ── Review fields ──
    status = Column(
        SAEnum(RequestStatus),
        default=RequestStatus.PENDING,
        nullable=False
    )
    rejection_reason = Column(Text, nullable=True)
    reviewed_by = Column(String(36), nullable=True)         # HR user_id
    created_job_id = Column(String(36), nullable=True)      # job_id if accepted
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
