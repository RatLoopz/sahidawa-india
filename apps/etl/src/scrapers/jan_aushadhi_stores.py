"""
SahiDawa — Jan Aushadhi Store Locator Scraper
=============================================
Scrapes all PMBJK (Pradhan Mantri Bhartiya Jan Aushadhi Kendra) store
locations from janaushadhi.gov.in for bulk import into the pharmacies table.

STRATEGY:
    The official site is a React SPA with no public REST API.
    We use Playwright to:
      1. Navigate to the store locator page
      2. Iterate every State → District dropdown combination
      3. Extract store cards (name, address, phone, pincode, store ID)
      4. Geocode missing GPS coordinates via Nominatim (OpenStreetMap)

OUTPUT:
    A pandas DataFrame with columns matching the pharmacies table schema,
    ready for upsert via SupabaseLoader.

USAGE:
    python run_stores.py                         # all India
    python run_stores.py --state "Assam"         # one state
    python run_stores.py --dry-run               # scrape but don't load

NOTE:
    Be respectful of rate limits. The scraper adds polite delays between
    requests. Nominatim usage follows their ToS (max 1 req/sec).
"""

import asyncio
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
import requests
from playwright.async_api import async_playwright, TimeoutError as PWTimeoutError

from src.utils.logger import logger

# ── Constants ──────────────────────────────────────────────────────────────────

STORE_LOCATOR_URL = "https://janaushadhi.gov.in/storelocator.aspx"
RAW_DATA_DIR = Path(__file__).resolve().parents[4] / "data" / "raw" / "ja_stores"
PROCESSED_DIR = Path(__file__).resolve().parents[4] / "data" / "processed"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_DELAY_SEC = 1.1   # respect 1 req/sec ToS
PAGE_LOAD_TIMEOUT_MS = 60_000
ELEMENT_TIMEOUT_MS = 30_000

# All 36 Indian states/UTs — used to drive the state dropdown
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


# ── Geocoder ───────────────────────────────────────────────────────────────────

