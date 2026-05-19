"""Force-run closing pipeline for all jobs past closing time. Usage: python scripts/run_closing_now.py"""
import sys

sys.path.insert(0, ".")

from database import SessionLocal
from services.job_closing_service import close_due_jobs, jobs_pending_closing_pipeline, _jobs_past_closing


def main():
    db = SessionLocal()
    try:
        past = _jobs_past_closing(db)
        print(f"Jobs past closing: {len(past)}")
        for j in past:
            print(f"  - {j.title} | active={j.is_active} | processed={j.closing_processed}")

        pending = jobs_pending_closing_pipeline(db)
        print(f"Pending pipeline: {pending}")

        n = close_due_jobs(db)
        print(f"Processed: {n} job(s)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
