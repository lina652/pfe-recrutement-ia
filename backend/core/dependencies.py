from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from core.security import decode_token
from models.user import User, UserRole
from database import get_db

bearer_scheme = HTTPBearer()

# ─────────────────────────────
# Get current logged in user
# ─────────────────────────────


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = decode_token(token)

    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    user = db.query(User).filter(
        User.user_id == payload.get("sub")
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    return user

# ─────────────────────────────
# Role based access control
# ─────────────────────────────


def require_role(*roles: UserRole):
    def checker(
        current_user: User = Depends(get_current_user)
    ):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required: {[r.value for r in roles]}"
            )
        return current_user
    return checker