class NominatimGeocoder:
    """
    Geocodes an address string to (lat, lng) using OpenStreetMap Nominatim.
    Respects the 1 req/sec rate limit and caches results in memory.
    """

    def __init__(self):
        self._cache: dict[str, tuple[float, float] | None] = {}
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": "SahiDawa/1.0 (sahidawa.app; contact@sahidawa.app)",
            "Accept-Language": "en",
        })

    def geocode(self, address: str, city: str = "", state: str = "") -> tuple[float, float] | None:
        """Return (lat, lng) or None if geocoding fails."""
        # Build a progressively simpler query if full address fails
        queries = []
        if address:
            queries.append(f"{address}, India")
        if city and state:
            queries.append(f"{city}, {state}, India")
        if state:
            queries.append(f"{state}, India")

        for query in queries:
            cached = self._cache.get(query)
            if cached is not None:
                return cached
            result = self._fetch(query)
            self._cache[query] = result
            time.sleep(NOMINATIM_DELAY_SEC)
            if result:
                return result
        return None

    def _fetch(self, query: str) -> tuple[float, float] | None:
        try:
            resp = self._session.get(
                NOMINATIM_URL,
                params={"q": query, "countrycodes": "in", "format": "json", "limit": 1},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
        except Exception as e:
            logger.warning(f"[Geocoder] Failed for '{query}': {e}")
        return None


# ── Scraper ────────────────────────────────────────────────────────────────────

class JanAushadhiStoreScraper:
    """
    Headless browser scraper for the Jan Aushadhi store locator.

    Iterates each State → District → fetches store list → collects raw records.
    Falls back to geocoding addresses where GPS is not embedded in the page.
    """

    def __init__(self, target_states: list[str] | None = None):
        RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.target_states = target_states or ALL_INDIA_STATES
        self.geocoder = NominatimGeocoder()

    async def scrape(self) -> pd.DataFrame:
        """
        Returns a DataFrame of all scraped stores.
        Each row matches the pharmacies table schema.
        """
        all_stores: list[dict] = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
            )
            page = await context.new_page()

            logger.info(f"[StoresScraper] Loading: {STORE_LOCATOR_URL}")
            await page.goto(STORE_LOCATOR_URL, wait_until="networkidle", timeout=PAGE_LOAD_TIMEOUT_MS)

            # ── Collect all available states from dropdown ──────────────────────
            try:
                state_options = await page.locator("select[name*='state'], select[id*='state'], select[id*='State']").first.locator("option").all()
                available_states = [
                    (await opt.get_attribute("value"), (await opt.inner_text()).strip())
                    for opt in state_options
                    if (await opt.get_attribute("value") or "").strip() not in ("", "0", "select")
                ]
                logger.info(f"[StoresScraper] Found {len(available_states)} states in dropdown")
            except Exception as e:
                logger.warning(f"[StoresScraper] Could not read state dropdown: {e}. Using ALL_INDIA_STATES list.")
                available_states = [(s, s) for s in self.target_states]

            # ── Filter to target states ─────────────────────────────────────────
            if self.target_states != ALL_INDIA_STATES:
                target_lower = {s.lower() for s in self.target_states}
                available_states = [
                    (val, name) for val, name in available_states
                    if name.lower() in target_lower
                ]
                logger.info(f"[StoresScraper] Filtered to {len(available_states)} target state(s)")

            # ── Iterate states ──────────────────────────────────────────────────
            for state_val, state_name in available_states:
                logger.info(f"[StoresScraper] Processing state: {state_name}")
                state_stores = await self._scrape_state(page, state_val, state_name)
                all_stores.extend(state_stores)
                logger.info(f"[StoresScraper] {state_name}: {len(state_stores)} stores found (total: {len(all_stores)})")

            await browser.close()

        if not all_stores:
            logger.warning("[StoresScraper] No stores scraped — check page structure")
            return pd.DataFrame()

        df = pd.DataFrame(all_stores)

        # ── Save raw snapshot ───────────────────────────────────────────────────
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        raw_path = RAW_DATA_DIR / f"ja_stores_raw_{ts}.csv"
        df.to_csv(raw_path, index=False)
        logger.info(f"[StoresScraper] Raw snapshot saved: {raw_path} ({len(df)} rows)")

        return self._normalize(df)

    async def _scrape_state(self, page, state_val: str, state_name: str) -> list[dict]:
        """Select a state and iterate all its districts, collecting stores."""
        stores: list[dict] = []
        try:
            # Select state
            state_sel = page.locator("select[name*='state'], select[id*='state'], select[id*='State']").first
            await state_sel.select_option(value=state_val)
            await page.wait_for_timeout(1500)

            # Collect districts
            district_options = await page.locator(
                "select[name*='district'], select[id*='district'], select[id*='District']"
            ).first.locator("option").all()

            districts = [
                (await opt.get_attribute("value"), (await opt.inner_text()).strip())
                for opt in district_options
                if (await opt.get_attribute("value") or "").strip() not in ("", "0", "select")
            ]

            if not districts:
                # Try getting all stores for this state without district filter
                stores.extend(await self._fetch_stores_from_page(page, state_name, ""))
                return stores

            for dist_val, dist_name in districts:
                try:
                    dist_sel = page.locator(
                        "select[name*='district'], select[id*='district'], select[id*='District']"
                    ).first
                    await dist_sel.select_option(value=dist_val)
                    await page.wait_for_timeout(1000)

                    # Click search/submit button
                    try:
                        await page.locator(
                            "button[type='submit'], input[type='submit'], button:has-text('Search'), button:has-text('Find')"
                        ).first.click(timeout=3000)
                        await page.wait_for_timeout(2000)
                    except Exception:
                        pass  # Some pages auto-search on dropdown change

                    district_stores = await self._fetch_stores_from_page(page, state_name, dist_name)
                    stores.extend(district_stores)
                    logger.info(f"[StoresScraper]   {state_name} / {dist_name}: {len(district_stores)} stores")
                    await page.wait_for_timeout(500)

                except Exception as e:
                    logger.warning(f"[StoresScraper]   Failed district {dist_name}: {e}")
                    continue

        except Exception as e:
            logger.warning(f"[StoresScraper] Failed state {state_name}: {e}")

        return stores

    async def _fetch_stores_from_page(self, page, state_name: str, district_name: str) -> list[dict]:
        """Extract store data from the current results page."""
        stores: list[dict] = []
        try:
            # Wait for results container
            await page.wait_for_selector(
                ".store-card, .kendra-card, .store-list, [class*='store'], [class*='kendra'], table tbody tr",
                timeout=5000,
            )
        except PWTimeoutError:
            return []

        # Try card-based layout first
        cards = await page.locator(".store-card, .kendra-card, [class*='store-item'], [class*='kendra-item']").all()
        if cards:
            for card in cards:
                store = await self._extract_from_card(card, state_name, district_name)
                if store:
                    stores.append(store)
            return stores

        # Fall back to table-based layout
        rows = await page.locator("table tbody tr").all()
        for row in rows:
            store = await self._extract_from_table_row(row, state_name, district_name)
            if store:
                stores.append(store)

        return stores

    async def _extract_from_card(self, card, state_name: str, district_name: str) -> dict | None:
        """Extract store info from a card element."""
        try:
            text = await card.inner_text()
            return self._parse_store_text(text, state_name, district_name)
        except Exception:
            return None

    async def _extract_from_table_row(self, row, state_name: str, district_name: str) -> dict | None:
        """Extract store info from a table row."""
        try:
            cells = await row.locator("td").all()
            if len(cells) < 3:
                return None
            cell_texts = [(await c.inner_text()).strip() for c in cells]
            # Typical columns: Sr No | Store ID | Store Name | Address | District | State | Phone
            if len(cell_texts) >= 4:
                return {
                    "store_id": cell_texts[1] if len(cell_texts) > 1 else None,
                    "name": cell_texts[2] if len(cell_texts) > 2 else cell_texts[1],
                    "address": cell_texts[3] if len(cell_texts) > 3 else "",
                    "district": cell_texts[4] if len(cell_texts) > 4 else district_name,
                    "state": cell_texts[5] if len(cell_texts) > 5 else state_name,
                    "phone": cell_texts[6] if len(cell_texts) > 6 else None,
                    "pincode": self._extract_pincode(cell_texts[3] if len(cell_texts) > 3 else ""),
                    "lat": None,
                    "lng": None,
                }
        except Exception:
            return None

    def _parse_store_text(self, text: str, state_name: str, district_name: str) -> dict | None:
        """Parse raw text block from a store card."""
        lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
        if not lines:
            return None

        # Try to extract store ID (PMBJK format)
        store_id = None
        id_match = re.search(r"PMBJK\d+", text, re.IGNORECASE)
        if id_match:
            store_id = id_match.group(0).upper()

        # Phone extraction
        phone_match = re.search(r"(?:Phone|Ph|Tel|Mobile|Mob)[:\s]*([6-9]\d{9})", text, re.IGNORECASE)
        if not phone_match:
            phone_match = re.search(r"\b([6-9]\d{9})\b", text)
        phone = phone_match.group(1) if phone_match else None

        pincode = self._extract_pincode(text)

        # Name is usually the first non-ID line
        name = lines[0] if lines else "Jan Aushadhi Kendra"
        if store_id and store_id.upper() in name.upper():
            name = lines[1] if len(lines) > 1 else name

        return {
            "store_id": store_id,
            "name": name,
            "address": " ".join(lines[1:4]) if len(lines) > 1 else "",
            "district": district_name or state_name,
            "state": state_name,
            "phone": phone,
            "pincode": pincode,
            "lat": None,
            "lng": None,
        }

    @staticmethod
    def _extract_pincode(text: str) -> str | None:
        m = re.search(r"\b(\d{6})\b", text)
        return m.group(1) if m else None

    def _normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Geocode missing coordinates and prepare the DataFrame for Supabase upsert.
        Returns rows with schema matching the pharmacies table.
        """
        logger.info(f"[StoresScraper] Geocoding {(df['lat'].isna()).sum()} stores without coordinates...")

        def geocode_row(row):
            if pd.notna(row.get("lat")) and pd.notna(row.get("lng")):
                return row
            addr_parts = [row.get("address", ""), row.get("pincode", ""), row.get("district", ""), row.get("state", "")]
            query = ", ".join(p for p in addr_parts if p)
            result = self.geocoder.geocode(query, city=str(row.get("district", "")), state=str(row.get("state", "")))
            if result:
                row["lat"], row["lng"] = result
            return row

        df = df.apply(geocode_row, axis=1)

        # Drop rows with no coordinates — can't place on map
        before = len(df)
        df = df.dropna(subset=["lat", "lng"])
        if before - len(df) > 0:
            logger.warning(f"[StoresScraper] Dropped {before - len(df)} rows with no geocodeable address")

        # Deduplicate by store_id; if no store_id, by (name, address)
        df["store_id"] = df["store_id"].fillna("")
        df = df.drop_duplicates(subset=["store_id", "name", "address"], keep="first")

        # Map to pharmacies table schema
        result = pd.DataFrame({
            "name": df["name"].str.strip().fillna("Jan Aushadhi Kendra"),
            "address": df["address"].str.strip().fillna(""),
            "district": df["district"].str.strip().fillna(""),
            "state": df["state"].str.strip().fillna(""),
            "phone_number": df["phone"].apply(lambda x: str(x)[:20] if pd.notna(x) else None),
            "is_verified": True,          # All PMBJK stores are government-verified
            "status": "approved",
            "is_active": True,
            "lat": df["lat"].astype(float),
            "lng": df["lng"].astype(float),
            # Extra metadata stored in address for display
            "source": "janaushadhi_scraper",
        })

        logger.info(f"[StoresScraper] Final normalized records: {len(result)}")
        return result


# ── Convenience runner ─────────────────────────────────────────────────────────

async def scrape_stores(target_states: list[str] | None = None) -> pd.DataFrame:
    """Scrape Jan Aushadhi stores and return a normalized DataFrame."""
    return await JanAushadhiStoreScraper(target_states=target_states).scrape()


if __name__ == "__main__":
    asyncio.run(scrape_stores())
