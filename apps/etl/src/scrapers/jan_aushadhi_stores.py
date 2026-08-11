"""
SahiDawa — Jan Aushadhi Store Locator Scraper (v3 - Ultra Fast)
================================================================
Scrapes all PMBJK (Pradhan Mantri Bhartiya Jan Aushadhi Kendra) store
locations from https://janaushadhi.gov.in/near-by-kendra

HOW IT WORKS:
    The page at near-by-kendra is a React SPA that calls an internal
    backend API at https://janaushadhi.gov.in:8443/api/v1/website/
    getAllKendraByStateDistrict

    We use Playwright to:
      1. Open near-by-kendra briefly to sniff the JWT 'authorization' header
      2. Construct manual POST requests to the backend API
      3. Call the API asynchronously using `pageSize=5000`
      4. Fetch all 20,600+ stores across India in just ~3 seconds

    This is ~6000x faster than the v2 UI pagination scraper and avoids
    Nominatim geocoding entirely since the API returns lat/lng directly!

OUTPUT:
    A pandas DataFrame matching the pharmacies table schema.

USAGE:
    python run_stores.py                    # all India (~10 seconds total)
"""

import asyncio
import json
import re
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
from playwright.async_api import async_playwright, TimeoutError as PWTimeoutError

from src.utils.logger import logger

# ── Constants ──────────────────────────────────────────────────────────────────

NEAR_BY_KENDRA_URL = "https://janaushadhi.gov.in/near-by-kendra"
RAW_DATA_DIR = Path(__file__).resolve().parents[4] / "data" / "raw" / "ja_stores"

ALL_INDIA_STATES = [
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh",
    "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand",
    "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
    "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
]

# ── Scraper ────────────────────────────────────────────────────────────────────

