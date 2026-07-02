import os
import logging
from datetime import date
from pathlib import Path
from typing import Literal, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/verify", tags=["Verification"])

logger = logging.getLogger(__name__)

ENV_CSV_PATH = "MEDICINES_CSV_PATH"
CONTAINER_CSV_PATH = Path("/data/seeds/medicines.csv")
APP_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT_CSV_PATH = APP_DIR.parent.parent / "data/seeds/medicines.csv"
LOCAL_CWD_CSV_PATH = Path.cwd() / "data/seeds/medicines.csv"
REQUIRED_COLUMNS = {
    "batch_number",
    "brand_name",
    "generic_name",
    "manufacturer",
    "composition",
    "expiry_date",
    "cdsco_approval_status",
    "is_counterfeit_alert",
}


def _dedupe_paths(paths: list[Path]) -> list[Path]:
    seen = set()
    unique_paths = []

    for path in paths:
        key = str(path)
        if key in seen:
            continue

        seen.add(key)
        unique_paths.append(path)

    return unique_paths


def medicine_csv_candidates() -> list[Path]:
    configured_path = os.getenv(ENV_CSV_PATH)

    if configured_path:
        return [Path(configured_path).expanduser()]

    return _dedupe_paths([
        CONTAINER_CSV_PATH,
        REPO_ROOT_CSV_PATH,
        LOCAL_CWD_CSV_PATH,
    ])


def resolve_medicines_csv_path() -> Path:
    candidates = medicine_csv_candidates()

    for path in candidates:
        if path.is_file():
            return path

    checked_paths = ", ".join(str(path) for path in candidates)
    raise FileNotFoundError(
        "Medicine seed CSV not found. Set "
        f"{ENV_CSV_PATH} to a readable CSV file. Checked: {checked_paths}"
    )


def load_medicines_dataframe(csv_path: Path | str | None = None) -> pd.DataFrame:
    path = Path(csv_path).expanduser() if csv_path else resolve_medicines_csv_path()

    if not path.is_file():
        raise FileNotFoundError(
            f"{ENV_CSV_PATH} points to a missing medicine seed CSV: {path}"
        )

    try:
        medicines_df = pd.read_csv(path)
    except Exception as exc:
        raise RuntimeError(
            f"Failed to read medicine seed CSV at {path}: {exc}"
        ) from exc

    medicines_df.columns = medicines_df.columns.str.strip().str.lower()

    missing_columns = REQUIRED_COLUMNS - set(medicines_df.columns)
    if missing_columns:
        missing = ", ".join(sorted(missing_columns))
        raise RuntimeError(
            f"Medicine seed CSV at {path} is missing required columns: {missing}"
        )

    if medicines_df.empty:
        raise RuntimeError(f"Medicine seed CSV at {path} contains no records")

    logger.info(
        "Loaded %s medicine seed records from %s",
        len(medicines_df),
        path,
    )
    return medicines_df


try:
    CSV_PATH = resolve_medicines_csv_path()
    df = load_medicines_dataframe(CSV_PATH)
except Exception as exc:
    logger.warning("Verification medicine database failed to load: %s. Continuing without it.", exc)
    import pandas as pd
    df = pd.DataFrame()
    CSV_PATH = None


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
            detail=f"Medicine database unavailable from {CSV_PATH}"
        )

    # Match batch number (case-insensitive)
    result = df[
        df["batch_number"].astype(str).str.upper()
        == request.batch_number.upper()
    ]

    # Match manufacturer if provided (case-insensitive)
    if request.manufacturer:
        result = result[
            result["manufacturer"].astype(str).str.upper()
            == request.manufacturer.upper()
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
