def test_match_cv_rejects_exe(client):
    response = client.post(
        "/public/jobs/match-cv",
        files={"file": ("malware.exe", b"fake", "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "accepted" in response.json()["detail"].lower()
