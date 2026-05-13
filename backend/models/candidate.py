from sqlalchemy import Column, String, Text, DateTime
from database import Base
from datetime import datetime
import uuid

class Candidate(Base):
    __tablename__ = "candidates"

    candidate_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    user_id = Column(String(36), nullable=False, unique=True)
    phone = Column(String(20), nullable=True)
    linkedin_url = Column(String(255), nullable=True)
    portfolio_url = Column(String(255), nullable=True)
    skills = Column(Text, nullable=True)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)