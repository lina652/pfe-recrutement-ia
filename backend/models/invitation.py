from sqlalchemy import Column, String, Boolean, DateTime, Enum as SAEnum
from database import Base
from datetime import datetime
import uuid
import enum


class InvitationStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    EXPIRED = "EXPIRED"


class Invitation(Base):
    __tablename__ = "invitations"

    invitation_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    created_by = Column(String(36), nullable=False)
    email = Column(String(255), nullable=False)
    company_id = Column(String(36), nullable=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(
        SAEnum(
            "RECRUITER",
            "HIRING_MANAGER",
            name="invitationrole"
        ),
        nullable=False
    )
    token = Column(String(255), nullable=False, unique=True)
    status = Column(
        SAEnum(InvitationStatus),
        default=InvitationStatus.PENDING
    )
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
