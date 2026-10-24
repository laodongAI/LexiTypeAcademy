from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_collection_requires_name():
    response = client.post("/api/course-collections", json={"name": " "})
    assert response.status_code == 422
