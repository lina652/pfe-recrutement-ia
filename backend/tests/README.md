# Unit tests (pytest) — IntelliJ / PyCharm

## Install

```powershell
cd backend
.\venv\Scripts\activate
pip install pytest httpx
```

## IntelliJ setup

1. Interpreter: `backend\venv\Scripts\python.exe`
2. Mark `backend` as **Sources Root**
3. **Settings → Python → Testing → Default test runner: pytest**

## Test files (what each covers)

| File | Type | What it tests |
|------|------|----------------|
| `test_cv_upload.py` | Unit | PDF/PNG allowed, `.exe` rejected |
| `test_matching_utils.py` | Unit | Language aliases, education level |
| `test_final_selection.py` | Unit | Composite score 35% CV + 65% interview |
| `test_closing_date.py` | Unit | Job closing due / not due |
| `test_matching_threshold.py` | Unit | Skill match threshold (mock embeddings) |
| `test_api_health.py` | API | `GET /health` → 200 |
| `test_api_public.py` | API | `POST /match-cv` bad file → 400 |
| `test_api_auth.py` | API | Wrong email login → 401 |
| `test_api_candidate.py` | API | `POST /signup/cv` with mocked NER/OCR |
| `test_rag_service.py` | Unit | RAG chunking, full context (≤20 candidats), k dynamique, cache refresh |

## Run in IntelliJ

- Right-click **`tests`** → **Run 'pytest in tests'**
- Or click green ▶ on one `def test_...`

## Run in terminal

```powershell
# Fast unit tests only (no main.py import)
pytest tests/test_cv_upload.py tests/test_matching_utils.py tests/test_final_selection.py tests/test_closing_date.py tests/test_matching_threshold.py tests/test_rag_service.py -v

# All tests (API tests load FastAPI app — slower)
pytest -v
```

## How API tests work

- **`client` fixture** (`conftest.py`): FastAPI `TestClient` calls routes like a real HTTP client.
- **Mocks** (`@patch`): Replace Groq/OCR/storage so tests do not call AI or write files.
- **Auth 401 test**: Uses an email that does not exist — no test user seeding required.

## Wrong-password test (optional, needs DB user)

If you have `admin@techcorp.com` in PostgreSQL:

```python
def test_login_wrong_password_returns_401(client):
    r = client.post("/auth/login", json={"email": "admin@techcorp.com", "password": "wrong"})
    assert r.status_code == 401
```

Requires PostgreSQL running with that account.
