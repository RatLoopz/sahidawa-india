"""
SahiDawa — Unified ETL Pipeline Orchestrator
=============================================
Runs the full pipeline in one command:

    SCRAPE (Jan Aushadhi)
        ↓  pd.DataFrame
    VALIDATE (CDSCO fuzzy match)
        ↓  pd.DataFrame + verification columns
    LOAD (Supabase upsert)

Usage:
    cd apps/etl
    python run_all.py

    # Skip scraping — use the most recent raw file:
    python run_all.py --skip-scrape

    # Scrape only — don't validate or load:
    python run_all.py --scrape-only

    # Retry rows that previously failed during load:
    python run_all.py --retry-failed

    # Re-download CDSCO reference data before validating:
    python run_all.py --refresh-cdsco

Prerequisites (one-time):
    pip install -e .
    playwright install chromium
"""

import argparse
import asyncio
import sys
from pathlib import Path

import requests

# Allow running as `python run_all.py` from apps/etl/
sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.scrapers.jan_aushadhi import JanAushadhiNormalizer, JanAushadhiScraper
from src.scrapers.cdsco import CDSCOScraper
from src.validators.cdsco_validator import CDSCOValidator
from src.loaders.supabase_loader import SupabaseLoader
from src.utils.logger import logger

PIPELINE_NAME = "janaushadhi"
RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw" / "janaushadhi"


async def run(
    skip_scrape: bool = False,
    scrape_only: bool = False,
    retry_failed: bool = False,
    refresh_cdsco: bool = False,
) -> dict | None:
    _banner("SahiDawa Unified ETL Pipeline")

    # ── RETRY MODE ─────────────────────────────────────────────────────────────
    if retry_failed:
        logger.info("RETRY MODE — reprocessing previously failed ETL rows")
        loader = SupabaseLoader(pipeline_name=PIPELINE_NAME)
        stats = loader.retry_failed_rows()
        _summary(stats)
        return stats

    # ── STEP 1: SCRAPE ─────────────────────────────────────────────────────────
    raw_csv_path: Path | None = None

    if not skip_scrape:
        logger.info("STEP 1/3 — Scraping Jan Aushadhi (headless browser, ~30–60s)...")
        raw_csv_path = await JanAushadhiScraper().scrape()
    else:
        logger.info("STEP 1/3 — Skipping scrape (--skip-scrape)")
        files = sorted(RAW_DIR.glob("janaushadhi_raw_*.csv"))
        if not files:
            logger.error("No existing raw file found. Remove --skip-scrape and try again.")
            return None
        raw_csv_path = files[-1]
        logger.info(f"Using existing raw file: {raw_csv_path.name}")

    if scrape_only:
        logger.info(f"Scrape complete. Raw file: {raw_csv_path}")
        return None

    # ── STEP 2: NORMALIZE ──────────────────────────────────────────────────────
    logger.info("STEP 2/3 — Normalizing raw data...")
    df = JanAushadhiNormalizer().normalize(raw_csv_path)
    logger.info(f"Normalized {len(df)} records")

    # ── STEP 2b: CDSCO VALIDATION (in-memory) ─────────────────────────────────
    logger.info("STEP 2b — Running CDSCO validation...")
    validation_skipped = False
    try:
        cdsco_scraper = CDSCOScraper()
        cdsco_scraper.fetch_and_save(force=refresh_cdsco)
        cdsco_df = cdsco_scraper.load()

        validator = CDSCOValidator()
        validator.load_reference(cdsco_df)

        # Jan Aushadhi data uses generic_name + manufacturer columns
        df = validator.validate(df, product_col="generic_name", manufacturer_col="manufacturer")
        verified = df["is_cdsco_verified"].sum() if "is_cdsco_verified" in df.columns else "N/A"
        logger.info(f"CDSCO validation complete — {verified}/{len(df)} rows verified")
    except (OSError, requests.ConnectionError, requests.Timeout) as e:
        # Network or disk errors are non-fatal: log clearly and continue with unvalidated data.
        validation_skipped = True
        logger.warning(
            f"CDSCO validation skipped due to network/IO error: {e}. "
            "Proceeding with unvalidated data. Re-run with --refresh-cdsco once connectivity is restored."
        )

    # ── STEP 3: LOAD ───────────────────────────────────────────────────────────
    logger.info("STEP 3/3 — Loading into Supabase...")
    loader = SupabaseLoader(pipeline_name=PIPELINE_NAME)
    stats = loader.load(df)
    stats["validation_skipped"] = validation_skipped

    _summary(stats)
    return stats


def _banner(title: str) -> None:
    line = "=" * 60
    logger.info(f"\n{line}\n  {title}\n{line}")


def _summary(stats: dict) -> None:
    validation_line = (
        "\n  CDSCO validation  : SKIPPED (network/IO error — data is unvalidated)"
        if stats.get("validation_skipped")
        else ""
    )
    logger.info(
        f"\n{'='*60}\n"
        f"  Pipeline Complete!\n"
        f"  Total processed  : {stats['total']}\n"
        f"  Inserted/updated : {stats['inserted']}\n"
        f"  Failed           : {stats['failed']}\n"
        f"  Success rate     : {stats['success_rate']}%"
        + validation_line
        + (f"\n  Failed rows CSV  : {stats['failed_rows_csv']}" if stats.get("failed_rows_csv") else "")
        + f"\n{'='*60}"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SahiDawa Unified ETL Pipeline")
    parser.add_argument("--skip-scrape", action="store_true",
                        help="Use the most recent existing raw CSV instead of scraping")
    parser.add_argument("--scrape-only", action="store_true",
                        help="Scrape only — skip validation and DB load")
    parser.add_argument("--retry-failed", action="store_true",
                        help="Retry rows saved in the etl_failed_rows table")
    parser.add_argument("--refresh-cdsco", action="store_true",
                        help="Force re-download of CDSCO reference data")
    args = parser.parse_args()

    asyncio.run(run(
        skip_scrape=args.skip_scrape,
        scrape_only=args.scrape_only,
        retry_failed=args.retry_failed,
        refresh_cdsco=args.refresh_cdsco,
    ))
