"""
SahiDawa — Jan Aushadhi Scraper + Normalizer
=============================================
Migrated from: apps/ml/scrapers/janaushadhi.py
              apps/ml/etl/normalizer.py

WHY PLAYWRIGHT (not BeautifulSoup):
    Jan Aushadhi's website is a React app. The server sends a blank HTML page,
    and JavaScript runs in the browser to fetch and render the medicine table.
    Playwright opens a real browser, waits for JS to run, then downloads the CSV
    that the site generates in-memory.

PIPELINE ROLE:
    scrape() → raw CSV path
    normalize(raw_csv_path) → clean pd.DataFrame ready for the loader
"""

import asyncio
import re
from datetime import datetime
from pathlib import Path

import pandas as pd
from playwright.async_api import Download, async_playwright

from src.utils.logger import logger


# ── Constants ──────────────────────────────────────────────────────────────────

TARGET_URL = "https://janaushadhi.gov.in/productportfolio/ProductmrpList"
RAW_DATA_DIR = Path(__file__).resolve().parents[4] / "data" / "raw" / "janaushadhi"
PROCESSED_DIR = Path(__file__).resolve().parents[4] / "data" / "processed"


# ── Category → Schedule Mapping ───────────────────────────────────────────────

CATEGORY_SCHEDULE_MAP = {
    "analgesic": "H",
    "antipyretic": "H",
    "antibiotic": "H",
    "anti-infective": "H",
    "antihypertensive": "H",
    "antidiabetic": "H",
    "cardiovascular": "H",
    "gastro": "H",
    "respiratory": "H",
    "neurological": "H",
    "central nervous": "H",
    "hormonal": "H",
    "endocrine": "H",
    "renal": "H",
    "hepatic": "H",
    "ophthalmic": "H",
    "ent": "H",
    "dental": "H",
    "oncology": "H",
    "immunosuppressant": "H",
    "antipsychotic": "H1",
    "antidepressant": "H1",
    "anxiolytic": "H1",
    "sedative": "H1",
    "vitamin": "OTC",
    "mineral": "OTC",
    "supplement": "OTC",
    "antacid": "OTC",
    "laxative": "OTC",
    "surgical": "OTC",
    "diagnostic": "OTC",
    "medical device": "OTC",
}

UNIT_SIZE_FORM_MAP = [
    (r"\d+'s", "Tablet"),
    (r"\d+\s*ml", "Liquid"),
    (r"\d+\s*mg", "Tablet"),
    (r"1\s*unit", "Injectable"),
    (r"tube", "Ointment"),
    (r"drop", "Eye Drop"),
    (r"inhaler", "Inhaler"),
    (r"patch", "Patch"),
    (r"sachet", "Sachet"),
    (r"strip", "Tablet"),
    (r"capsule", "Capsule"),
]

STRENGTH_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?|%)",
    re.IGNORECASE,
)

COLUMN_RENAMES = {
    "sr no": "row_num",
    "sr.no": "row_num",
    "sr_no": "row_num",
    "drug code": "drug_code",
    "drug_code": "drug_code",
    "generic name": "raw_name",
    "generic_name": "raw_name",
    "unit size": "unit_size",
    "unit_size": "unit_size",
    "mrp": "mrp",
    "mrp_(rs.)": "mrp",
    "group name": "group_name",
    "group_name": "group_name",
}

FORM_WORDS = [
    r"\btablets?\b", r"\bcapsules?\b", r"\bsyrup\b", r"\binjection\b",
    r"\binfusion\b", r"\bointment\b", r"\bcream\b", r"\bdrops?\b",
    r"\binhaler\b", r"\bpatch\b", r"\bsolution\b", r"\bsuspension\b",
    r"\bpowder\b", r"\bsachet\b", r"\bip\b", r"\bbp\b", r"\busp\b",
    r"\bgel\b", r"\blotion\b", r"\bspray\b", r"\bpaste\b",
]


# ── Scraper ────────────────────────────────────────────────────────────────────

