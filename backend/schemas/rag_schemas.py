from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class RAGConversationCreate(BaseModel):
    job_id: str
    title: str


class RAGConversationUpdate(BaseModel):
    title: Optional[str] = None
    is_favorite: Optional[bool] = None


class RAGMessageRequest(BaseModel):
    conversation_id: str
    question: str


class RAGMessageResponse(BaseModel):
    message_id: str
    conversation_id: str
    role: str
    content: str
    timestamp: datetime

    class Config:
        from_attributes = True


class RAGConversationDetail(BaseModel):
    conversation_id: str
    recruiter_id: str
    job_id: str
    title: str
    is_favorite: bool
    created_at: datetime
    updated_at: datetime
    messages: List[RAGMessageResponse] = []

    class Config:
        from_attributes = True


class RAGConversationListItem(BaseModel):
    conversation_id: str
    job_id: str
    title: str
    is_favorite: bool
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    class Config:
        from_attributes = True
