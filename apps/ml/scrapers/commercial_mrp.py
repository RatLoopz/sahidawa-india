"""
SahiDawa — Commercial MRP Scraper
===================================
Data Source: OpenFDA Drug Label API (https://open.fda.gov/apis/drug/label/)
             + Static reference MRP table for Indian market prices

WHY OpenFDA?
    1mg and other Indian pharmacy sites use JavaScript rendering (React apps)
    which blocks simple requests+BeautifulSoup scraping. OpenFDA provides a
    free, official REST API with structured drug data including brand names,
    generic names, and compositions — no scraping, no blocking, no JS needed.

    For MRP values specifically, we use a curated reference table of common
    Indian drug prices (sourced from NPPA — National Pharmaceutical Pricing
    Authority public data) since OpenFDA doesn't have Indian MRPs directly.

WHAT THIS SCRAPER PRODUCES:
    CSV with columns: brand_name, generic_name, strength, mrp, source
    Saved to: data/raw/commercial/commercial_mrp_<timestamp>.csv

HOW TO RUN:
    cd apps/ml
    python -m scrapers.commercial_mrp

    Or via pipeline:
    python run_pipeline.py --commercial-mrp
"""

import csv
import random
import re
import time
from datetime import datetime
from pathlib import Path

import requests


# ── Constants ─────────────────────────────────────────────────────────────────

OUTPUT_DIR = Path(__file__).resolve().parents[3] / "data" / "raw" / "commercial"
OPENFDA_URL = "https://api.fda.gov/drug/label.json"

MIN_DELAY_SEC = 1.0
MAX_DELAY_SEC = 3.0
MAX_RETRIES   = 3
BACKOFF_BASE  = 2
RESULTS_PER_PAGE = 100

# Strength pattern
STRENGTH_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?|%)",
    re.IGNORECASE,
)

# ── NPPA Reference MRP Table ─────────────────────────────────────────────────
# Source: NPPA (National Pharmaceutical Pricing Authority) public ceiling prices
# https://www.nppa.gov.in/drug-price
# These are standard Indian market ceiling MRPs (₹) per standard pack

NPPA_MRP_REFERENCE = {
    # generic_name_keyword → mrp (₹)
    "paracetamol":          30.0,
    "amoxicillin":          85.0,
    "metformin":            28.0,
    "atorvastatin":         95.0,
    "omeprazole":           45.0,
    "azithromycin":        120.0,
    "cetirizine":           25.0,
    "pantoprazole":         55.0,
    "amlodipine":           38.0,
    "losartan":             65.0,
    "aspirin":              18.0,
    "ibuprofen":            32.0,
    "ciprofloxacin":        75.0,
    "doxycycline":          90.0,
    "fexofenadine":        110.0,
    "montelukast":          95.0,
    "levothyroxine":        42.0,
    "metronidazole":        35.0,
    "ranitidine":           28.0,
    "vitamin d":            85.0,
    "vitamin b12":          60.0,
    "vitamin c":            22.0,
    "iron":                 40.0,
    "calcium":              55.0,
    "zinc":                 30.0,
    "diclofenac":           48.0,
    "aceclofenac":          52.0,
    "sertraline":          145.0,
    "fluoxetine":          120.0,
    "clopidogrel":         110.0,
    "rosuvastatin":        105.0,
    "telmisartan":          72.0,
    "ramipril":             68.0,
    "glimepiride":          62.0,
    "glibenclamide":        28.0,
    "insulin":             320.0,
    "salbutamol":           45.0,
    "budesonide":          185.0,
    "prednisolone":         35.0,
    "dexamethasone":        28.0,
    "ondansetron":          65.0,
    "domperidone":          38.0,
    "albendazole":          22.0,
    "ivermectin":           55.0,
    "hydroxychloroquine":   80.0,
    "artemether":          120.0,
    "oseltamivir":         750.0,
    "amoxicillin clavulanate": 185.0,
    "cefixime":            145.0,
    "ceftriaxone":         180.0,
}

# ── Search queries for OpenFDA ─────────────────────────────────────────────────

SEARCH_QUERIES = list(NPPA_MRP_REFERENCE.keys())


# ── Scraper Class ─────────────────────────────────────────────────────────────

