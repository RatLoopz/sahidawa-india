"""
SahiDawa — Full ETL Pipeline Runner
======================================
This script runs the complete pipeline in one command:

    SCRAPE → NORMALIZE → LOAD

Usage:
    cd apps/ml
    python run_pipeline.py

    # Or skip scraping (use existing raw file):
    python run_pipeline.py --skip-scrape

    # Or only scrape (don't load to DB):
    python run_pipeline.py --scrape-only

    # Or retry only rows that previously failed during load:
    python run_pipeline.py --retry-failed

Prerequisite (one-time):
    pip install -r requirements.txt
    playwright install chromium

After running this script, your Supabase 'medicines' table will have
all 2,400+ Jan Aushadhi medicines loaded.
"""

import asyncio
import argparse
from pathlib import Path

from scrapers.janaushadhi import JanAushadhiScraper
from etl.normalizer import JanAushadhiNormalizer, normalize_latest
from etl.loader import SupabaseLoader


async def run_full_pipeline(
    skip_scrape: bool = False,
    scrape_only: bool = False,
    retry_failed: bool = False,
):
    print("\n" + "="*60)
    print("  SahiDawa ETL Pipeline — Jan Aushadhi")
    print("="*60 + "\n")

    if retry_failed:
        print("🔁 RETRY MODE: Reprocessing previously failed ETL rows...")
        loader = SupabaseLoader()
        stats = loader.retry_failed_rows()

        print("\n" + "="*60)
        print("  Retry Complete!")
        print(f"  Total processed : {stats['total']}")
        print(f"  Successfully loaded : {stats['inserted']}")
        print(f"  Failed : {stats['failed']}")
        print(f"  Success rate : {stats['success_rate']}%")
        if stats.get("failed_rows_csv"):
            print(f"  Failed rows CSV : {stats['failed_rows_csv']}")
        print("="*60 + "\n")
        return stats

    # ── STEP 1: SCRAPE ─────────────────────────────────────────────────────────
    raw_csv_path = None

    if not skip_scrape:
        print("📡 STEP 1/3: Scraping Jan Aushadhi website...")
        print("   (This opens a headless browser — may take 30-60 seconds)\n")
        scraper = JanAushadhiScraper()
        raw_csv_path = await scraper.scrape()
    else:
        print("⏭️  STEP 1/3: Skipping scrape (--skip-scrape flag set)")
        # Use the most recent raw file
        raw_dir = Path("../../data/raw/janaushadhi")
        files = sorted(raw_dir.glob("janaushadhi_raw_*.csv"))
        if files:
            raw_csv_path = files[-1]
            print(f"   Using existing raw file: {raw_csv_path.name}")
        else:
            print("❌ No existing raw file found. Remove --skip-scrape flag.")
            return

    if scrape_only:
        print(f"\n✅ Scrape complete. Raw file: {raw_csv_path}")
        print("   (--scrape-only flag set — skipping normalize and load)")
        return

    # ── STEP 2: NORMALIZE ──────────────────────────────────────────────────────
    print("\n🔧 STEP 2/3: Normalizing raw data...")
    normalizer = JanAushadhiNormalizer()
    clean_df = normalizer.normalize(raw_csv_path)
    print(f"   Normalized {len(clean_df)} records")

    # ── STEP 3: LOAD ───────────────────────────────────────────────────────────
    print("\n☁️  STEP 3/3: Loading into Supabase...")
    loader = SupabaseLoader()
    stats = loader.load(clean_df)

    # ── SUMMARY ────────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("  Pipeline Complete!")
    print(f"  Total processed : {stats['total']}")
    print(f"  Successfully loaded : {stats['inserted']}")
    print(f"  Failed : {stats['failed']}")
    print(f"  Success rate : {stats['success_rate']}%")
    if stats.get("failed_rows_csv"):
        print(f"  Failed rows CSV : {stats['failed_rows_csv']}")
    print("="*60 + "\n")

    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SahiDawa Jan Aushadhi ETL Pipeline")
    parser.add_argument("--skip-scrape", action="store_true",
                        help="Skip scraping and use the latest existing raw file")
    parser.add_argument("--scrape-only", action="store_true",
                        help="Only scrape — don't normalize or load to DB")
    parser.add_argument("--retry-failed", action="store_true",
                        help="Retry only rows saved in the ETL failed rows table")
    parser.add_argument("--commercial-mrp", action="store_true",
                        help="Scrape commercial MRPs from 1mg and merge into medicines table")
    parser.add_argument("--commercial-csv", type=str, default=None,
                        help="Path to existing commercial MRP CSV (skips scraping)")
    args = parser.parse_args()

    if args.commercial_mrp or args.commercial_csv:
        from scrapers.commercial_mrp import CommercialMRPScraper
        from pathlib import Path

        if args.commercial_csv:
            csv_path = Path(args.commercial_csv)
            print(f"[Pipeline] Using existing commercial MRP CSV: {csv_path}")
        else:
            print("[Pipeline] 🛒 Scraping commercial MRPs from 1mg...")
            scraper = CommercialMRPScraper(max_pages_per_query=3)
            csv_path = scraper.scrape()

        loader = SupabaseLoader()
        stats = loader.merge_commercial_mrp(csv_path)
        print(f"\n✅ Commercial MRP merge complete: {stats['updated']} rows updated")
    else:
        asyncio.run(run_full_pipeline(
            skip_scrape=args.skip_scrape,
            scrape_only=args.scrape_only,
            retry_failed=args.retry_failed,
        ))