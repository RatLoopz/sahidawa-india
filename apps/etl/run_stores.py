"""
SahiDawa — Jan Aushadhi Store ETL Runner
=========================================
Scrapes PMBJK (Jan Aushadhi Kendra) store locations from the official
government website and upserts them into our Supabase pharmacies table.

HOW THIS WORKS:
    1. Playwright opens the Jan Aushadhi store locator website
    2. Iterates every State → District dropdown combination
    3. Extracts store name, address, phone, pincode for each store
    4. Geocodes missing GPS coordinates via Nominatim (OSM)
    5. Upserts into Supabase `pharmacies` table with status='approved'

WHY:
    The Jan Aushadhi website has no public REST API. The government has
    ~14,000+ stores across India but doesn't provide bulk data downloads.
    This ETL is the only way to get real, all-India store data into our DB.

USAGE:
    cd apps/etl
    pip install -e .
    playwright install chromium

    # All India (takes ~30-60 min for 36 states)
    python run_stores.py

    # Single state (fast, good for testing)
    python run_stores.py --state "Assam"
    python run_stores.py --state "Delhi"
    python run_stores.py --state "Maharashtra"

    # Multiple states
    python run_stores.py --state "Assam" --state "West Bengal"

    # Preview without DB write
    python run_stores.py --state "Delhi" --dry-run

    # Retry previously failed rows
    python run_stores.py --retry-failed

SCHEDULE:
    Run weekly via GitHub Actions / cron to keep store data fresh.
    New stores are added; closed stores can be soft-deleted manually.
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Allow running as `python run_stores.py` from apps/etl/
sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.scrapers.jan_aushadhi_stores import JanAushadhiStoreScraper, ALL_INDIA_STATES
from src.loaders.supabase_loader import SupabaseLoader
from src.utils.logger import logger


PIPELINE_NAME = "janaushadhi_stores"


def _banner(title: str) -> None:
    line = "=" * 60
    logger.info(f"\n{line}\n  {title}\n{line}")


def _summary(stats: dict) -> None:
    logger.info(
        f"\n{'─' * 60}\n"
        f"  Stores imported:  {stats.get('inserted', 0)}\n"
        f"  Skipped (no change): {stats.get('skipped_unchanged', 0)}\n"
        f"  Failed:          {stats.get('failed', 0)}\n"
        f"  Success rate:    {stats.get('success_rate', 0)}%\n"
        f"{'─' * 60}"
    )


async def run(
    target_states: list[str] | None = None,
    dry_run: bool = False,
    retry_failed: bool = False,
) -> dict | None:
    _banner("SahiDawa — Jan Aushadhi Store ETL")

    loader = SupabaseLoader(pipeline_name=PIPELINE_NAME)

    # ── RETRY MODE ─────────────────────────────────────────────────────────────
    if retry_failed:
        logger.info("RETRY MODE — reprocessing previously failed store rows")
        stats = loader.retry_failed_rows(table="pharmacies")
        _summary(stats)
        return stats

    # ── SCRAPE ─────────────────────────────────────────────────────────────────
    state_label = ", ".join(target_states) if target_states else "All India"
    logger.info(f"STEP 1 — Scraping Jan Aushadhi stores for: {state_label}")

    scraper = JanAushadhiStoreScraper(target_states=target_states)
    df = await scraper.scrape()

    if df.empty:
        logger.error("No stores scraped. Check if the website structure has changed.")
        return None

    logger.info(f"STEP 1 complete — scraped {len(df)} stores")

    # ── DRY RUN ────────────────────────────────────────────────────────────────
    if dry_run:
        logger.info("DRY RUN mode — skipping database write")
        logger.info(f"Would have loaded {len(df)} records into 'pharmacies' table")
        logger.info(f"Sample records:\n{df.head(5).to_string()}")
        return {"total": len(df), "dry_run": True}

    # ── LOAD ───────────────────────────────────────────────────────────────────
    logger.info(f"STEP 2 — Upserting {len(df)} stores into Supabase pharmacies table...")
    stats = loader.load(df, table="pharmacies")
    _summary(stats)

    # ── GEOCODING REPORT ───────────────────────────────────────────────────────
    if "lat" in df.columns:
        geo_count = df["lat"].notna().sum()
        logger.info(f"  Geocoded coordinates: {geo_count}/{len(df)} stores ({geo_count/len(df)*100:.1f}%)")

    return stats


def main():
    parser = argparse.ArgumentParser(
        description="SahiDawa Jan Aushadhi Store ETL — imports real PMBJK store locations into the DB",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_stores.py                         # All India (~30-60 min)
  python run_stores.py --state "Assam"         # Single state
  python run_stores.py --state "Delhi" --state "Maharashtra"
  python run_stores.py --state "Delhi" --dry-run
  python run_stores.py --retry-failed
        """
    )
    parser.add_argument(
        "--state",
        action="append",
        dest="states",
        metavar="STATE",
        help=f"State name to scrape (can be used multiple times). Available: {', '.join(ALL_INDIA_STATES[:5])}...",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scrape but don't write to database",
    )
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help="Retry rows that previously failed during load",
    )
    parser.add_argument(
        "--list-states",
        action="store_true",
        help="List all available Indian states and exit",
    )
    args = parser.parse_args()

    if args.list_states:
        print("Available states:")
        for s in sorted(ALL_INDIA_STATES):
            print(f"  {s}")
        sys.exit(0)

    asyncio.run(
        run(
            target_states=args.states,
            dry_run=args.dry_run,
            retry_failed=args.retry_failed,
        )
    )


if __name__ == "__main__":
    main()
