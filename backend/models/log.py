from sqlalchemy import Column, String, DateTime, Text
from database import Base
from datetime import datetime
import uuid


class Log(Base):
    __tablename__ = "logs"

    log_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    user_id = Column(String(36), nullable=True)
    user_email = Column(String(255), nullable=True)
    company_id = Column(String(36), nullable=True)
    action = Column(String(255), nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
