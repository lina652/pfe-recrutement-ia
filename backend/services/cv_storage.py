"""Persist candidate CV files and parsed JSON for consistent matching."""

from __future__ import annotations

import json
import logging
import shutil
import uuid
from pathlib import Path
from typing import Any, Optional

from sqlalchemy.orm import Session

from core.cv_upload import is_allowed_cv_filename
from models.cv_version import CVVersion

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
CV_PENDING_DIR = BASE_DIR / "uploads" / "cv_pending"
CV_STORE_DIR = BASE_DIR / "uploads" / "cvs"


def ensure_cv_dirs() -> None:
    CV_PENDING_DIR.mkdir(parents=True, exist_ok=True)
    CV_STORE_DIR.mkdir(parents=True, exist_ok=True)


def _parsed_cache_path(file_path: str | Path) -> Path:
    path = Path(file_path)
    return path.with_suffix(path.suffix + ".parsed.json")


def write_parsed_cache(file_path: str | Path, parsed_cv: dict) -> None:
    cache = _parsed_cache_path(file_path)
    cache.parent.mkdir(parents=True, exist_ok=True)
    with open(cache, "w", encoding="utf-8") as fh:
        json.dump(parsed_cv, fh, ensure_ascii=False)


def read_parsed_cache(file_path: str | Path) -> Optional[dict]:
    cache = _parsed_cache_path(file_path)
    if not cache.is_file():
        return None
    try:
        with open(cache, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Could not read parsed CV cache %s: %s", cache, exc)
        return None


def save_pending_cv_upload(
    contents: bytes,
    filename: str,
    parsed_cv: dict,
) -> str:
    """Store uploaded CV + parsed JSON until signup/login attaches it to a candidate."""
    ensure_cv_dirs()
    if not is_allowed_cv_filename(filename):
        raise ValueError("Unsupported CV file type")

    upload_id = str(uuid.uuid4())
    pending_dir = CV_PENDING_DIR / upload_id
    pending_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(filename).name or "cv.pdf"
    file_path = pending_dir / safe_name
    file_path.write_bytes(contents)
    write_parsed_cache(file_path, parsed_cv)

    logger.info("Pending CV upload stored: %s (%s)", upload_id, safe_name)
    return upload_id


def _pending_dir(upload_id: str) -> Path:
    if not upload_id or len(upload_id) < 8:
        raise ValueError("Invalid CV upload id")
    return CV_PENDING_DIR / upload_id


def finalize_cv_upload(
    db: Session,
    candidate_id: str,
    upload_id: str,
) -> CVVersion:
    """Move pending upload to permanent storage and create/replace active CVVersion."""
    ensure_cv_dirs()
    pending = _pending_dir(upload_id)
    if not pending.is_dir():
        raise FileNotFoundError("CV upload expired or not found")

    files = [p for p in pending.iterdir() if p.is_file() and not p.name.endswith(".parsed.json")]
    if not files:
        raise FileNotFoundError("CV upload has no file")

    source_file = files[0]
    parsed = read_parsed_cache(source_file)
    if not parsed:
        raise ValueError("Parsed CV data missing for upload")

    candidate_dir = CV_STORE_DIR / candidate_id
    candidate_dir.mkdir(parents=True, exist_ok=True)

    db.query(CVVersion).filter(
        CVVersion.candidate_id == candidate_id,
        CVVersion.is_active == True,
    ).update({CVVersion.is_active: False}, synchronize_session=False)

    latest = (
        db.query(CVVersion)
        .filter(CVVersion.candidate_id == candidate_id)
        .order_by(CVVersion.version_number.desc())
        .first()
    )
    next_version = (latest.version_number + 1) if latest else 1

    dest_file = candidate_dir / f"v{next_version}_{source_file.name}"
    shutil.copy2(source_file, dest_file)
    write_parsed_cache(dest_file, parsed)

    cv_version = CVVersion(
        cv_id=str(uuid.uuid4()),
        candidate_id=candidate_id,
        file_name=source_file.name,
        file_path=str(dest_file),
        is_active=True,
        version_number=next_version,
    )
    db.add(cv_version)
    db.flush()

    try:
        shutil.rmtree(pending, ignore_errors=True)
    except OSError as exc:
        logger.warning("Could not remove pending CV dir %s: %s", pending, exc)

    logger.info(
        "CV attached to candidate %s as version %s",
        candidate_id,
        next_version,
    )
    return cv_version


def attach_pending_upload_to_candidate(
    db: Session,
    candidate_id: str,
    upload_id: str,
) -> CVVersion:
    return finalize_cv_upload(db, candidate_id, upload_id)
