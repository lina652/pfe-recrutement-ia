from sqlalchemy import Column, String, Boolean, DateTime, Text, Enum as SAEnum
from database import Base
from datetime import datetime
import uuid
import enum


class UserRole(str, enum.Enum):
    CANDIDATE = "CANDIDATE"
    RECRUITER = "RECRUITER"
    HIRING_MANAGER = "HIRING_MANAGER"
    ADMINISTRATOR = "ADMINISTRATOR"
    SUPER_ADMIN = "SUPER_ADMIN"


class User(Base):
    __tablename__ = "users"

    user_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    password_hash = Column(String(255), nullable=True)
    role = Column(SAEnum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True)
    avatar_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    company_id = Column(String(36), nullable=True)
