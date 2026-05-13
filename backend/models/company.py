# models/company.py
from sqlalchemy import Column, String, Boolean, DateTime
from database import Base
from datetime import datetime
import uuid

class Company(Base):
    __tablename__ = "companies"

    company_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    industry = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    logo_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)