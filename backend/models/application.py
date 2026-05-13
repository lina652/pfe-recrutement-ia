from sqlalchemy import Column, String, Boolean, DateTime, Float, Text, Enum as SAEnum
from database import Base
from datetime import datetime
import uuid
import enum

class ApplicationStatus(str, enum.Enum):
    PENDING = "PENDING"
    UNDER_REVIEW = "UNDER_REVIEW"
    SHORTLISTED = "SHORTLISTED"
    REJECTED = "REJECTED"
    ACCEPTED = "ACCEPTED"

class Application(Base):
    __tablename__ = "applications"

    app_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    candidate_id = Column(String(36), nullable=False)
    job_id = Column(String(36), nullable=False)
    cv_id = Column(String(36), nullable=True)
    status = Column(
        SAEnum(ApplicationStatus),
        default=ApplicationStatus.PENDING
    )
    cover_letter = Column(Text, nullable=True)
    final_score = Column(Float, nullable=True)
    ai_recommendation = Column(Text, nullable=True)
    hr_override = Column(Boolean, default=False)
    hr_override_reason = Column(Text, nullable=True)
    submission_date = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
