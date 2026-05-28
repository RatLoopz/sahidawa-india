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
from src.scrapers.commercial_medicine import CommercialMedicineScraper, CommercialMedicineNormalizer
from src.scrapers.cdsco import CDSCOScraper
from src.validators.cdsco_validator import CDSCOValidator
from src.loaders.supabase_loader import SupabaseLoader
from src.utils.logger import logger
import pandas as pd

PIPELINE_NAME = "janaushadhi"
RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw" / "janaushadhi"


async def run(
    skip_scrape: bool = False,
    scrape_only: bool = False,
    retry_failed: bool = False,
    refresh_cdsco: bool = False,
    limit: int = None,
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
    raw_ja_path: Path | None = None
    raw_comm_path: Path | None = None

    if not skip_scrape:
        logger.info("STEP 1a/3 — Scraping Jan Aushadhi (headless browser, ~30–60s)...")
        raw_ja_path = await JanAushadhiScraper().scrape()

        logger.info("STEP 1b/3 — Downloading Commercial Medicine Dataset...")
        raw_comm_path = CommercialMedicineScraper().scrape()
    else:
        logger.info("STEP 1/3 — Skipping scrape (--skip-scrape)")
        # Jan Aushadhi raw
        ja_files = sorted(RAW_DIR.glob("janaushadhi_raw_*.csv"))
        if not ja_files:
            logger.error("No existing raw Jan Aushadhi file found. Remove --skip-scrape and try again.")
            return None
        raw_ja_path = ja_files[-1]
        logger.info(f"Using existing Jan Aushadhi raw file: {raw_ja_path.name}")

        # Commercial raw
        comm_dir = Path(__file__).resolve().parents[2] / "data" / "raw" / "commercial"
        comm_files = sorted(comm_dir.glob("indian_medicine_data.csv"))
        if not comm_files:
            logger.error("No existing raw Commercial file found. Remove --skip-scrape and try again.")
            return None
        raw_comm_path = comm_files[-1]
        logger.info(f"Using existing Commercial raw file: {raw_comm_path.name}")

    if scrape_only:
        logger.info(f"Scrape complete. Jan Aushadhi: {raw_ja_path}, Commercial: {raw_comm_path}")
        return None

    # ── STEP 2: NORMALIZE ──────────────────────────────────────────────────────
    logger.info("STEP 2/3 — Normalizing raw data...")
    df_ja = JanAushadhiNormalizer().normalize(raw_ja_path)
    logger.info(f"Normalized {len(df_ja)} Jan Aushadhi records")
    if limit:
        df_ja = df_ja.head(limit)
        logger.info(f"Limited Jan Aushadhi to first {limit} records")

    df_comm = CommercialMedicineNormalizer().normalize(raw_comm_path)
    logger.info(f"Normalized {len(df_comm)} Commercial records")
    if limit:
        df_comm = df_comm.head(limit)
        logger.info(f"Limited Commercial to first {limit} records")

    # ── STEP 2b: LINKING COMMERCIAL TO JAN AUSHADHI ───────────────────────────
    logger.info("STEP 2b — Linking Commercial medicines to Jan Aushadhi generic alternatives...")

    def normalize_gen_name(name: str) -> str:
        n = str(name).lower().strip()
        n = n.replace("amoxycillin", "amoxicillin")
        n = n.replace("clavulanic acid", "clavulanate")
        n = n.replace("clavulanic", "clavulanate")
        return n

    # Index Jan Aushadhi medicines for fast O(1) lookups
    ja_exact_index = {}
    ja_gen_st_index = {}
    ja_gen_index = {}

    for _, row in df_ja.iterrows():
        gen = normalize_gen_name(row["generic_name"])
        st = str(row["strength"]).lower().strip().replace(" ", "") if pd.notna(row["strength"]) else ""
        dfm = str(row["dosage_form"]).lower().strip() if pd.notna(row["dosage_form"]) else ""
        mrp = row["mrp"]

        ja_exact_index[(gen, st, dfm)] = mrp
        if (gen, st) not in ja_gen_st_index:
            ja_gen_st_index[(gen, st)] = mrp
        if gen not in ja_gen_index:
            ja_gen_index[gen] = mrp

    linked_count = 0
    jan_aushadhi_prices = []

    for _, row in df_comm.iterrows():
        gen = normalize_gen_name(row["generic_name"])
        st = str(row["strength"]).lower().strip().replace(" ", "") if pd.notna(row["strength"]) else ""
        dfm = str(row["dosage_form"]).lower().strip() if pd.notna(row["dosage_form"]) else ""

        key_exact = (gen, st, dfm)
        key_gen_st = (gen, st)

        if key_exact in ja_exact_index:
            jan_aushadhi_prices.append(ja_exact_index[key_exact])
            linked_count += 1
        elif key_gen_st in ja_gen_st_index:
            jan_aushadhi_prices.append(ja_gen_st_index[key_gen_st])
            linked_count += 1
        elif gen in ja_gen_index:
            jan_aushadhi_prices.append(ja_gen_index[gen])
            linked_count += 1
        else:
            jan_aushadhi_prices.append(None)

    df_comm["jan_aushadhi_price"] = jan_aushadhi_prices

    logger.info(f"Linking complete — {linked_count}/{len(df_comm)} commercial medicines linked to Jan Aushadhi generic pricing")

    # Combine both datasets
    df = pd.concat([df_ja, df_comm], ignore_index=True)
    logger.info(f"Combined dataset: {len(df)} total records")

    # ── STEP 2c: CDSCO VALIDATION (in-memory) ─────────────────────────────────
    logger.info("STEP 2c — Running CDSCO validation...")
    validation_skipped = False
    try:
        cdsco_scraper = CDSCOScraper()
        cdsco_scraper.fetch_and_save(force=refresh_cdsco)
        cdsco_df = cdsco_scraper.load()

        validator = CDSCOValidator()
        validator.load_reference(cdsco_df)

        # Temporary search name for fuzzy matching (brand name if exists, else generic)
        df["_search_name"] = df["brand_name"].fillna(df["generic_name"])
        df = validator.validate(df, product_col="_search_name", manufacturer_col="manufacturer")
        if "_search_name" in df.columns:
            df = df.drop(columns=["_search_name"])

        verified = df["is_cdsco_verified"].sum() if "is_cdsco_verified" in df.columns else "N/A"
        logger.info(f"CDSCO validation complete — {verified}/{len(df)} rows verified")
    except (OSError, requests.ConnectionError, requests.Timeout) as e:
        validation_skipped = True
        logger.warning(
            f"CDSCO validation skipped due to network/IO error: {e}. "
            "Proceeding with unvalidated data."
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
    parser.add_argument("--limit", type=int, default=None,
                        help="Limit the number of normalized records processed (useful for testing)")
    args = parser.parse_args()

    asyncio.run(run(
        skip_scrape=args.skip_scrape,
        scrape_only=args.scrape_only,
        retry_failed=args.retry_failed,
        refresh_cdsco=args.refresh_cdsco,
        limit=args.limit,
    ))
