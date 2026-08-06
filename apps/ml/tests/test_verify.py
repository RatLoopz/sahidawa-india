from datetime import date, datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pandas as pd
import pytest

from routers import verify as verify_module
from routers.verify import CSV_PATH, classify_expiry, load_medicines_dataframe, router

app = FastAPI()
app.include_router(router)
client = TestClient(app)


def _medicine_row(**overrides):
    row = {
        "batch_number": "TESTBATCH",
        "brand_name": "Test Med",
        "generic_name": "Test Generic",
        "manufacturer": "Test Labs",
        "composition": "Test 100mg",
        "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
        "cdsco_approval_status": "approved",
        "is_counterfeit_alert": False,
    }
    row.update(overrides)
    return row


@pytest.fixture
def patch_medicines_df(monkeypatch):
    def _apply(rows):
        monkeypatch.setattr(verify_module, "df", pd.DataFrame(rows))

    return _apply


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


def test_classify_expiry_valid_future_date():
    assert classify_expiry((date.today() + timedelta(days=30)).isoformat()) == "ok"


def test_classify_expiry_expired_past_date():
    assert classify_expiry((date.today() - timedelta(days=1)).isoformat()) == "expired"


def test_classify_expiry_malformed():
    assert classify_expiry("not-a-date") == "unverifiable"
    assert classify_expiry("32/13/2020") == "unverifiable"


def test_classify_expiry_null_and_blank():
    assert classify_expiry(None) == "unverifiable"
    assert classify_expiry(float("nan")) == "unverifiable"
    assert classify_expiry(pd.NaT) == "unverifiable"
    assert classify_expiry("") == "unverifiable"
    assert classify_expiry("   ") == "unverifiable"


def test_classify_expiry_timezone_boundary():
    # Just before local midnight UTC should still resolve to a concrete date.
    near_midnight = datetime(2020, 1, 1, 23, 59, tzinfo=timezone.utc)
    assert classify_expiry(near_midnight) == "expired"

    future_aware = datetime.now(timezone.utc) + timedelta(days=10)
    assert classify_expiry(future_aware) == "ok"


def test_batch_expired_medicine(patch_medicines_df):
    patch_medicines_df([
        _medicine_row(
            batch_number="EXP001",
            expiry_date=(date.today() - timedelta(days=7)).isoformat(),
        )
    ])

    res = client.post("/verify/batch", json={"batch_number": "EXP001"})
    assert res.status_code == 200
    assert res.json()["status"] == "expired"


def test_batch_malformed_expiry_is_unverifiable(patch_medicines_df):
    patch_medicines_df([
        _medicine_row(batch_number="BADEXP1", expiry_date="garbage-date")
    ])

    res = client.post("/verify/batch", json={"batch_number": "BADEXP1"})
    assert res.status_code == 200
    assert res.json()["status"] == "unverifiable"


def test_batch_null_expiry_is_unverifiable(patch_medicines_df):
    patch_medicines_df([
        _medicine_row(batch_number="NULLEXP", expiry_date=None)
    ])

    res = client.post("/verify/batch", json={"batch_number": "NULLEXP"})
    assert res.status_code == 200
    assert res.json()["status"] == "unverifiable"


def test_batch_recalled_overrides_bad_expiry(patch_medicines_df):
    patch_medicines_df([
        _medicine_row(
            batch_number="RECALL1",
            expiry_date="not-a-date",
            cdsco_approval_status="banned",
            is_counterfeit_alert=True,
        )
    ])

    res = client.post("/verify/batch", json={"batch_number": "RECALL1"})
    assert res.status_code == 200
    assert res.json()["status"] == "recalled"