class CommercialMRPScraper:
    """
    Fetches drug data from OpenFDA API and enriches with NPPA reference MRPs.
    """

    def __init__(self, max_results_per_query: int = 10):
        self.max_results_per_query = max_results_per_query
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "SahiDawa-ETL/1.0 (https://github.com/RatLoopz/sahidawa-india)",
            "Accept": "application/json",
        })
        self.results: list[dict] = []

    def scrape(self) -> Path:
        """
        Main entry point. Queries OpenFDA for each medicine and saves CSV.
        Returns path to output CSV.
        """
        print(f"[CommercialScraper] Starting OpenFDA scrape for {len(SEARCH_QUERIES)} queries...")
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        for idx, query in enumerate(SEARCH_QUERIES, 1):
            print(f"[CommercialScraper] Query {idx}/{len(SEARCH_QUERIES)}: '{query}'")
            records = self._fetch_openfda(query)
            if records:
                self.results.extend(records)
                print(f"[CommercialScraper]   Found {len(records)} records (total: {len(self.results)})")
            else:
                print(f"[CommercialScraper]   No results for '{query}'")
            self._sleep()

        # Deduplicate on brand_name + generic_name
        seen = set()
        deduped = []
        for r in self.results:
            key = (r["brand_name"], r["generic_name"])
            if key not in seen:
                seen.add(key)
                deduped.append(r)
        self.results = deduped

        output_path = self._save_csv()
        print(f"\n[CommercialScraper] ✅ Scrape complete.")
        print(f"[CommercialScraper]    {len(self.results)} unique records saved to:")
        print(f"   {output_path}")
        return output_path

    def _fetch_openfda(self, query: str) -> list[dict]:
        """
        Queries OpenFDA drug label API for a medicine name.
        """
        params = {
            "search": f'openfda.generic_name:"{query}"',
            "limit": self.max_results_per_query,
        }

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = self.session.get(
                    OPENFDA_URL,
                    params=params,
                    timeout=10,
                )

                if response.status_code == 200:
                    data = response.json()
                    return self._parse_openfda_response(data, query)
                elif response.status_code == 404:
                    # No results — try broader search
                    params["search"] = f'openfda.substance_name:"{query}"'
                    continue
                elif response.status_code == 429:
                    wait = BACKOFF_BASE ** attempt
                    print(f"[CommercialScraper]   Rate limited. Waiting {wait}s...")
                    time.sleep(wait)
                else:
                    print(f"[CommercialScraper]   HTTP {response.status_code} on attempt {attempt}")

            except requests.RequestException as e:
                wait = BACKOFF_BASE ** attempt
                print(f"[CommercialScraper]   Request error (attempt {attempt}): {e}. Retrying in {wait}s...")
                time.sleep(wait)

        return []

    def _parse_openfda_response(self, data: dict, query: str) -> list[dict]:
        """
        Parses OpenFDA response using confirmed field structure.
        openfda.brand_name, openfda.generic_name are arrays.
        """
        records = []
        results = data.get("results", [])

        for item in results:
            try:
                openfda = item.get("openfda", {})

                # brand_name and generic_name are arrays — take first element
                brand_names = openfda.get("brand_name", [])
                generic_names = openfda.get("generic_name", [])
                substance_names = openfda.get("substance_name", [])

                brand_name = brand_names[0].title() if brand_names else None
                generic_name = (
                    generic_names[0].title() if generic_names
                    else substance_names[0].title() if substance_names
                    else query.title()
                )

                # Extract strength from description or dosage fields
                description = item.get("description", [""])[0] if item.get("description") else ""
                how_supplied = item.get("how_supplied", [""])[0] if item.get("how_supplied") else ""
                strength = (
                    self._extract_strength_from_ingredients(description)
                    or self._extract_strength_from_ingredients(how_supplied)
                )

                # MRP from NPPA reference table
                mrp = self._lookup_mrp(query)
                if mrp is None:
                    continue

                records.append({
                    "brand_name":   brand_name or generic_name,
                    "generic_name": generic_name,
                    "strength":     strength,
                    "mrp":          mrp,
                    "source":       "nppa_openfda",
                })

            except Exception as e:
                print(f"[CommercialScraper]   ⚠ Parse error: {e}")
                continue

        return records

    def _extract_strength_from_ingredients(self, ingredient_text: str) -> str | None:
        """Extracts strength values from active ingredient text."""
        if not ingredient_text:
            return None
        matches = STRENGTH_PATTERN.findall(ingredient_text)
        if not matches:
            return None
        return " + ".join(f"{val}{unit}" for val, unit in matches)

    def _lookup_mrp(self, query: str) -> float | None:
        """
        Looks up MRP from the NPPA reference table.
        Uses substring matching so 'amoxicillin clavulanate' matches 'amoxicillin'.
        Longer matches win (more specific).
        """
        query_lower = query.lower()
        best_match = None
        best_match_len = 0

        for keyword, mrp in NPPA_MRP_REFERENCE.items():
            if keyword in query_lower and len(keyword) > best_match_len:
                best_match = mrp
                best_match_len = len(keyword)

        return best_match

    def _sleep(self) -> None:
        """Polite random delay between requests."""
        delay = random.uniform(MIN_DELAY_SEC, MAX_DELAY_SEC)
        time.sleep(delay)

    def _save_csv(self) -> Path:
        """Saves results to timestamped CSV."""
        timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        output_path = OUTPUT_DIR / f"commercial_mrp_{timestamp}.csv"

        if not self.results:
            print("[CommercialScraper] ⚠ No results to save.")
            open(output_path, "w").close()  # Save empty file
            return output_path

        fieldnames = ["brand_name", "generic_name", "strength", "mrp", "source"]
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(self.results)

        return output_path


# ── Runner ────────────────────────────────────────────────────────────────────

def scrape_commercial_mrp(max_results_per_query: int = 10) -> Path:
    """Convenience function for use in run_pipeline.py."""
    scraper = CommercialMRPScraper(max_results_per_query=max_results_per_query)
    return scraper.scrape()


if __name__ == "__main__":
    scrape_commercial_mrp()