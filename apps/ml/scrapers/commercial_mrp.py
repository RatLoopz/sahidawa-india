"""
SahiDawa — Commercial Pharmacy MRP Scraper
=============================================
Source: 1mg.com (Apollo Pharmacy alternative)

Target: Extract commercial market MRPs for medicines to compare against
        Jan Aushadhi subsidized prices in the Savings Comparison UI.
"""

import asyncio
import random
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright


# ── Constants ──────────────────────────────────────────────────────────────────

SEARCH_URL = "https://www.1mg.com/search?search={query}"
MAX_PAGES = 2
MEDICINES_PER_PAGE = 15
REQUEST_DELAY = 1.5
RAW_DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "raw" / "commercial_mrp"

SAMPLE_MEDICINES = [
    "Paracetamol", "Amoxicillin", "Azithromycin", "Cetirizine", "Metformin",
    "Amlodipine", "Omeprazole", "Pantoprazole", "Atorvastatin", "Metoprolol",
]


class CommercialMRPScraper:
    """Scraper for extracting commercial MRPs from 1mg.com."""

    def __init__(self):
        RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.results: list[dict[str, Any]] = []

    async def scrape(self, medicines: list[str] | None = None) -> Path:
        """Main entry point. Scrapes MRPs for given medicine list."""
        import pandas as pd

        medicines_to_scrape = medicines or SAMPLE_MEDICINES
        print(f"[CommercialMRP] Starting scrape for {len(medicines_to_scrape)} medicines")

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                accept_downloads=True,
                user_agent=(
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
            )
            page = await context.new_page()

            for idx, medicine in enumerate(medicines_to_scrape):
                print(f"[CommercialMRP] [{idx + 1}/{len(medicines_to_scrape)}] Searching: {medicine}")
                try:
                    await self._search_medicine(page, medicine)
                except Exception as e:
                    print(f"[CommercialMRP] ⚠️ Failed: {e}")
                if idx < len(medicines_to_scrape) - 1:
                    await asyncio.sleep(REQUEST_DELAY + random.uniform(0, 0.5))
            await browser.close()

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        save_path = RAW_DATA_DIR / f"commercial_mrp_raw_{timestamp}.csv"
        pd.DataFrame(self.results).to_csv(save_path, index=False)
        print(f"[CommercialMRP] ✅ Saved {len(self.results)} to: {save_path}")
        return save_path

    async def _search_medicine(self, page, medicine: str) -> None:
        query = medicine.replace(" ", "+")
        url = SEARCH_URL.format(query=query)
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            await page.wait_for_timeout(2000)
            products = await page.locator(".style__product-box, .product-card, [data-testid='product-card']").all()
            print(f"[CommercialMRP] Found {len(products)} for '{medicine}'")
            for product in products[:MEDICINES_PER_PAGE]:
                try:
                    result = await self._extract_product_info(product, medicine)
                    if result:
                        self.results.append(result)
                except:
                    continue
        except Exception as e:
            print(f"[CommercialMRP] ⚠️ Error: {e}")

    async def _extract_product_info(self, product, search_term: str) -> dict | None:
        try:
            brand = None
            for sel in [".style__product-title", ".product-title", "[data-testid='product-title']"]:
                try:
                    if await product.locator(sel).count() > 0:
                        brand = await product.locator(sel).first.inner_text()
                        break
                except:
                    continue
            if not brand:
                return None

            mrp = None
            for sel in [".style__price-tag", ".price-tag", "[data-testid='price']"]:
                try:
                    if await product.locator(sel).count() > 0:
                        mrp_text = await product.locator(sel).first.inner_text()
                        mrp = self._parse_mrp(mrp_text)
                        break
                except:
                    continue

            composition = None
            for sel in [".style__composition", ".product-composition"]:
                try:
                    if await product.locator(sel).count() > 0:
                        composition = await product.locator(sel).first.inner_text()
                        break
                except:
                    continue

            strength = self._extract_strength(composition or brand)

            return {
                "search_term": search_term,
                "brand_name": brand.strip() if brand else None,
                "generic_name": search_term,
                "composition": composition.strip() if composition else None,
                "strength": strength,
                "mrp": mrp,
                "source": "1mg",
                "scraped_at": datetime.now().isoformat(),
            }
        except:
            return None

    def _parse_mrp(self, mrp_text: str) -> float | None:
        if not mrp_text:
            return None
        cleaned = re.sub(r"[₹Rs.\s,]", "", mrp_text.strip())
        match = re.search(r"[\d.]+", cleaned)
        if match:
            try:
                return float(match.group())
            except ValueError:
                return None
        return None

    def _extract_strength(self, text: str | None) -> str | None:
        if not text:
            return None
        pattern = re.compile(r"(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|%)", re.IGNORECASE)
        matches = pattern.findall(text)
        if not matches:
            return None
        return " + ".join(f"{val}{unit}" for val, unit in matches)


async def main():
    scraper = CommercialMRPScraper()
    csv_path = await scraper.scrape()
    print(f"\n[CommercialMRP] Raw data: {csv_path}")
    return csv_path


if __name__ == "__main__":
    asyncio.run(main())