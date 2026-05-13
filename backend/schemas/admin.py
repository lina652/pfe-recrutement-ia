from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum


class StaffRole(str, Enum):
    RECRUITER = "RECRUITER"
    HIRING_MANAGER = "HIRING_MANAGER"


class UserRole(str, Enum):
    CANDIDATE = "CANDIDATE"
    RECRUITER = "RECRUITER"
    HIRING_MANAGER = "HIRING_MANAGER"
    ADMINISTRATOR = "ADMINISTRATOR"

# ─────────────────────────────
# Invite Staff
# ─────────────────────────────


class InviteRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    role: StaffRole


class InviteResponse(BaseModel):
    message: str
    email: str
    role: StaffRole
    expires_at: datetime

# ─────────────────────────────
# User Management
# ─────────────────────────────


class UserListItem(BaseModel):
    user_id: str
    first_name: str
    last_name: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    total: int
    users: List[UserListItem]


class ChangeRoleRequest(BaseModel):
    role: UserRole


class ToggleUserResponse(BaseModel):
    message: str
    user_id: str
    is_active: bool

# ─────────────────────────────
# Logs
# ─────────────────────────────


class LogItem(BaseModel):
    log_id: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class LogListResponse(BaseModel):
    total: int
    logs: List[LogItem]

# ─────────────────────────────
# Reports
# ─────────────────────────────


class GenerateReportRequest(BaseModel):
    title: str
    format: str = "JSON"


class ReportItem(BaseModel):
    report_id: str
    title: str
    generated_by: str
    format: str
    generated_at: datetime
    content: str

    class Config:
        from_attributes = True


class ReportListResponse(BaseModel):
    total: int
    reports: List[ReportItem]

# ─────────────────────────────
# Dashboard Stats
# ─────────────────────────────


class DashboardStats(BaseModel):
    total_users: int
    total_candidates: int
    total_recruiters: int
    total_hiring_managers: int
    total_admins: int
    active_users: int
    inactive_users: int
    total_logs: int
    total_reports: int
