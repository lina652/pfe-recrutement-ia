from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class NotificationResponse(BaseModel):
    notification_id: str
    user_id: str
    company_id: Optional[str] = None
    title: str
    message: str
    type: str
    reference_id: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    total: int
    unread_count: int
    notifications: List[NotificationResponse]
