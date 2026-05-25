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
from pathlib import Path

import pandas as pd
import requests

from src.utils.logger import logger


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
        response = requests.get(CDSCO_URL, timeout=30)

        if response.status_code != 200:
            raise RuntimeError(
                f"[CDSCO] Fetch failed — HTTP {response.status_code}"
            )

        data = response.json()
        records = data.get("aaData", [])
        logger.info(f"[CDSCO] Retrieved {len(records)} records")

        SEEDS_DIR.mkdir(parents=True, exist_ok=True)
        df = pd.DataFrame(records)
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
