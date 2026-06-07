from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200

def test_valid_medicine():
    res = client.post("/verify/batch", json={
        "batch_number": "DL23X1"
    })
    assert res.status_code == 200
    assert res.json()["status"] == "valid"
    assert res.json()["brand_name"] == "Dolo 650"

def test_counterfeit_medicine():
    res = client.post("/verify/batch", json={
        "batch_number": "DL23X9"
    })
    assert res.status_code == 200
    assert res.json()["status"] == "recalled"
    assert res.json()["is_counterfeit_alert"] == True

def test_not_found():
    res = client.post("/verify/batch", json={
        "batch_number": "FAKE999"
    })
    assert res.status_code == 200
    assert res.json()["status"] == "not_found"

def test_missing_batch_number():
    res = client.post("/verify/batch", json={})
    assert res.status_code == 422