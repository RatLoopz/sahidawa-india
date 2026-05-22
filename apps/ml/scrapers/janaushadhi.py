"""
SahiDawa — Jan Aushadhi Scraper
================================
Source: https://janaushadhi.gov.in/productportfolio/ProductmrpList

WHY PLAYWRIGHT (not BeautifulSoup):
    Jan Aushadhi's website is a React app. The server sends a blank HTML page,
    and JavaScript runs in the browser to fetch and render the medicine table.
    BeautifulSoup only reads HTML — it cannot execute JavaScript.
    Playwright opens a real browser, waits for JS to run, then downloads the CSV
    that the site generates in-memory.

WHAT THIS SCRAPER DOES:
    1. Opens a headless (invisible) Chrome browser via Playwright
    2. Navigates to the Jan Aushadhi product list page
    3. Waits for the medicine table to fully load (2,439 records)
    4. Clicks the "Download CSV" button and intercepts the file download
    5. Saves the raw CSV to data/raw/janaushadhi/
    6. Returns the path to the raw file for the normalizer to process

HOW TO RUN:
    cd apps/ml
    python -m scrapers.janaushadhi

PREREQUISITE (one-time setup):
    pip install playwright
    playwright install chromium
"""

import asyncio
import os
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright, Download


# ── Constants ──────────────────────────────────────────────────────────────────

# URL of the Jan Aushadhi product list page
TARGET_URL = "https://janaushadhi.gov.in/productportfolio/ProductmrpList"

# Where to save the raw downloaded CSV
# Path is relative to the repo root, not this file.
RAW_DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "raw" / "janaushadhi"


# ── Main Scraper Class ─────────────────────────────────────────────────────────

class JanAushadhiScraper:
    """
    Headless browser scraper for the Jan Aushadhi product list.
    
    Uses Playwright to:
    - Load the JavaScript-rendered React app
    - Wait for all 2,400+ medicines to appear in the table
    - Click "Download CSV" and capture the generated file
    """

    def __init__(self):
        # Ensure the output directory exists before scraping
        RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)

    async def scrape(self) -> Path:
        """
        Main entry point. Returns the Path to the downloaded CSV file.
        
        Returns:
            Path: Absolute path to the saved raw CSV file
        
        Raises:
            TimeoutError: If the page doesn't load or CSV button isn't found
        """
        
        async with async_playwright() as p:
            # Launch headless Chromium browser
            # headless=True means no visible browser window — runs in background
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                # Accept CSV downloads
                accept_downloads=True,
                # Set a realistic browser user agent to avoid bot detection
                user_agent=(
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
            )
            page = await context.new_page()

            print(f"[JanAushadhi] Navigating to: {TARGET_URL}")
            # CHANGED: 'domcontentloaded' is much more reliable here than 'networkidle'.
            # The Jan Aushadhi website loads external maps and translation scripts (like Bhashini)
            # that continuously poll/stream data. 'networkidle' waits until there are no requests
            # for 500ms, which NEVER happens because of these scripts, causing a 60s timeout.
            await page.goto(TARGET_URL, wait_until="domcontentloaded", timeout=60_000)

            print("[JanAushadhi] Page loaded. Waiting for medicine table...")
            # FIX: Jan Aushadhi uses 'react-data-table-component' — NOT a standard <table>.
            # The rendered rows have class 'rdt_TableRow' (React Data Table Row).
            # Standard 'table tbody tr' selector DOES NOT WORK here.
            try:
                await page.wait_for_selector(".rdt_TableRow", timeout=45_000)
            except Exception:
                # Fallback: try role="row" attribute which react-data-table also sets
                await page.wait_for_selector("[role='row']", timeout=15_000)

            print("[JanAushadhi] Table rows detected. Counting loaded records...")
            row_count = await page.locator(".rdt_TableRow").count()
            print(f"[JanAushadhi] Visible rows: {row_count} (total ~2439 in memory)")

            print("[JanAushadhi] Waiting 5 seconds for React to hydrate full data...")
            # We must wait for the background API to finish populating the table's state.
            # Otherwise, the CSV export clicks too early and downloads an empty file (only headers).
            await page.wait_for_timeout(5000)

            print("[JanAushadhi] Clicking 'Download Files' → 'Download CSV'...")

            # Set up download event BEFORE clicking the button.
            # Playwright needs to "listen" for the download event before it's triggered.
            # If we click first and then listen, we might miss the event.
            async with page.expect_download(timeout=30_000) as download_info:
                # Then click "Download CSV" from the dropdown menu
                await page.get_by_text("Download Files").click()
                await page.get_by_text("Download CSV").click()

            download: Download = await download_info.value

            # Build a timestamped filename so we can track when data was scraped
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            save_path = RAW_DATA_DIR / f"janaushadhi_raw_{timestamp}.csv"

            # Save the downloaded file to our data directory
            await download.save_as(save_path)
            print(f"[JanAushadhi] ✅ CSV saved to: {save_path}")
            print(f"[JanAushadhi] File size: {save_path.stat().st_size / 1024:.1f} KB")

            await browser.close()
            return save_path


# ── Runner ─────────────────────────────────────────────────────────────────────

async def main():
    scraper = JanAushadhiScraper()
    csv_path = await scraper.scrape()
    print(f"\n[JanAushadhi] Raw data ready at: {csv_path}")
    print("[JanAushadhi] Next step: run the normalizer on this file.")
    return csv_path


if __name__ == "__main__":
    # asyncio.run() is the standard way to run async Python code
    # Playwright's API is async — it uses Python's async/await system
    asyncio.run(main())