class JanAushadhiStoreScraper:
    """
    Scrapes the Jan Aushadhi backend API directly for maximum performance.
    """

    def __init__(self, target_states: list[str] | None = None):
        RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.target_states = target_states  # Target states logic not needed for direct API, but kept for interface

    async def scrape(self) -> pd.DataFrame:
        """Returns a normalized DataFrame ready for Supabase upsert."""
        all_stores: list[dict] = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                ignore_https_errors=True,
            )
            page = await context.new_page()

            # ── 1. Sniff JWT Token ──────────────────────────────────────────
            token = {"val": None}
            
            async def handle_request(req):
                if "Bearer" in req.headers.get("authorization", ""):
                    token["val"] = req.headers["authorization"]

            page.on("request", handle_request)
            logger.info(f"[StoresScraper] Loading {NEAR_BY_KENDRA_URL} to capture session token...")
            
            try:
                await page.goto(NEAR_BY_KENDRA_URL, wait_until="networkidle", timeout=45000)
                await page.wait_for_timeout(3000)
            except PWTimeoutError:
                pass

            if not token["val"]:
                logger.error("[StoresScraper] Failed to capture authorization token!")
                await browser.close()
                return pd.DataFrame()

            logger.info("[StoresScraper] Token captured successfully. Querying backend API...")

            # ── 2. Direct API Fetch (Concurrent) ────────────────────────────
            # The API accepts large page sizes. We use 5000 per page.
            # 5 pages * 5000 = 25,000 stores (covers the current ~20,600 stores).
            PAGE_SIZE = 5000
            TOTAL_PAGES = 5

            async def fetch_page(page_idx: int) -> list[dict]:
                url = "https://janaushadhi.gov.in:8443/api/v1/website/getAllKendraByStateDistrict"
                payload = {
                    "pageIndex": page_idx,
                    "pageSize": PAGE_SIZE,
                    "stateId": 0,
                    "districtId": 0,
                    "pinCode": 0,
                    "storeCode": ""
                }
                headers = {
                    "authorization": token["val"],
                    "accept": "application/json",
                    "content-type": "application/json"
                }
                try:
                    resp = await context.request.post(url, data=payload, headers=headers)
                    if resp.status == 200:
                        data = await resp.json()
                        records = data.get("responseBody", {}).get("addKendraResponseList", [])
                        logger.info(f"[StoresScraper] Fetched API page {page_idx} ({len(records)} stores)")
                        return records
                    else:
                        logger.error(f"[StoresScraper] API error on page {page_idx}: HTTP {resp.status}")
                except Exception as e:
                    logger.error(f"[StoresScraper] Fetch failed on page {page_idx}: {e}")
                return []

            # Fire concurrent API calls
            tasks = [fetch_page(i) for i in range(TOTAL_PAGES)]
            results = await asyncio.gather(*tasks)
            
            for records in results:
                for r in records:
                    store = {
                        "kendra_code": r.get("storeCode"),
                        "name": r.get("contactPerson") or r.get("kendraName"),
                        "state": r.get("stateName"),
                        "district": r.get("districtName"),
                        "pincode": str(r.get("pinCode") or ""),
                        "address": r.get("kendraAddress"),
                        "phone": str(r.get("contactNumber") or ""),
                        "lat": r.get("latitude"),
                        "lng": r.get("longitude"),
                    }
                    if store.get("kendra_code") or store.get("name"):
                        all_stores.append(store)

            await browser.close()

        if not all_stores:
            logger.error("[StoresScraper] No stores collected.")
            return pd.DataFrame()

        df = pd.DataFrame(all_stores)
        logger.info(f"[StoresScraper] Total raw records: {len(df)}")

        # ── Save raw snapshot ─────────────────────────────────────────────────
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        raw_path = RAW_DATA_DIR / f"ja_stores_raw_{ts}.csv"
        df.to_csv(raw_path, index=False)
        logger.info(f"[StoresScraper] Raw snapshot: {raw_path}")

        return self._normalize(df)

    def _normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        """Returns pharmacies-table-ready DataFrame."""
        df = df.copy()
        df["kendra_code"] = df.get("kendra_code", pd.Series(dtype=str)).fillna("").str.strip()
        
        # Deduplicate
        df = df.drop_duplicates(subset=["kendra_code", "address"], keep="first")
        df = df[df["kendra_code"].str.startswith("PMBJK", na=False) | df["name"].notna()]
        logger.info(f"[StoresScraper] After dedup: {len(df)} records")

        # Convert lat/lng to numeric
        df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
        df["lng"] = pd.to_numeric(df["lng"], errors="coerce")
        
        # Drop stores with invalid coordinates (they won't show on map anyway)
        before = len(df)
        df = df.dropna(subset=["lat", "lng"])
        
        # Also drop coords that are 0,0
        df = df[(df["lat"] != 0) & (df["lng"] != 0)]
        
        if before - len(df):
            logger.warning(f"[StoresScraper] Dropped {before - len(df)} stores with missing/invalid coordinates")

        if df.empty:
            return df

        # Map to pharmacies table schema
        result = pd.DataFrame({
            "name": (df.get("kendra_code", "") + " - " + df.get("name", "Jan Aushadhi Kendra").fillna("")).str.strip(" -"),
            "address": df.get("address", pd.Series(dtype=str)).fillna("").str.strip(),
            "district": df.get("district", pd.Series(dtype=str)).fillna("").str.strip(),
            "state": df.get("state", pd.Series(dtype=str)).fillna("").str.strip(),
            "phone_number": df.get("phone", pd.Series(dtype=str)).apply(
                lambda x: str(x)[:20] if pd.notna(x) and str(x).strip() not in ("", "None", "nan", "0") else None
            ),
            "is_verified": True,
            "status": "approved",
            "is_active": True,
            "lat": df["lat"].astype(float),
            "lng": df["lng"].astype(float),
            "source": "janaushadhi_scraper",
        })

        # Apply state filtering if --state was provided
        if self.target_states:
            target_lower = {s.lower() for s in self.target_states}
            result = result[result["state"].str.lower().isin(target_lower)]
            logger.info(f"[StoresScraper] Filtered to target states: {len(result)} records")

        logger.info(f"[StoresScraper] Final records ready for DB: {len(result)}")
        return result


# ── Convenience function ───────────────────────────────────────────────────────

async def scrape_stores(target_states: list[str] | None = None) -> pd.DataFrame:
    """Scrape Jan Aushadhi stores and return a normalized DataFrame."""
    return await JanAushadhiStoreScraper(target_states=target_states).scrape()


if __name__ == "__main__":
    asyncio.run(scrape_stores())
