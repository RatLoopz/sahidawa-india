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
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Allow running directly as a script
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from src.utils.logger import logger


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

        return data.get("aaData", [])

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

        logger.info("[CDSCO] Fetching data from portal using parallel threads...")
        
        page_size = 100
        max_pages = 500  
        max_workers = 10 

        all_records_map = {}
        tasks = [(page_num, (page_num - 1) * page_size, page_size) for page_num in range(1, max_pages + 1)]

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
