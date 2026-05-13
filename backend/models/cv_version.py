from sqlalchemy import Column, String, Boolean, DateTime, Integer
from database import Base
from datetime import datetime
import uuid

class CVVersion(Base):
    __tablename__ = "cv_versions"

    cv_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    candidate_id = Column(String(36), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    version_number = Column(Integer, default=1)
    uploaded_at = Column(DateTime, default=datetime.utcnow)