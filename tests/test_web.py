from mapgen.web import app


def test_health():
    client = app.test_client()
    response = client.get("/health")
    assert response.status_code == 200
    assert response.get_json()["ok"] is True


def test_generate_requires_bbox():
    client = app.test_client()
    response = client.post("/api/generate", json={})
    assert response.status_code == 400
    assert "bbox" in response.get_json()["error"]


def test_generate_rejects_oversized_bbox():
    client = app.test_client()
    response = client.post(
        "/api/generate",
        json={"bbox": [40.0, 30.0, 50.0, 40.0], "name": "too-big"},
    )
    assert response.status_code == 400
    assert "лимита" in response.get_json()["error"]
