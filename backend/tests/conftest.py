"""Shared pytest fixtures for IntelliJ / CLI runs."""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


def _mock_db_session():
    """Minimal DB session for API tests without PostgreSQL."""
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []
    db.query.return_value.filter.return_value.first.return_value = None
    db.commit = MagicMock()
    db.refresh = MagicMock()
    db.add = MagicMock()
    db.flush = MagicMock()
    db.close = MagicMock()
    return db


@pytest.fixture(scope="session")
def client():
    """FastAPI test client; startup and DB are mocked so Postgres is optional."""
    mock_db = _mock_db_session()

    def override_get_db():
        yield mock_db

    with patch("main.run_database_syncs"), patch(
        "services.job_closing_service.close_due_jobs", return_value=0
    ), patch("services.job_closing_service.sync_job_closings"):
        from database import get_db
        from main import app

        app.dependency_overrides[get_db] = override_get_db
        with TestClient(app) as test_client:
            yield test_client
        app.dependency_overrides.clear()
