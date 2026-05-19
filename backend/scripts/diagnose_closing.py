"""Diagnose job closing pipeline state."""
from datetime import datetime

from sqlalchemy import inspect, or_

from database import SessionLocal, engine
from models.application import Application
from models.job_offer import JobOffer
from models.notification import Notification
from models.interview import Interview


def main():
    insp = inspect(engine)
    cols = {c["name"] for c in insp.get_columns("job_offers")}
    print("closing_processed column:", "closing_processed" in cols)

    db = SessionLocal()
    try:
        now = datetime.utcnow()
        jobs = (
            db.query(JobOffer)
            .filter(JobOffer.closing_date.isnot(None))
            .order_by(JobOffer.closing_date.desc())
            .limit(10)
            .all()
        )
        print(f"\nUTC now: {now}\n")
        for j in jobs:
            apps = db.query(Application).filter(Application.job_id == j.job_id).count()
            proc = getattr(j, "closing_processed", None)
            print(
                f"- {j.title[:50]!r}\n"
                f"  id={j.job_id[:8]}... active={j.is_active} processed={proc}\n"
                f"  closing={j.closing_date} apps={apps}"
            )

        if "closing_processed" in cols:
            pending = (
                db.query(JobOffer.job_id)
                .filter(
                    JobOffer.closing_date.isnot(None),
                    JobOffer.closing_date <= now,
                    or_(JobOffer.closing_processed == False, JobOffer.closing_processed.is_(None)),
                )
                .all()
            )
            print(f"\nJobs needing pipeline: {len(pending)}")
            for (jid,) in pending[:5]:
                print(f"  {jid}")

        recent_notifs = (
            db.query(Notification)
            .filter(Notification.type == "INTERVIEW_TIME_SELECTION")
            .order_by(Notification.created_at.desc())
            .limit(5)
            .all()
        )
        print(f"\nINTERVIEW_TIME_SELECTION notifications: {len(recent_notifs)}")
        for n in recent_notifs:
            print(f"  {n.title[:60]} user={n.user_id[:8]}...")

        interviews = db.query(Interview).count()
        print(f"\nTotal interviews: {interviews}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