class JanAushadhiScraper:
    """
    Headless browser scraper for the Jan Aushadhi product list.
    Uses Playwright to load the JS-rendered React app and download the CSV.
    """

    def __init__(self):
        RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)

    async def scrape(self) -> Path:
        """
        Returns the Path to the downloaded raw CSV file.

        Raises:
            TimeoutError: If the page doesn't load or CSV button isn't found.
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                context = await browser.new_context(
                    accept_downloads=True,
                    user_agent=(
                        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    ),
                )
                page = await context.new_page()

                logger.info(f"[JanAushadhi] Navigating to: {TARGET_URL}")
                await page.goto(TARGET_URL, wait_until="domcontentloaded", timeout=60_000)

                logger.info("[JanAushadhi] Waiting for medicine table...")
                try:
                    await page.wait_for_selector(".rdt_TableRow", timeout=45_000)
                except Exception:
                    await page.wait_for_selector("[role='row']", timeout=15_000)

                row_count = await page.locator(".rdt_TableRow").count()
                logger.info(f"[JanAushadhi] Visible rows: {row_count} (total ~2439 in memory)")

                # Wait for React to hydrate full dataset before exporting
                await page.wait_for_timeout(5000)

                async with page.expect_download(timeout=30_000) as download_info:
                    await page.get_by_text("Download Files").click()
                    await page.get_by_text("Download CSV").click()

                download: Download = await download_info.value

                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                save_path = RAW_DATA_DIR / f"janaushadhi_raw_{timestamp}.csv"
                await download.save_as(save_path)

                logger.info(f"[JanAushadhi] CSV saved: {save_path} ({save_path.stat().st_size / 1024:.1f} KB)")
                return save_path
            finally:
                await browser.close()


# ── Normalizer ─────────────────────────────────────────────────────────────────

class JanAushadhiNormalizer:
    """
    Transforms raw Jan Aushadhi CSV into a clean DataFrame matching
    the SahiDawa medicines table schema.
    """

    def normalize(self, raw_csv_path: Path) -> pd.DataFrame:
        logger.info(f"[Normalizer] Reading: {raw_csv_path}")
        df = pd.read_csv(raw_csv_path, encoding="utf-8-sig")
        logger.info(f"[Normalizer] Loaded {len(df)} raw records. Columns: {list(df.columns)}")

        if len(df) == 0:
            logger.warning("[Normalizer] Raw CSV is empty — skipping normalization.")
            return df

        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        df = df.rename(columns={k: v for k, v in COLUMN_RENAMES.items() if k in df.columns})

        before = len(df)
        df = df.dropna(subset=["raw_name"])
        df["raw_name"] = df["raw_name"].str.strip()
        df = df[df["raw_name"] != ""]
        logger.info(f"[Normalizer] Dropped {before - len(df)} rows with empty names")

        df["strength"] = df["raw_name"].apply(self._extract_strength)
        df["generic_name"] = df["raw_name"].apply(self._clean_generic_name)

        unit_col = "unit_size" if "unit_size" in df.columns else None
        df["dosage_form"] = df[unit_col].apply(self._infer_dosage_form) if unit_col else None
        df["dosage_form"] = df.apply(
            lambda row: self._infer_form_from_name(row["raw_name"]) or row.get("dosage_form"),
            axis=1,
        )

        df["schedule"] = (
            df["group_name"].apply(self._infer_schedule)
            if "group_name" in df.columns
            else "H"
        )

        df["brand_name"] = None
        df["manufacturer"] = "PMBI"
        df["cdsco_approval_status"] = "approved"
        df["is_counterfeit_alert"] = False
        df["source"] = "janaushadhi"
        df["barcode_id"] = None

        output_cols = [
            "brand_name", "generic_name", "manufacturer", "strength",
            "dosage_form", "schedule", "cdsco_approval_status",
            "is_counterfeit_alert", "source", "barcode_id",
        ]
        result = df[output_cols].copy()

        before = len(result)
        result = result.drop_duplicates(subset=["generic_name", "strength", "dosage_form"])
        logger.info(f"[Normalizer] Removed {before - len(result)} duplicates. Final: {len(result)} records")

        return result

    def _extract_strength(self, name: str) -> str | None:
        matches = STRENGTH_PATTERN.findall(name)
        return " + ".join(f"{val}{unit}" for val, unit in matches) if matches else None

    def _clean_generic_name(self, name: str) -> str:
        cleaned = STRENGTH_PATTERN.sub("", name)
        for word in FORM_WORDS:
            cleaned = re.sub(word, "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,+&")
        return cleaned or name

    def _infer_dosage_form(self, unit_size: str) -> str | None:
        if pd.isna(unit_size):
            return None
        unit_lower = str(unit_size).lower().strip()
        for pattern, form in UNIT_SIZE_FORM_MAP:
            if re.search(pattern, unit_lower, re.IGNORECASE):
                return form
        return None

    def _infer_form_from_name(self, name: str) -> str | None:
        name_lower = name.lower()
        if "tablet" in name_lower:     return "Tablet"
        if "capsule" in name_lower:    return "Capsule"
        if "syrup" in name_lower:      return "Liquid"
        if "injection" in name_lower:  return "Injectable"
        if "drop" in name_lower:       return "Eye Drop"
        if "ointment" in name_lower:   return "Ointment"
        if "cream" in name_lower:      return "Cream"
        if "gel" in name_lower:        return "Gel"
        if "inhaler" in name_lower:    return "Inhaler"
        if "suspension" in name_lower: return "Liquid"
        if "solution" in name_lower:   return "Liquid"
        return None

    def _infer_schedule(self, category: str) -> str:
        if pd.isna(category):
            return "H"
        cat_lower = category.lower()
        for keyword, schedule in CATEGORY_SCHEDULE_MAP.items():
            if keyword in cat_lower:
                return schedule
        return "H"


# ── Convenience runner ─────────────────────────────────────────────────────────

async def scrape_and_normalize() -> pd.DataFrame:
    """Scrape Jan Aushadhi and return a normalized DataFrame."""
    scraper = JanAushadhiScraper()
    raw_path = await scraper.scrape()
    return JanAushadhiNormalizer().normalize(raw_path)


if __name__ == "__main__":
    asyncio.run(scrape_and_normalize())
