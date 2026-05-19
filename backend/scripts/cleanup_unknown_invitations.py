"""
Remove interview invitations tied to applications whose candidate has no valid user profile.
Run: python scripts/cleanup_unknown_invitations.py
      python scripts/cleanup_unknown_invitations.py --apply
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text
from core.config import settings


def _unknown_application_ids(conn):
    rows = conn.execute(
        text(
            """
            SELECT a.app_id, j.title, a.status
            FROM applications a
            JOIN candidates c ON c.candidate_id = a.candidate_id
            LEFT JOIN users u ON u.user_id = c.user_id
            LEFT JOIN job_offers j ON j.job_id = a.job_id
            WHERE u.user_id IS NULL
               OR TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) = ''
            ORDER BY j.title, a.status
            """
        )
    ).fetchall()
    return rows


def _interview_ids_for_apps(conn, app_ids: list[str]) -> list[str]:
    if not app_ids:
        return []
    placeholders = ", ".join(f":a{i}" for i in range(len(app_ids)))
    params = {f"a{i}": aid for i, aid in enumerate(app_ids)}
    rows = conn.execute(
        text(
            f"""
            SELECT interview_id FROM interviews
            WHERE application_id IN ({placeholders})
            """
        ),
        params,
    ).fetchall()
    return [r[0] for r in rows]


def cleanup(apply: bool) -> None:
    engine = create_engine(settings.DATABASE_URL)
    with engine.begin() as conn:
        unknown_apps = _unknown_application_ids(conn)
        app_ids = [r[0] for r in unknown_apps]
        interview_ids = _interview_ids_for_apps(conn, app_ids)

        print(f"Unknown applications (no valid user): {len(app_ids)}")
        for app_id, title, status in unknown_apps[:20]:
            print(f"  - {title} | {status} | {app_id}")
        if len(unknown_apps) > 20:
            print(f"  ... and {len(unknown_apps) - 20} more")

        print(f"Interviews to remove: {len(interview_ids)}")

        if not apply:
            print("\nDry run only. Re-run with --apply to delete.")
            return

        if interview_ids:
            ph_i = ", ".join(f":i{n}" for n in range(len(interview_ids)))
            pi = {f"i{n}": iid for n, iid in enumerate(interview_ids)}
            conn.execute(
                text(f"DELETE FROM interview_messages WHERE interview_id IN ({ph_i})"),
                pi,
            )
            conn.execute(
                text(f"DELETE FROM interview_reports WHERE interview_id IN ({ph_i})"),
                pi,
            )
            conn.execute(
                text(f"DELETE FROM interviews WHERE interview_id IN ({ph_i})"),
                pi,
            )

        if app_ids:
            ph_a = ", ".join(f":a{n}" for n in range(len(app_ids)))
            pa = {f"a{n}": aid for n, aid in enumerate(app_ids)}
            conn.execute(
                text(
                    f"DELETE FROM notifications WHERE reference_id IN ({ph_a})"
                ),
                pa,
            )
            deleted_apps = conn.execute(
                text(f"DELETE FROM applications WHERE app_id IN ({ph_a})"),
                pa,
            ).rowcount
        else:
            deleted_apps = 0

        print(f"\nDeleted {len(interview_ids)} interviews and {deleted_apps} applications.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually delete rows (default is dry run)",
    )
    args = parser.parse_args()
    cleanup(apply=args.apply)
