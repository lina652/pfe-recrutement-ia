from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from core.email_utils import normalize_email
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token
)
from core.dependencies import get_current_user
from models.user import User
from models.company import Company
from schemas.auth import (
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    UserResponse,
    ChangePasswordRequest
)
from database import get_db
from schemas.auth import UpdateProfileRequest

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ─────────────────────────────
# LOGIN
# ─────────────────────────────


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db)
):
    email = normalize_email(payload.email)

    # Case-insensitive match (SQLite can store multiple rows differing only by case)
    matches = db.query(User).filter(func.lower(User.email) == email).all()
    if not matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    with_password = [
        u for u in matches
        if u.password_hash and str(u.password_hash).strip()
    ]
    if len(with_password) == 1:
        user = with_password[0]
    elif len(with_password) > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Multiple accounts share this email. Contact an administrator.",
        )
    else:
        user = matches[0]

    # Account deactivated
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact the administrator."
        )

    # Invited / SSO user with no password set yet
    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No password set for this account. Use the invitation link or reset flow to set a password."
        )

    # Wrong password
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Generate tokens (JWT claims must be JSON-serializable — use role string)
    role_claim = user.role.value if hasattr(user.role, "value") else str(user.role)
    access_token = create_access_token({
        "sub": user.user_id,
        "role": role_claim,
    })
    refresh_token = create_refresh_token({
        "sub": user.user_id
    })

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user.role,
        user_id=user.user_id
    )

# ─────────────────────────────
# REFRESH TOKEN
# ─────────────────────────────


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    payload: RefreshRequest,
    db: Session = Depends(get_db)
):
    decoded = decode_token(payload.refresh_token)

    if not decoded or decoded.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    user = db.query(User).filter(
        User.user_id == decoded.get("sub")
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    role_claim = user.role.value if hasattr(user.role, "value") else str(user.role)
    access_token = create_access_token({
        "sub": user.user_id,
        "role": role_claim,
    })
    refresh_token = create_refresh_token({
        "sub": user.user_id
    })

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user.role,
        user_id=user.user_id
    )

# ─────────────────────────────
# GET CURRENT USER
# ─────────────────────────────


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get company name if user has a company_id
    company_name = None
    if current_user.company_id:
        company = db.query(Company).filter(
            Company.company_id == current_user.company_id
        ).first()
        if company:
            company_name = company.name
    
    # Return user data with company info
    return UserResponse(
        user_id=current_user.user_id,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        email=current_user.email,
        phone=current_user.phone,
        role=current_user.role,
        is_active=current_user.is_active,
        avatar_url=current_user.avatar_url,
        company_id=current_user.company_id,
        company_name=company_name,
        created_at=current_user.created_at
    )

# ─────────────────────────────
# LOGOUT
# ─────────────────────────────


@router.post("/logout")
def logout():
    return {"message": "Logged out successfully"}

# ─────────────────────────────
# CHANGE PASSWORD
# ─────────────────────────────


@router.put("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify current password
    if not verify_password(
        payload.current_password,
        current_user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    # Update password
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password changed successfully"}



@router.put("/profile")
def update_profile(
    payload: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if payload.first_name is not None:
        current_user.first_name = payload.first_name
    if payload.last_name is not None:
        current_user.last_name = payload.last_name
    if payload.phone is not None:
        current_user.phone = payload.phone
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile updated successfully",
        "user_id": current_user.user_id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "phone": current_user.phone,
        "avatar_url": current_user.avatar_url
    }
