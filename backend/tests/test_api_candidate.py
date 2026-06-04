from unittest.mock import patch

SAMPLE_PARSED_CV = {
    "name": "Amelia Gonzalez",
    "contact": {"email": "amelia@test.com", "phone": "123", "location": "", "linkedin": "", "github": ""},
    "skills": {"technical": ["Python"], "soft": ["Leadership"]},
    "languages": [],
    "education": [],
    "work_experience": [],
    "certifications": [],
    "projects": [],
}


@patch("services.cv_storage.save_pending_cv_upload", return_value="test-upload-id-123")
@patch("api.routes.candidate.ner_service.parse_cv", return_value=SAMPLE_PARSED_CV)
@patch("api.routes.candidate.extract_cv_text", return_value="Amelia Gonzalez Python developer with five years experience.")
def test_signup_cv_returns_parsed_cv_and_upload_id(mock_extract, mock_parse, mock_save, client):
    response = client.post(
        "/candidate/signup/cv",
        files={"file": ("cv.pdf", b"%PDF-1.4 test", "application/pdf")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["cv_upload_id"] == "test-upload-id-123"
    assert body["parsed_cv"]["name"] == "Amelia Gonzalez"
    assert "Python" in body["parsed_cv"]["skills"]["technical"]
    mock_parse.assert_called_once()
    mock_save.assert_called_once()
