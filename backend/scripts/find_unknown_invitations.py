"""List interviews/applications with missing or unknown candidate identity."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text
from core.config import settings


def main():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        interviews = conn.execute(
            text(
                """
                SELECT i.interview_id, i.application_id, i.candidate_id, i.job_id,
                       i.status, i.candidate_response, j.title,
                       u.first_name, u.last_name, u.email, cand.candidate_id AS cand_exists
                FROM interviews i
                LEFT JOIN job_offers j ON j.job_id = i.job_id
                LEFT JOIN candidates cand ON cand.candidate_id = i.candidate_id
                LEFT JOIN users u ON u.user_id = cand.user_id
                ORDER BY i.created_at DESC
                """
            )
        ).fetchall()

        print("=== ALL INTERVIEWS ===")
        unknown_interviews = []
        for row in interviews:
            name = f"{row[7] or ''} {row[8] or ''}".strip() or row[9] or ""
            is_unknown = not name or not row[10]
            tag = " ** UNKNOWN **" if is_unknown else ""
            print(
                f"{row[6] or '?'} | {name or 'UNKNOWN'} | status={row[4]} | "
                f"interview={row[0][:8]}... app={row[1][:8] if row[1] else '?'}{tag}"
            )
            if is_unknown:
                unknown_interviews.append(row[0])

        apps = conn.execute(
            text(
                """
                SELECT a.app_id, a.candidate_id, a.job_id, a.status, j.title,
                       u.first_name, u.last_name, u.email, cand.candidate_id AS cand_exists
                FROM applications a
                LEFT JOIN job_offers j ON j.job_id = a.job_id
                LEFT JOIN candidates cand ON cand.candidate_id = a.candidate_id
                LEFT JOIN users u ON u.user_id = cand.user_id
                WHERE a.status = 'SHORTLISTED'
                """
            )
        ).fetchall()

        print("\n=== SHORTLISTED APPLICATIONS ===")
        unknown_apps = []
        for row in apps:
            name = f"{row[5] or ''} {row[6] or ''}".strip() or row[7] or ""
            is_unknown = not name or not row[8]
            tag = " ** UNKNOWN **" if is_unknown else ""
            print(f"{row[4]} | {name or 'UNKNOWN'} | app={row[0][:8]}...{tag}")
            if is_unknown:
                unknown_apps.append(row[0])

        print(f"\nUnknown interviews: {len(unknown_interviews)}")
        print(f"Unknown shortlisted apps: {len(unknown_apps)}")

        orphan_apps = conn.execute(
            text(
                """
                SELECT COUNT(*) FROM applications a
                WHERE NOT EXISTS (
                    SELECT 1 FROM candidates c WHERE c.candidate_id = a.candidate_id
                )
                """
            )
        ).scalar()
        orphan_users = conn.execute(
            text(
                """
                SELECT COUNT(*) FROM applications a
                JOIN candidates c ON c.candidate_id = a.candidate_id
                WHERE NOT EXISTS (
                    SELECT 1 FROM users u WHERE u.user_id = c.user_id
                )
                """
            )
        ).scalar()
        print(f"Applications with no candidate row: {orphan_apps}")
        print(f"Applications with candidate but no user: {orphan_users}")


if __name__ == "__main__":
    main()
