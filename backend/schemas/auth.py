from pydantic import BaseModel, EmailStr
from enum import Enum
from typing import Optional
from datetime import datetime


class UserRole(str, Enum):
    CANDIDATE = "CANDIDATE"
    RECRUITER = "RECRUITER"
    HIRING_MANAGER = "HIRING_MANAGER"
    ADMINISTRATOR = "ADMINISTRATOR"
    SUPER_ADMIN= "SUPER_ADMIN"

# ─────────────────────────────
# Login
# ─────────────────────────────


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: str

# ─────────────────────────────
# Refresh
# ─────────────────────────────


class RefreshRequest(BaseModel):
    refresh_token: str

# ─────────────────────────────
# User response
# ─────────────────────────────


class UserResponse(BaseModel):
    user_id: str
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    avatar_url: Optional[str] = None
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ─────────────────────────────
# Change password
# ─────────────────────────────


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
