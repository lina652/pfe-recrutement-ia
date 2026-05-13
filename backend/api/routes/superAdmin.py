from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from sqlalchemy import func
from core.email_utils import normalize_email
from models.user import User, UserRole
from models.company import Company
from models.otp import OTP
from core.dependencies import require_role
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
import uuid
import random
import re

router = APIRouter(prefix="/superadmin", tags=["Super Admin"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─────────────────────────────
# Helpers
# ─────────────────────────────

def extract_domain_base(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r'^https?://', '', value)
    value = re.sub(r'^www\.', '', value)
    value = value.split('/')[0]
    value = value.split('.')[0]
    return value

def domains_match(email: str, website: str) -> bool:
    email_domain = email.split('@')[1].split('.')[0]
    website_domain = extract_domain_base(website)
    return email_domain == website_domain

def generate_otp() -> str:
    return str(random.randint(100000, 999999))

def send_otp_email(email: str, otp_code: str, company_name: str):
    print(f"")
    print(f"=" * 50)
    print(f"📧 OTP VERIFICATION CODE")
    print(f"   Company : {company_name}")
    print(f"   Email   : {email}")
    print(f"   Code    : {otp_code}")
    print(f"   Expires : 10 minutes")
    print(f"=" * 50)
    print(f"")

# ─────────────────────────────
# Schemas
# ─────────────────────────────

class CompanySignupRequest(BaseModel):
    company_name: str
    company_website: str
    tax_id: Optional[str] = None
    industry: Optional[str] = None
    admin_first_name: str
    admin_last_name: str
    admin_email: EmailStr
    admin_password: str

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp_code: str
    company_id: str

# ─────────────────────────────
# PUBLIC — Company self signup
# No auth required
# Step 1 of 2
# ─────────────────────────────

@router.post("/signup", status_code=201)
def company_self_signup(
    payload: CompanySignupRequest,
    db: Session = Depends(get_db)
):
    admin_email = normalize_email(str(payload.admin_email))
    if not admin_email:
        raise HTTPException(status_code=400, detail="Invalid email")

    # Check email not taken (case-insensitive)
    if db.query(User).filter(func.lower(User.email) == admin_email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Domain check — disable for testing by commenting out
    #if not domains_match(payload.admin_email, payload.company_website):
     #   email_domain = payload.admin_email.split('@')[1]
      #  raise HTTPException(
       #     status_code=400,
        #    detail=f"Email domain '{email_domain}' must match website '{payload.company_website}'"
        #)

    # Auto generate unique slug
    slug = payload.company_name.lower().strip()
    slug = "".join(c if c.isalnum() else "-" for c in slug)
    slug = "-".join(filter(None, slug.split("-")))
    base_slug = slug
    counter = 1
    while db.query(Company).filter(Company.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    try:
        # Create company — inactive until OTP verified
        company = Company(
            company_id=str(uuid.uuid4()),
            name=payload.company_name,
            slug=slug,
            industry=payload.industry,
            website=payload.company_website,
            is_active=False
        )
        db.add(company)
        db.flush()

        # Create admin — inactive until OTP verified
        admin = User(
            user_id=str(uuid.uuid4()),
            first_name=payload.admin_first_name,
            last_name=payload.admin_last_name,
            email=admin_email,
            password_hash=pwd_context.hash(payload.admin_password),
            role=UserRole.ADMINISTRATOR,
            is_active=False,
            company_id=company.company_id
        )
        db.add(admin)

        # Generate OTP
        otp_code = generate_otp()
        otp = OTP(
            otp_id=str(uuid.uuid4()),
            email=admin_email,
            code=otp_code,
            purpose="COMPANY_VERIFICATION",
            expires_at=datetime.utcnow() + timedelta(minutes=10)
        )
        db.add(otp)

        # Commit everything atomically
        db.commit()

        send_otp_email(admin_email, otp_code, payload.company_name)

        return {
            "message": "Company registered. Check your terminal for the OTP code.",
            "company_id": company.company_id,
            "email": admin_email,
            "next_step": "POST /superadmin/verify-otp"
        }

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Registration failed. Try again.")

# ─────────────────────────────
# PUBLIC — Verify OTP
# Step 2 of 2
# ─────────────────────────────

@router.post("/verify-otp")
def verify_otp(
    payload: OTPVerifyRequest,
    db: Session = Depends(get_db)
):
    email = normalize_email(str(payload.email))
    if not email:
        raise HTTPException(status_code=400, detail="Invalid email")

    otp = db.query(OTP).filter(
        func.lower(OTP.email) == email,
        OTP.code == payload.otp_code,
        OTP.purpose == "COMPANY_VERIFICATION",
        OTP.is_used == False
    ).first()

    if not otp:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    if otp.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="Code expired. Please register again."
        )

    company = db.query(Company).filter(
        Company.company_id == payload.company_id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    admin = db.query(User).filter(
        func.lower(User.email) == email,
        User.company_id == payload.company_id
    ).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    # Activate atomically
    company.is_active = True
    admin.is_active = True
    otp.is_used = True
    db.commit()

    return {
        "message": "Verified successfully. You can now login.",
        "company_id": company.company_id,
        "company_name": company.name,
        "admin_email": admin.email
    }

# ─────────────────────────────
# PUBLIC — Resend OTP
# ─────────────────────────────

@router.post("/resend-otp")
def resend_otp(
    email: str,
    company_id: str,
    db: Session = Depends(get_db)
):
    norm = normalize_email(email)
    if not norm:
        raise HTTPException(status_code=400, detail="Invalid email")

    company = db.query(Company).filter(
        Company.company_id == company_id,
        Company.is_active == False
    ).first()
    if not company:
        raise HTTPException(
            status_code=404,
            detail="Company not found or already verified"
        )

    # Invalidate old OTPs
    db.query(OTP).filter(
        func.lower(OTP.email) == norm,
        OTP.purpose == "COMPANY_VERIFICATION",
        OTP.is_used == False
    ).update({"is_used": True})

    otp_code = generate_otp()
    otp = OTP(
        otp_id=str(uuid.uuid4()),
        email=norm,
        code=otp_code,
        purpose="COMPANY_VERIFICATION",
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.add(otp)
    db.commit()

    send_otp_email(norm, otp_code, company.name)

    return {
        "message": "New code sent. Check your terminal.",
        "expires_in": "10 minutes"
    }

# ─────────────────────────────
# SUPER ADMIN ONLY
# Monitor platform
# ─────────────────────────────

@router.get("/stats")
def get_platform_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN))
):
    return {
        "total_companies": db.query(Company).count(),
        "active_companies": db.query(Company).filter(
            Company.is_active == True
        ).count(),
        "pending_companies": db.query(Company).filter(
            Company.is_active == False
        ).count(),
        "total_users": db.query(User).count(),
        "total_candidates": db.query(User).filter(
            User.role == UserRole.CANDIDATE
        ).count(),
        "total_admins": db.query(User).filter(
            User.role == UserRole.ADMINISTRATOR
        ).count(),
        "total_recruiters": db.query(User).filter(
            User.role == UserRole.RECRUITER
        ).count(),
    }

@router.get("/companies")
def list_companies(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN))
):
    companies = db.query(Company).order_by(
        Company.created_at.desc()
    ).all()
    return {
        "total": len(companies),
        "companies": [
            {
                "company_id": c.company_id,
                "name": c.name,
                "slug": c.slug,
                "industry": c.industry,
                "website": c.website,
                "is_active": c.is_active,
                "created_at": c.created_at
            }
            for c in companies
        ]
    }

@router.put("/companies/{company_id}/toggle")
def toggle_company(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN))
):
    company = db.query(Company).filter(
        Company.company_id == company_id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    company.is_active = not company.is_active

    # Also deactivate/activate all company users
    db.query(User).filter(
        User.company_id == company_id,
        User.role != UserRole.CANDIDATE
    ).update({"is_active": company.is_active})

    db.commit()

    return {
        "message": f"Company {'activated' if company.is_active else 'suspended'}",
        "company_id": company_id,
        "is_active": company.is_active
    }