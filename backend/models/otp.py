from sqlalchemy import Column, String, Boolean, DateTime
from database import Base
from datetime import datetime
import uuid

class OTP(Base):
    __tablename__ = "otps"

    otp_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    email = Column(String(255), nullable=False)
    code = Column(String(6), nullable=False)
    purpose = Column(String(50), nullable=False)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)