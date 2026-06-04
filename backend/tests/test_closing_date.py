from datetime import datetime, timedelta

from core.closing_date import is_closing_due, parse_closing_datetime


def test_closing_not_due_when_in_future():
    future = datetime.now().replace(microsecond=0) + timedelta(days=7)
    assert is_closing_due(future) is False


def test_closing_due_when_in_past():
    past = datetime.now().replace(microsecond=0) - timedelta(days=1)
    assert is_closing_due(past) is True


def test_closing_none_is_not_due():
    assert is_closing_due(None) is False


def test_parse_closing_datetime_iso_date():
    parsed = parse_closing_datetime("2026-12-31")
    assert parsed.year == 2026
    assert parsed.month == 12
    assert parsed.day == 31
