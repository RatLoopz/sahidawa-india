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
import time
import math
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

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


# ── Rate Limiter ───────────────────────────────────────────────────────────────

class RateLimiter:
    """Thread-safe rate limiter to enforce max N requests per period."""
    def __init__(self, max_requests: int, period: float):
        self.max_requests = max_requests
        self.period = period
        self.requests = []
        self.lock = threading.Lock()

    def wait(self):
        while True:
            with self.lock:
                now = time.time()
                # Remove requests older than the period
                self.requests = [t for t in self.requests if now - t < self.period]
                if len(self.requests) < self.max_requests:
                    self.requests.append(now)
                    return
                # Calculate time to wait until the oldest request in the window expires
                sleep_time = self.period - (now - self.requests[0])
            time.sleep(sleep_time)

# ── Scraper ────────────────────────────────────────────────────────────────────

class CDSCOScraper:
    """
    Fetches CDSCO brand-name drug data from the public portal API.
    Saves the result to data/seeds/cdsco_reference.csv.
    """

    def __init__(self):
        self.session = requests.Session()
        retries = Retry(
            total=5,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"]
        )
        adapter = HTTPAdapter(max_retries=retries)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        # Limit to 5 requests per second to avoid being blocked by CDSCO
        self.rate_limiter = RateLimiter(max_requests=5, period=1.0)

    def _validate_records(self, records: list, page_num: int) -> list:
        valid_records = []
        for row in records:
            try:
                record = CDSCORecord(**row)
                valid_records.append(record.model_dump())
            except ValidationError as e:
                logger.warning(f"[CDSCO] Skipping invalid row on page {page_num}: {row} | Error: {e}")
        return valid_records

    def _fetch_single_page(self, page_num: int, display_start: int, page_size: int) -> list:
        paginated_url = f"{CDSCO_URL}&iDisplayStart={display_start}&iDisplayLength={page_size}"
        logger.info(f"[CDSCO] Fetching page {page_num} (Offset: {display_start})...")
        
        page_response = None
        for attempt in range(1, 4):
            try:
                self.rate_limiter.wait()
                page_response = self.session.get(paginated_url, timeout=30)
                if page_response.status_code == 200:
                    break
            except (requests.ConnectionError, requests.Timeout) as e:
                if attempt == 3:
                    logger.error(f"[CDSCO] Max retries exhausted for page {page_num} due to error: {e}")
                    raise e
                logger.warning(f"[CDSCO] Connection problem on page {page_num} (Attempt {attempt}/3). Retrying in 2s...")
                time.sleep(2)

        if not page_response or page_response.status_code != 200:
            raise RuntimeError(f"[CDSCO] Fetch failed on page {page_num} — HTTP {page_response.status_code if page_response else 'No Response'}")

        try:
            data = page_response.json()
        except Exception as parse_err:
            logger.error(f"[CDSCO] JSON parsing failed on page {page_num}: {parse_err}")
            raise parse_err

        return self._validate_records(data.get("aaData", []), page_num)
    
    def _fetch_sequential_until_empty(self, page_size: int) -> Path:
        """
        Fallback pagination strategy used when the API doesn't return a
        reliable total-record count. Fetches pages one at a time until
        an empty page is returned (robust exit condition).
        """
        all_records = []
        page_num = 1
        display_start = 0

        while True:
            records = self._fetch_single_page(page_num, display_start, page_size)

            if not records:
                logger.info(f"[CDSCO] Empty page {page_num} received — stopping pagination.")
                break

            all_records.extend(records)

            # Exit early if the API returned fewer records than requested —
            # a strong signal that we've reached the last page.
            if len(records) < page_size:
                logger.info(
                    f"[CDSCO] Page {page_num} returned {len(records)} < {page_size} records — "
                    "reached the last page."
                )
                break

            page_num += 1
            display_start += page_size

        logger.info(f"[CDSCO] Sequential pagination completed. Total records fetched: {len(all_records)}")

        SEEDS_DIR.mkdir(parents=True, exist_ok=True)
        df = pd.DataFrame(all_records)
        df.to_csv(REFERENCE_CSV, index=False)
        logger.info(f"[CDSCO] Saved to {REFERENCE_CSV}")
        return REFERENCE_CSV

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

        logger.info("[CDSCO] Initializing probe query to determine catalog ceiling dynamically...")
        
        page_size = 100 
        max_workers = 10
        all_records_map = {}
       
        # Step 1: Probe query to Page 1 to fetch total records metadata
        try:
            paginated_url = f"{CDSCO_URL}&iDisplayStart=0&iDisplayLength={page_size}"
            self.rate_limiter.wait()
            probe_response = self.session.get(paginated_url, timeout=30)
            
            if probe_response.status_code != 200:
                raise RuntimeError(f"Probe request failed with status code {probe_response.status_code}")
                
            probe_data = probe_response.json()
            
            # Extract total records from metadata fields (fallback to 0 if not present)
            total_records = probe_data.get("iTotalDisplayRecords") or probe_data.get("iTotalRecords") or 0
            
            if total_records == 0:
                logger.warning(
                    "[CDSCO] Could not extract a valid total record count from API metadata. "
                    "Falling back to sequential fetch-until-empty mode."
                )
                return self._fetch_sequential_until_empty(page_size)

            # Step 2: Dynamically calculate exact max pages needed
            max_pages = math.ceil(total_records / page_size)
            logger.info(f"[CDSCO] Catalog Metadata Detected — Total Records: {total_records}, Dynamic Ceiling: {max_pages} pages.")
            
            # Store first page records to avoid duplicate network overhead
            all_records_map[1] = self._validate_records(probe_data.get("aaData", []), 1)
            
        except Exception as probe_err:
            logger.critical(f"[CDSCO] Failed to initiate probe or calculate dynamic pagination bounds: {probe_err}")
            raise probe_err

        # Step 3: Schedule remaining pages from page 2 onwards
        logger.info(f"[CDSCO] Fetching remaining {max_pages - 1} pages using parallel threads...")
        tasks = [(page_num, (page_num - 1) * page_size, page_size) for page_num in range(2, max_pages + 1)]
        
        try:
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_page = {
                    executor.submit(self._fetch_single_page, p_num, start, size): p_num 
                    for p_num, start, size in tasks
                }

                for future in as_completed(future_to_page):
                    page_num = future_to_page[future]
                    try:
                        records = future.result()
                        if not records:
                            logger.info(f"[CDSCO] Empty records received at page {page_num}.")
                            continue
                        all_records_map[page_num] = records
                    except Exception as e:
                        logger.error(f"[CDSCO] Fatal page failure occurred on page {page_num}: {e}")
                        raise e

        except Exception as pipeline_err:
            logger.critical(f"[CDSCO] Parallel ETL pipeline failed: {pipeline_err}")
            raise pipeline_err

        sorted_records = []
        for p_num in sorted(all_records_map.keys()):
            sorted_records.extend(all_records_map[p_num])

        logger.info(f"[CDSCO] Pagination completed. Total cumulative records fetched: {len(sorted_records)}")
        
        SEEDS_DIR.mkdir(parents=True, exist_ok=True)
        df = pd.DataFrame(sorted_records)
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
