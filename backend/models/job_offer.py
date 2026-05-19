from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, Enum as SAEnum
from database import Base
from datetime import datetime
import uuid
import enum

class ContractType(str, enum.Enum):
    CDI = "CDI"
    CDD = "CDD"
    INTERNSHIP = "INTERNSHIP"
    FREELANCE = "FREELANCE"

class LocationType(str, enum.Enum):
    REMOTE = "REMOTE"
    HYBRID = "HYBRID"
    ON_SITE = "ON_SITE"

class ExperienceLevel(str, enum.Enum):
    ENTRY = "ENTRY"
    MID_SENIOR = "MID_SENIOR"
    INTERN = "INTERN"
    DIRECTOR = "DIRECTOR"

class JobOffer(Base):
    __tablename__ = "job_offers"

    job_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    posted_by = Column(String(36), nullable=False)
    company_id = Column(String(36), nullable=False)
    company_name = Column(String(255), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    requirements = Column(Text, nullable=True)
    required_skills = Column(Text, nullable=True)        # comma separated
    experience_years = Column(Integer, nullable=True)    # ← ADD
    education_level = Column(String(50), nullable=True)  # ← ADD
    location = Column(String(255), nullable=True)
    location_type = Column(SAEnum(LocationType), nullable=True)
    contract_type = Column(SAEnum(ContractType), default=ContractType.CDI)
    department = Column(String(100), nullable=True)
    experience_level = Column(SAEnum(ExperienceLevel), nullable=True)
    languages_required = Column(Text, nullable=True)
    languages_other = Column(Text, nullable=True)
    soft_skills = Column(Text, nullable=True)
    soft_skills_other = Column(Text, nullable=True)
    certifications = Column(Text, nullable=True)
    certifications_other = Column(Text, nullable=True)
    salary_range = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    closing_processed = Column(Boolean, default=False)
    posted_date = Column(DateTime, default=datetime.utcnow)
    closing_date = Column(DateTime, nullable=True)