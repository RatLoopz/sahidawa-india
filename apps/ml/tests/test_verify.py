from fastapi.testclient import TestClient
import pytest

from main import app
from routers.verify import CSV_PATH, load_medicines_dataframe

client = TestClient(app)


def test_loader_reads_configured_seed_csv():
    medicines_df = load_medicines_dataframe(CSV_PATH)

    result = medicines_df[
        medicines_df["batch_number"].astype(str).str.upper() == "DL23X1"
    ]

    assert not result.empty
    assert result.iloc[0]["brand_name"] == "Dolo 650"


def test_loader_reports_missing_seed_csv(tmp_path):
    missing_csv_path = tmp_path / "missing-medicines.csv"

    with pytest.raises(FileNotFoundError, match="MEDICINES_CSV_PATH"):
        load_medicines_dataframe(missing_csv_path)


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
