from sqlalchemy import Column, String, Boolean, DateTime, Text
from database import Base
from datetime import datetime
import uuid


class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    user_id = Column(String(36), nullable=False)            # recipient
    company_id = Column(String(36), nullable=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)               # REQUIREMENT_SUBMITTED / ACCEPTED / REJECTED
    reference_id = Column(String(36), nullable=True)        # links to requirement_request
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
