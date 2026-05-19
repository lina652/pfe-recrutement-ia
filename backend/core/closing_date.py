"""Closing date parsing and due checks (datetime-local = manager local wall clock)."""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException

_PAST_GRACE = timedelta(minutes=1)
_DUE_GRACE = timedelta(seconds=30)

_CLOSING_FORMATS = (
    "%Y-%m-%dT%H:%M:%S.%f",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d",
)


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _local_now_naive() -> datetime:
    return datetime.now().replace(tzinfo=None)


def is_closing_due(closing: Optional[datetime]) -> bool:
    """True when closing time has passed (naive datetimes = local wall-clock)."""
    if closing is None:
        return False
    grace = _DUE_GRACE
    if closing.tzinfo is not None:
        closing = closing.astimezone().replace(tzinfo=None)
    return closing <= _local_now_naive() + grace


def parse_closing_datetime(value: str) -> datetime:
    if not value or not str(value).strip():
        raise HTTPException(status_code=400, detail="Closing date is required")

    raw = str(value).strip()
    # ISO from frontend (UTC): 2026-05-17T16:50:00.000Z
    if "T" in raw and ("Z" in raw.upper() or "+" in raw[10:] or raw.endswith("z")):
        try:
            normalized = raw.replace("Z", "+00:00").replace("z", "+00:00")
            dt = datetime.fromisoformat(normalized)
            return dt.astimezone().replace(tzinfo=None)
        except ValueError:
            pass

    for fmt in _CLOSING_FORMATS:
        try:
            dt = datetime.strptime(raw, fmt)
            if fmt == "%Y-%m-%d":
                dt = dt.replace(hour=23, minute=59, second=0)
            return dt
        except ValueError:
            continue

    raise HTTPException(
        status_code=400,
        detail="Invalid closing date format. Use YYYY-MM-DDTHH:mm (date and time).",
    )


def validate_closing_datetime(
    closing: datetime,
    reference: Optional[datetime] = None,
) -> datetime:
    ref = reference or _local_now_naive()
    if closing < ref - _PAST_GRACE:
        raise HTTPException(
            status_code=400,
            detail=(
                "Closing date cannot be before the job creation time. "
                "You may set it to the same day and time as creation."
            ),
        )
    return closing


def parse_and_validate_closing(value: str, reference: Optional[datetime] = None) -> datetime:
    closing = parse_closing_datetime(value)
    return validate_closing_datetime(closing, reference)
