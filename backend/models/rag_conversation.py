from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from database import Base
from datetime import datetime
import uuid


class RAGConversation(Base):
    __tablename__ = "rag_conversations"

    conversation_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    recruiter_id = Column(String(36), nullable=False, index=True)
    job_id = Column(String(36), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    is_favorite = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class RAGMessage(Base):
    __tablename__ = "rag_messages"

    message_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    conversation_id = Column(String(36), nullable=False, index=True)
    role = Column(String(10), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
