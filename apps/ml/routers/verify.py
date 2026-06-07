from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal, Optional
import pandas as pd
import os
from datetime import date

router = APIRouter(prefix="/verify", tags=["Verification"])

CSV_PATH = os.path.join(
    os.path.dirname(__file__),
    "../../../data/seeds/medicines.csv"
)

try:
    df = pd.read_csv(CSV_PATH)
    df.columns = df.columns.str.strip().str.lower()
except Exception:
    df = pd.DataFrame()


class BatchVerifyRequest(BaseModel):
    batch_number: str
    manufacturer: Optional[str] = None


class BatchVerifyResponse(BaseModel):
    status: Literal["valid", "recalled", "expired", "not_found"]
    brand_name: Optional[str] = None
    generic_name: Optional[str] = None
    manufacturer: Optional[str] = None
    composition: Optional[str] = None
    expiry_date: Optional[str] = None
    cdsco_approval_status: Optional[str] = None
    is_counterfeit_alert: Optional[bool] = None
    source: str = "database"


@router.post("/batch", response_model=BatchVerifyResponse)
async def verify_batch(request: BatchVerifyRequest):
    if df.empty:
        raise HTTPException(
            status_code=503,
            detail="Medicine database unavailable"
        )

    # Match batch number (case-insensitive)
    result = df[
        df["batch_number"].astype(str).str.upper()
        == request.batch_number.upper()
    ]

    if result.empty:
        return BatchVerifyResponse(status="not_found")

    row = result.iloc[0]

    # Check counterfeit flag
    is_counterfeit = str(
        row["is_counterfeit_alert"]
    ).lower() == "true"

    # Check approval status
    is_banned = str(
        row["cdsco_approval_status"]
    ).lower() == "banned"

    # Check expiry
    is_expired = False
    try:
        expiry = pd.to_datetime(row["expiry_date"]).date()
        is_expired = expiry < date.today()
    except Exception:
        pass

    # Determine final status
    if is_counterfeit or is_banned:
        status = "recalled"
    elif is_expired:
        status = "expired"
    else:
        status = "valid"

    return BatchVerifyResponse(
        status=status,
        brand_name=str(row["brand_name"]),
        generic_name=str(row["generic_name"]),
        manufacturer=str(row["manufacturer"]),
        composition=str(row["composition"]),
        expiry_date=str(row["expiry_date"]),
        cdsco_approval_status=str(row["cdsco_approval_status"]),
        is_counterfeit_alert=is_counterfeit,
        source="database"
    )