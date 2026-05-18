"""
SahiDawa — Supabase Data Loader
=================================
INPUT:  Clean pandas DataFrame from the normalizer
OUTPUT: Records inserted into the Supabase 'medicines' table

WHY A SEPARATE LOADER?
    The loader only knows how to talk to the database.
    Tomorrow if we switch from Supabase to a direct Postgres connection,
    only THIS file changes — not the scraper or normalizer.

UPSERT STRATEGY:
    We use "upsert" (insert + update on conflict) instead of plain insert.
    This means running the scraper twice won't create duplicate entries.
    Conflict is detected on: (generic_name, strength, dosage_form, source)
    
    If a record already exists with those same values, we UPDATE it
    (in case MRP or other details changed since last scrape).

BATCH INSERTS:
    Instead of inserting one row at a time (slow), we insert in batches of 100.
    This reduces the number of network round-trips to Supabase from 2,400 to ~24.
"""

import os
import time
import pandas as pd
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv


# ── Load environment variables ─────────────────────────────────────────────────
# The .env file in the repo root contains SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
load_dotenv(Path(__file__).resolve().parents[3] / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
# We use SERVICE_ROLE_KEY (not anon key) because:
# - Anon key is subject to RLS policies (which block anonymous writes)
# - Service role key bypasses RLS — only safe to use on trusted backend scripts
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

BATCH_SIZE = 100   # Insert this many rows per Supabase API call
DELAY_SEC  = 0.5   # Wait between batches to avoid rate-limiting


# ── Loader Class ──────────────────────────────────────────────────────────────

class SupabaseLoader:
    """
    Loads a normalized pandas DataFrame into Supabase's medicines table.
    Uses batched upserts for efficiency and reliability.
    """

    def __init__(self):
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError(
                "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file.\n"
                "   Copy .env.example to .env and fill in your Supabase credentials."
            )
        self.client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print(f"[Loader] Connected to Supabase: {SUPABASE_URL[:40]}...")

    def load(self, df: pd.DataFrame, table: str = "medicines") -> dict:
        """
        Inserts/updates all rows from the DataFrame into the given table.
        
        Args:
            df:    Normalized DataFrame from JanAushadhiNormalizer
            table: Supabase table name (default: "medicines")
            
        Returns:
            dict with stats: {"inserted": N, "failed": N, "total": N}
        """
        total = len(df)
        print(f"[Loader] Starting load of {total} records into '{table}'...")
        
        # Convert DataFrame to list of dicts (Supabase expects this format)
        raw_records = df.to_dict(orient="records")
        records = []
        for record in raw_records:
            clean_record = {}
            for k, v in record.items():
                if pd.isna(v):
                    clean_record[k] = None
                else:
                    clean_record[k] = v
            records.append(clean_record)
        
        # Supabase/Postgres treats None as NULL, but NaN would cause a JSON encoding error
        
        inserted = 0
        failed = 0
        
        # Process in batches
        for batch_start in range(0, total, BATCH_SIZE):
            batch = records[batch_start : batch_start + BATCH_SIZE]
            batch_end = batch_start + len(batch)
            
            try:
                # UPSERT: Insert if not exists, update if exists.
                # on_conflict tells Supabase WHICH columns to check for duplicates.
                # If a row with the same (generic_name, strength, dosage_form, source)
                # already exists, it will be updated instead of duplicated.
                self.client.table(table).upsert(
                    batch,
                    on_conflict="generic_name,strength,dosage_form,source"
                ).execute()
                
                inserted += len(batch)
                print(
                    f"[Loader] Batch {batch_start}–{batch_end} ✅  "
                    f"({inserted}/{total} done)"
                )
                
            except Exception as e:
                failed += len(batch)
                print(f"[Loader] Batch {batch_start}–{batch_end} ❌ Error: {e}")
            
            # Small delay between batches to be respectful to Supabase rate limits
            if batch_end < total:
                time.sleep(DELAY_SEC)
        
        stats = {"inserted": inserted, "failed": failed, "total": total}
        print(f"\n[Loader] ✅ Load complete: {inserted} inserted, {failed} failed")
        return stats


# ── Runner ────────────────────────────────────────────────────────────────────

def load_processed_csv(csv_path: Path = None):
    """
    Convenience function: loads data/processed/janaushadhi_processed.csv into Supabase.
    """
    if csv_path is None:
        csv_path = Path(__file__).resolve().parents[3] / "data" / "processed" / "janaushadhi_processed.csv"
    
    if not csv_path.exists():
        print(f"[Loader] ❌ Processed CSV not found at: {csv_path}")
        print("[Loader]    Run the normalizer first: python -m etl.normalizer")
        return
    
    print(f"[Loader] Reading: {csv_path}")
    df = pd.read_csv(csv_path)
    
    loader = SupabaseLoader()
    stats = loader.load(df)
    return stats


if __name__ == "__main__":
    load_processed_csv()
