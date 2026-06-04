def test_login_unknown_email_returns_401(client):
    response = client.post(
        "/auth/login",
        json={
            "email": "nobody@example.com",
            "password": "WrongPassword123!",
        },
    )
    assert response.status_code == 401
    assert "invalid" in response.json()["detail"].lower()
