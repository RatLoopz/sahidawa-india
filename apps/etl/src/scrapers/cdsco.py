"""
SahiDawa — CDSCO Reference Data Scraper
========================================
Migrated from: data/validate_cdsco.py (get_cdsco_data / load_cdsco_data)

Fetches the CDSCO brand-name drug registry via their public REST API
and saves it as a local CSV for use by the CDSCO validator.

PIPELINE ROLE:
    fetch_and_save() → saves data/seeds/cdsco_reference.csv
    load()           → returns normalized pd.DataFrame for the validator
"""

import os
import sys
from pathlib import Path

# Allow running directly as a script
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from pydantic import BaseModel, field_validator, ValidationError
from typing import Optional

from src.utils.logger import logger


# ── Schema ─────────────────────────────────────────────────────────────────────

class CDSCORecord(BaseModel):
    firm_name: Optional[str] = None
    license_number: Optional[str] = None
    generic_name: Optional[str] = None
    brand_name: Optional[str] = None

    @field_validator("*", mode="before")
    @classmethod
    def strip_and_coerce(cls, v):
        if isinstance(v, str):
            return v.strip()
        if isinstance(v, (int, float)):
            return str(v).strip()
        return v


# ── Constants ──────────────────────────────────────────────────────────────────

CDSCO_URL = "https://cdscoonline.gov.in/CDSCO/loadRule84abBrandNames?searchText="
SEEDS_DIR = Path(__file__).resolve().parents[4] / "data" / "seeds"
REFERENCE_CSV = SEEDS_DIR / "cdsco_reference.csv"


# ── Scraper ────────────────────────────────────────────────────────────────────

class CDSCOScraper:
    """
    Fetches CDSCO brand-name drug data from the public portal API.
    Saves the result to data/seeds/cdsco_reference.csv.
    """

    def fetch_and_save(self, force: bool = False) -> Path:
        """
        Download CDSCO reference data and save to CSV.

        Args:
            force: Re-download even if the file already exists.

        Returns:
            Path to the saved CSV file.
        """
        if REFERENCE_CSV.exists() and not force:
            logger.info(f"[CDSCO] Reference CSV already exists at {REFERENCE_CSV} — skipping fetch.")
            return REFERENCE_CSV

        logger.info("[CDSCO] Fetching data from portal...")
        
        session = requests.Session()
        retries = Retry(
            total=5,
            backoff_factor=1,
            status_forcelist=[500, 502, 503, 504],
            allowed_methods=["GET"]
        )
        adapter = HTTPAdapter(max_retries=retries)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        # ── PAGINATION LOGIC WITH MIDWAY RETRIES ──────────────────────────────
        all_records = []
        page_size = 100
        display_start = 0
        max_pages = 500  # Infinite loop se bachne ke liye safe upper bound safeguard
        page_num = 1

        while page_num <= max_pages:
            paginated_url = f"{CDSCO_URL}&iDisplayStart={display_start}&iDisplayLength={page_size}"
            logger.info(f"[CDSCO] Fetching page {page_num} (Offset: {display_start})...")
            
            # Midway connection resets aur transient timeouts handle karne ke liye page-level retry block
            page_response = None
            for attempt in range(1, 4):
                try:
                    page_response = session.get(paginated_url, timeout=30)
                    if page_response.status_code == 200:
                        break
                except (requests.ConnectionError, requests.Timeout) as e:
                    if attempt == 3:
                        logger.error(f"[CDSCO] Max retries exhausted for page {page_num} due to error: {e}")
                        raise e
                    logger.warning(f"[CDSCO] Connection problem on page {page_num} (Attempt {attempt}/3). Retrying in 2s...")
                    import time
                    time.sleep(2)

            if not page_response or page_response.status_code != 200:
                raise RuntimeError(
                    f"[CDSCO] Fetch failed on page {page_num} — HTTP {page_response.status_code if page_response else 'No Response'}"
                )

            try:
                data = page_response.json()
            except Exception as parse_err:
                logger.error(f"[CDSCO] JSON parsing failed on page {page_num}: {parse_err}")
                break

            records = data.get("aaData", [])
            if not records:
                logger.info(f"[CDSCO] Empty page reached at page {page_num}. Ending pagination.")
                break

            valid_records = []
            for row in records:
                try:
                    record = CDSCORecord(**row)
                    valid_records.append(record.model_dump())
                except ValidationError as e:
                    logger.warning(f"[CDSCO] Skipping invalid row on page {page_num}: {row} | Error: {e}")

            all_records.extend(valid_records)
            logger.info(f"[CDSCO] Page {page_num} fetched successfully: Retrieved {len(records)} records (Valid: {len(valid_records)}).")

            # Agar records page_size se kam hain, iska matlab yeh aakhiri page hai
            if len(records) < page_size:
                logger.info("[CDSCO] Reached the final page (records count is less than page size).")
                break

            display_start += page_size
            page_num += 1
        else:
            logger.warning(f"[CDSCO] Reached safe safeguard limit of max pages ({max_pages}). Breaking loop.")

        logger.info(f"[CDSCO] Pagination completed. Total cumulative records fetched: {len(all_records)}")
        
        SEEDS_DIR.mkdir(parents=True, exist_ok=True)
        df = pd.DataFrame(all_records)
        df.to_csv(REFERENCE_CSV, index=False)
        logger.info(f"[CDSCO] Saved to {REFERENCE_CSV}")
        return REFERENCE_CSV

    def load(self) -> pd.DataFrame:
        """
        Load and return the CDSCO reference CSV as a DataFrame.
        Raises FileNotFoundError if the CSV hasn't been fetched yet.
        """
        if not REFERENCE_CSV.exists():
            raise FileNotFoundError(
                f"[CDSCO] Reference CSV not found at {REFERENCE_CSV}. "
                "Run fetch_and_save() first."
            )
        return pd.read_csv(REFERENCE_CSV)


if __name__ == "__main__":
    scraper = CDSCOScraper()
    scraper.fetch_and_save()
