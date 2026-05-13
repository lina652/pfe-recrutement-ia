from database import SessionLocal, engine, Base
from models.user import User, UserRole
from models.company import Company
from models import user, invitation, log, report
from models.job_offer import JobOffer
from models.application import Application
from passlib.context import CryptContext
from models.candidate import Candidate        
from models.cv_version import CVVersion       
from models.otp import OTP
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # ─────────────────────────────
        # Create Super Admin
        # ─────────────────────────────
        existing_super = db.query(User).filter(
            User.email == "superadmin@platform.com"
        ).first()

        if not existing_super:
            super_admin = User(
                user_id=str(uuid.uuid4()),
                first_name="Super",
                last_name="Admin",
                email="superadmin@platform.com",
                password_hash=pwd_context.hash("SuperAdmin@1234"),
                role=UserRole.SUPER_ADMIN,
                is_active=True,
                company_id=None
            )
            db.add(super_admin)
            db.commit()
            print("✅ Super Admin created")
            print("   Email    : superadmin@platform.com")
            print("   Password : SuperAdmin@1234")

        # ─────────────────────────────
        # Create Demo Company
        # ─────────────────────────────
        existing_company = db.query(Company).filter(
            Company.slug == "techcorp"
        ).first()

        if not existing_company:
            company = Company(
                company_id=str(uuid.uuid4()),
                name="Tech Corp Tunisia",
                slug="techcorp",
                industry="Technology",
                website="https://techcorp.tn"
            )
            db.add(company)
            db.commit()
            db.refresh(company)
            print("✅ Demo company created: Tech Corp Tunisia")

            # Create company admin
            company_admin = User(
                user_id=str(uuid.uuid4()),
                first_name="Company",
                last_name="Admin",
                email="admin@techcorp.com",
                password_hash=pwd_context.hash("Admin@1234"),
                role=UserRole.ADMINISTRATOR,
                is_active=True,
                company_id=company.company_id
            )
            db.add(company_admin)
            db.commit()
            print("✅ Company Admin created")
            print("   Email    : admin@techcorp.com")
            print("   Password : Admin@1234")
            print("   Company  : Tech Corp Tunisia")

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()