import os

from dependencies import verify_api_key
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_compare_requires_api_key():
    app.dependency_overrides.pop(verify_api_key, None)
    os.environ["ML_API_KEY"] = "test-secret-123"
    try:
        res = client.post("/verify/compare", json={
            "medicine_a": "Dolo 650",
            "medicine_b": "Crocin",
        })
        assert res.status_code == 401
    finally:
        app.dependency_overrides[verify_api_key] = lambda: None


def test_compare_route_registered_and_in_openapi():
    paths = app.openapi()["paths"]
    assert "/verify/compare" in paths
    assert "post" in paths["/verify/compare"]


def test_compare_returns_similarity_score(monkeypatch):
    def fake_embed_query(text: str):
        if text == "Dolo 650":
            return [0.0, 1.0]
        return [1.0, 0.0]

    monkeypatch.setattr("services.embedding.embed_query", fake_embed_query)

    res = client.post("/verify/compare", json={
        "medicine_a": "Dolo 650",
        "medicine_b": "Crocin",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["medicine_a"] == "Dolo 650"
    assert body["medicine_b"] == "Crocin"
    assert body["similarity_score"] == 0.0
    assert body["verdict"] == "different"


def test_compare_highly_similar_verdict(monkeypatch):
    def fake_embed_query(text: str):
        return [0.6, 0.8]

    monkeypatch.setattr("services.embedding.embed_query", fake_embed_query)
    monkeypatch.setattr(
        "services.similarity.cosine_similarity",
        lambda a, b: 0.95,
    )

    res = client.post("/verify/compare", json={
        "medicine_a": "Dolo 650",
        "medicine_b": "Dolo 650",
    })
    assert res.status_code == 200
    assert res.json()["similarity_score"] == 0.95
    assert res.json()["verdict"] == "highly_similar"


def test_compare_rejects_empty_medicine():
    res = client.post("/verify/compare", json={
        "medicine_a": "",
        "medicine_b": "Crocin",
    })
    assert res.status_code == 400
    assert res.json()["detail"] == "Both medicine names are required"


def test_compare_rejects_missing_field():
    res = client.post("/verify/compare", json={
        "medicine_a": "Dolo 650",
    })
    assert res.status_code == 422


def test_compare_rejects_non_string_field():
    res = client.post("/verify/compare", json={
        "medicine_a": "Dolo 650",
        "medicine_b": 42,
    })
    assert res.status_code == 422


def test_compare_handles_embedding_failure(monkeypatch):
    def fake_embed_query(text: str):
        return None

    monkeypatch.setattr("services.embedding.embed_query", fake_embed_query)

    res = client.post("/verify/compare", json={
        "medicine_a": "Dolo 650",
        "medicine_b": "Crocin",
    })
    assert res.status_code == 502


def test_compare_no_mutation_of_vectors(monkeypatch):
    def fake_embed_query(text: str):
        return [0.5, 0.5]

    monkeypatch.setattr("services.embedding.embed_query", fake_embed_query)

    res = client.post("/verify/compare", json={
        "medicine_a": "A",
        "medicine_b": "B",
    })
    assert res.status_code == 200
