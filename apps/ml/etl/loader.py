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

import json
import os
import re
import time
from collections import Counter
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import Client, create_client


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
PIPELINE_NAME = "janaushadhi"
FAILED_ROWS_DIR = Path(__file__).resolve().parents[3] / "data" / "failed" / PIPELINE_NAME
RETRY_TABLE = "etl_failed_rows"
SUCCESS_RATE_ALERT_THRESHOLD = 95.0


# ── Loader Class ──────────────────────────────────────────────────────────────

class SupabaseLoader:
    """
    Loads a normalized pandas DataFrame into Supabase's medicines table.
    Uses batched upserts for efficiency and reliability.
    """

    def __init__(
        self,
        client: Client | None = None,
        failed_rows_dir: Path | None = None,
        pipeline_name: str = PIPELINE_NAME,
    ):
        self.pipeline_name = pipeline_name
        self.failed_rows_dir = failed_rows_dir or FAILED_ROWS_DIR

        if client is not None:
            self.client = client
            return

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
            dict with stats, success rate, error counts, and failed CSV path.
        """
        total = len(df)
        print(f"[Loader] Starting load of {total} records into '{table}'...")

        # Convert DataFrame to list of dicts (Supabase expects this format)
        raw_records = df.to_dict(orient="records")
        records = []
        for row_index, record in enumerate(raw_records):
            clean_record = {}
            for k, v in record.items():
                if pd.isna(v):
                    clean_record[k] = None
                else:
                    clean_record[k] = v
            records.append({"row_index": row_index, "payload": clean_record})

        # Supabase/Postgres treats None as NULL, but NaN would cause a JSON encoding error

        inserted = 0
        failures = []

        # Process in batches
        for batch_start in range(0, total, BATCH_SIZE):
            batch = records[batch_start : batch_start + BATCH_SIZE]
            batch_end = batch_start + len(batch)

            try:
                self._upsert_payloads([item["payload"] for item in batch], table)
                inserted += len(batch)
                print(
                    f"[Loader] Batch {batch_start}–{batch_end} ✅  "
                    f"({inserted}/{total} done)"
                )
            except Exception as e:
                print(f"[Loader] Batch {batch_start}–{batch_end} ❌ Error: {e}")
                print("[Loader] Retrying failed batch row by row...")
                batch_inserted, batch_failures = self._load_batch_row_by_row(batch, table)
                inserted += batch_inserted
                failures.extend(batch_failures)

            # Small delay between batches to be respectful to Supabase rate limits
            if batch_end < total:
                time.sleep(DELAY_SEC)

        stats = self._build_stats(total, inserted, failures)
        stats["failed_rows_csv"] = self._export_failed_rows(failures)
        self._print_summary(stats)
        return stats

    def retry_failed_rows(self, table: str = "medicines") -> dict:
        """
        Reprocesses rows previously captured in the ETL retry table.
        """
        response = (
            self.client.table(RETRY_TABLE)
            .select("*")
            .eq("pipeline_name", self.pipeline_name)
            .eq("status", "failed")
            .execute()
        )
        retry_rows = getattr(response, "data", None) or []
        total = len(retry_rows)
        print(f"[Loader] Retrying {total} failed rows from '{RETRY_TABLE}'...")

        inserted = 0
        failures = []

        for index, retry_row in enumerate(retry_rows):
            row_payload = retry_row.get("row_payload") or {}
            row_index = retry_row.get("row_index", index)
            attempt_count = int(retry_row.get("attempt_count") or 0) + 1

            try:
                self._upsert_payloads([row_payload], table)
                self._update_retry_row(
                    retry_row["id"],
                    {
                        "status": "retry_succeeded",
                        "attempt_count": attempt_count,
                        "last_attempt_at": self._utc_now(),
                        "updated_at": self._utc_now(),
                    },
                )
                inserted += 1
            except Exception as e:
                failure = self._build_failure(row_payload, row_index, e)
                failures.append(failure)
                self._log_failure(failure)
                self._safe_update_retry_row(
                    retry_row["id"],
                    {
                        "status": "failed",
                        "attempt_count": attempt_count,
                        "error_category": failure["error_category"],
                        "db_error_code": failure["db_error_code"],
                        "error_message": failure["error_message"],
                        "last_attempt_at": self._utc_now(),
                        "updated_at": self._utc_now(),
                    },
                )

        stats = self._build_stats(total, inserted, failures)
        stats["failed_rows_csv"] = self._export_failed_rows(failures)
        self._print_summary(stats)
        return stats

    def _load_batch_row_by_row(self, batch: list[dict], table: str) -> tuple[int, list[dict]]:
        inserted = 0
        failures = []

        for item in batch:
            payload = item["payload"]
            row_index = item["row_index"]

            try:
                self._upsert_payloads([payload], table)
                inserted += 1
            except Exception as e:
                failure = self._build_failure(payload, row_index, e)
                failures.append(failure)
                self._log_failure(failure)
                self._persist_failure(failure, table)

        return inserted, failures

    def _upsert_payloads(self, payloads: list[dict], table: str) -> None:
        # If a row with the same (generic_name, strength, dosage_form, source)
        # already exists, Supabase updates it instead of duplicating it.
        self.client.table(table).upsert(
            payloads,
            on_conflict="generic_name,strength,dosage_form,source",
        ).execute()

    def _build_failure(self, payload: dict, row_index: int, error: Exception) -> dict:
        error_message = str(error)
        db_error_code = self._extract_db_error_code(error_message)
        return {
            "event": "etl_row_failure",
            "pipeline": self.pipeline_name,
            "row_index": row_index,
            "medicine_name": self._extract_medicine_name(payload),
            "unresolved_value": self._extract_unresolved_value(payload),
            "db_error_code": db_error_code,
            "error_category": self._categorize_error(error_message, db_error_code),
            "error_message": error_message,
            "row_fingerprint": self._row_fingerprint(payload),
            "row_payload": payload,
        }

    def _log_failure(self, failure: dict) -> None:
        log_payload = {k: v for k, v in failure.items() if k != "row_payload"}
        print(json.dumps(log_payload, sort_keys=True, default=str))

    def _persist_failure(self, failure: dict, source_table: str) -> None:
        try:
            existing_retry_row = self._find_retry_row(failure, source_table)
            attempt_count = int(existing_retry_row.get("attempt_count") or 0) + 1 if existing_retry_row else 1
            retry_payload = {
                "pipeline_name": self.pipeline_name,
                "source_table": source_table,
                "row_fingerprint": failure["row_fingerprint"],
                "row_payload": failure["row_payload"],
                "medicine_name": failure["medicine_name"],
                "unresolved_value": failure["unresolved_value"],
                "error_category": failure["error_category"],
                "db_error_code": failure["db_error_code"],
                "error_message": failure["error_message"],
                "attempt_count": attempt_count,
                "status": "failed",
                "last_attempt_at": self._utc_now(),
                "updated_at": self._utc_now(),
            }

            if existing_retry_row:
                self._update_retry_row(existing_retry_row["id"], retry_payload)
            else:
                self.client.table(RETRY_TABLE).insert(retry_payload).execute()
        except Exception as e:
            print(f"[Loader] ⚠️ Failed to persist retry row: {e}")

    def _find_retry_row(self, failure: dict, source_table: str) -> dict | None:
        response = (
            self.client.table(RETRY_TABLE)
            .select("id, attempt_count")
            .eq("pipeline_name", self.pipeline_name)
            .eq("source_table", source_table)
            .eq("row_fingerprint", failure["row_fingerprint"])
            .limit(1)
            .execute()
        )
        rows = getattr(response, "data", None) or []
        return rows[0] if rows else None

    def _update_retry_row(self, row_id: str, payload: dict) -> None:
        self.client.table(RETRY_TABLE).update(payload).eq("id", row_id).execute()

    def _safe_update_retry_row(self, row_id: str, payload: dict) -> None:
        try:
            self._update_retry_row(row_id, payload)
        except Exception as e:
            print(f"[Loader] ⚠️ Failed to update retry row {row_id}: {e}")

    def _export_failed_rows(self, failures: list[dict]) -> str | None:
        if not failures:
            return None

        self.failed_rows_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        output_path = self.failed_rows_dir / f"failed_rows_{timestamp}.csv"

        rows = []
        for failure in failures:
            row = dict(failure["row_payload"])
            row.update(
                {
                    "row_index": failure["row_index"],
                    "medicine_name": failure["medicine_name"],
                    "unresolved_value": failure["unresolved_value"],
                    "db_error_code": failure["db_error_code"],
                    "error_category": failure["error_category"],
                    "error_message": failure["error_message"],
                    "row_fingerprint": failure["row_fingerprint"],
                }
            )
            rows.append(row)

        pd.DataFrame(rows).to_csv(output_path, index=False)
        return str(output_path)

    def _build_stats(self, total: int, inserted: int, failures: list[dict]) -> dict:
        failed = len(failures)
        success_rate = round((inserted / total) * 100, 2) if total else 100.0
        return {
            "inserted": inserted,
            "failed": failed,
            "total": total,
            "success_rate": success_rate,
            "error_counts": dict(Counter(failure["error_category"] for failure in failures)),
        }

    def _print_summary(self, stats: dict) -> None:
        print("\n[Loader] Load summary")
        print(f"[Loader] Total rows processed: {stats['total']}")
        print(f"[Loader] Successful inserts/updates: {stats['inserted']}")
        print(f"[Loader] Failed rows: {stats['failed']}")
        print(f"[Loader] Success rate: {stats['success_rate']}%")

        if stats["error_counts"]:
            print(f"[Loader] Error categories: {json.dumps(stats['error_counts'], sort_keys=True)}")

        if stats.get("failed_rows_csv"):
            print(f"[Loader] Failed rows CSV: {stats['failed_rows_csv']}")

        if stats["success_rate"] < SUCCESS_RATE_ALERT_THRESHOLD:
            print(
                f"[Loader] ALERT: Success rate below {int(SUCCESS_RATE_ALERT_THRESHOLD)}% "
                "threshold. Review failed row logs before trusting this load."
            )

        print(f"\n[Loader] ✅ Load complete: {stats['inserted']} inserted, {stats['failed']} failed")

    def _extract_medicine_name(self, payload: dict) -> str | None:
        for key in ("medicine_name", "generic_name", "brand_name", "raw_name"):
            value = payload.get(key)
            if value:
                return str(value)
        return None

    def _extract_unresolved_value(self, payload: dict) -> str | None:
        for key in ("strength", "mrp", "price", "dosage_form", "generic_name", "brand_name"):
            value = payload.get(key)
            if value is not None:
                return str(value)
        return None

    def _extract_db_error_code(self, error_message: str) -> str | None:
        match = re.search(r"\b([0-9A-Z]{5})\b", error_message)
        return match.group(1) if match else None

    def _row_fingerprint(self, payload: dict) -> str:
        encoded_payload = json.dumps(
            payload,
            default=str,
            separators=(",", ":"),
            sort_keys=True,
        )
        return sha256(encoded_payload.encode("utf-8")).hexdigest()

    def _categorize_error(self, error_message: str, db_error_code: str | None) -> str:
        lower = error_message.lower()

        if db_error_code == "23505" or "duplicate key" in lower:
            return "duplicate_key"
        if db_error_code and db_error_code.startswith("23"):
            return "constraint_violation"
        if db_error_code and db_error_code.startswith("22"):
            return "data_type_mismatch"
        if "validation" in lower or "invalid" in lower:
            return "validation_error"
        return "unknown_error"

    def _utc_now(self) -> str:
        return datetime.now(timezone.utc).isoformat()


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
