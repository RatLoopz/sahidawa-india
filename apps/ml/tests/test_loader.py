import json
import sys
from pathlib import Path

import pandas as pd

# Ensure src.* imports resolve when running pytest from apps/etl/
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.loaders.supabase_loader import SupabaseLoader


class FakeExecuteResponse:
    def __init__(self, data=None):
        self.data = data or []


class FakeTable:
    def __init__(self, name, client):
        self.name = name
        self.client = client
        self.pending_payload = None
        self.pending_update = None
        self.eq_filters = []
        self.operation = None
        self.limit_value = None

    def upsert(self, payload, on_conflict=None):
        self.operation = "upsert"
        self.pending_payload = payload
        self.client.upsert_calls.append((self.name, payload, on_conflict))
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.pending_payload = payload
        self.client.insert_calls.append((self.name, payload))
        return self

    def select(self, *_args):
        self.operation = "select"
        return self

    def update(self, payload):
        self.operation = "update"
        self.pending_update = payload
        return self

    def eq(self, column, value):
        self.eq_filters.append((column, value))
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def range(self, start, end):
        return self

    def execute(self):
        if self.operation == "select":
            rows = self.client.retry_rows
            for column, value in self.eq_filters:
                rows = [row for row in rows if row.get(column) == value]
            if self.limit_value is not None:
                rows = rows[: self.limit_value]
            return FakeExecuteResponse(rows)

        if self.operation == "update":
            row_id = next((value for column, value in self.eq_filters if column == "id"), None)
            if row_id in self.client.update_fail_ids:
                raise Exception("503: retry metadata update failed")
            self.client.update_calls.append((self.name, self.pending_update, self.eq_filters))
            for row in self.client.retry_rows:
                if row.get("id") == row_id:
                    row.update(self.pending_update)
            return FakeExecuteResponse()

        if self.operation == "insert":
            payload = dict(self.pending_payload)
            payload.setdefault("id", f"insert-{len(self.client.retry_rows) + 1}")
            self.client.retry_rows.append(payload)
            return FakeExecuteResponse()

        if self.operation == "upsert":
            payload = self.pending_payload
            if isinstance(payload, list) and len(payload) > 1 and self.client.fail_batches:
                raise Exception("22P02: invalid input syntax for type double precision")
            row = payload[0] if isinstance(payload, list) else payload
            if row.get("generic_name") in self.client.errors_by_generic_name:
                raise Exception(self.client.errors_by_generic_name[row.get("generic_name")])
            if row.get("generic_name") in self.client.fail_generic_names:
                raise Exception("23505: duplicate key value violates unique constraint")
            return FakeExecuteResponse()

        return FakeExecuteResponse()


class FakeSupabaseClient:
    def __init__(
        self,
        *,
        fail_batches=False,
        fail_generic_names=None,
        retry_rows=None,
        errors_by_generic_name=None,
        update_fail_ids=None,
    ):
        self.fail_batches = fail_batches
        self.fail_generic_names = set(fail_generic_names or [])
        self.errors_by_generic_name = errors_by_generic_name or {}
        self.retry_rows = retry_rows or []
        self.update_fail_ids = set(update_fail_ids or [])
        self.upsert_calls = []
        self.insert_calls = []
        self.update_calls = []

    def table(self, name):
        return FakeTable(name, self)


def make_loader(client, tmp_path):
    loader = SupabaseLoader.__new__(SupabaseLoader)
    loader.client = client
    loader.failed_rows_dir = tmp_path
    loader.pipeline_name = "janaushadhi"
    return loader


def test_batch_success_returns_summary_without_failed_rows_csv(tmp_path):
    client = FakeSupabaseClient()
    loader = make_loader(client, tmp_path)
    df = pd.DataFrame(
        [
            {"generic_name": "Paracetamol", "strength": "500mg", "dosage_form": "Tablet"},
            {"generic_name": "Cetirizine", "strength": "10mg", "dosage_form": "Tablet"},
        ]
    )

    stats = loader.load(df)

    assert stats["total"] == 2
    assert stats["inserted"] == 2
    assert stats["failed"] == 0
    assert stats["success_rate"] == 100.0
    assert stats["error_counts"] == {}
    assert stats["failed_rows_csv"] is None
    assert len(client.upsert_calls) == 1


def test_failed_batch_falls_back_to_row_level_upserts_and_logs_bad_row(tmp_path, capsys):
    client = FakeSupabaseClient(fail_batches=True, fail_generic_names={"Bad Float"})
    loader = make_loader(client, tmp_path)
    df = pd.DataFrame(
        [
            {"generic_name": "Paracetamol", "strength": "500mg", "dosage_form": "Tablet"},
            {"generic_name": "Bad Float", "strength": "not-a-float", "dosage_form": "Tablet"},
            {"generic_name": "Cetirizine", "strength": "10mg", "dosage_form": "Tablet"},
        ]
    )

    stats = loader.load(df)

    assert stats["inserted"] == 2
    assert stats["failed"] == 1
    assert stats["error_counts"] == {"duplicate_key": 1}
    assert len(client.upsert_calls) == 4

    log_lines = [line for line in capsys.readouterr().out.splitlines() if '"event": "etl_row_failure"' in line]
    assert len(log_lines) == 1
    log = json.loads(log_lines[0])
    assert log["medicine_name"] == "Bad Float"
    assert log["unresolved_value"] == "not-a-float"
    assert log["db_error_code"] == "23505"
    assert log["error_category"] == "duplicate_key"
    assert log["row_index"] == 1
    assert log["pipeline"] == "janaushadhi"


def test_failed_rows_are_exported_to_csv_with_error_columns(tmp_path):
    client = FakeSupabaseClient(fail_batches=True, fail_generic_names={"Bad Float"})
    loader = make_loader(client, tmp_path)
    df = pd.DataFrame(
        [
            {"generic_name": "Bad Float", "strength": "not-a-float", "dosage_form": "Tablet"},
        ]
    )

    stats = loader.load(df)

    failed_rows_csv = Path(stats["failed_rows_csv"])
    assert failed_rows_csv.exists()
    failed = pd.read_csv(failed_rows_csv, dtype=str)
    assert failed.loc[0, "generic_name"] == "Bad Float"
    assert failed.loc[0, "error_category"] == "duplicate_key"
    assert failed.loc[0, "db_error_code"] == "23505"
    assert failed.loc[0, "error_message"]


def test_validation_failure_log_includes_required_debug_fields(tmp_path, capsys):
    client = FakeSupabaseClient(
        errors_by_generic_name={"Missing Name": "validation failed: generic_name is required"}
    )
    loader = make_loader(client, tmp_path)
    df = pd.DataFrame(
        [
            {"generic_name": "Missing Name", "strength": "", "dosage_form": "Tablet"},
        ]
    )

    stats = loader.load(df)

    assert stats["failed"] == 1
    assert stats["error_counts"] == {"validation_error": 1}
    log_lines = [line for line in capsys.readouterr().out.splitlines() if '"event": "etl_row_failure"' in line]
    log = json.loads(log_lines[0])
    assert log["medicine_name"] == "Missing Name"
    assert log["unresolved_value"] == ""
    assert log["db_error_code"] is None
    assert log["error_category"] == "validation_error"


def test_summary_prints_alert_when_success_rate_is_below_threshold(tmp_path, caplog):
    client = FakeSupabaseClient(fail_batches=True, fail_generic_names={"Bad Float"})
    loader = make_loader(client, tmp_path)
    df = pd.DataFrame(
        [
            {"generic_name": "Bad Float", "strength": "not-a-float", "dosage_form": "Tablet"},
            {"generic_name": "Paracetamol", "strength": "500mg", "dosage_form": "Tablet"},
        ]
    )

    stats = loader.load(df)

    assert stats["success_rate"] == 50.0
    output = caplog.text
    assert "ALERT" in output
    assert "95%" in output


def test_retry_failed_rows_updates_successful_and_failed_retry_records(tmp_path):
    retry_rows = [
        {
            "id": "row-1",
            "pipeline_name": "janaushadhi",
            "status": "failed",
            "row_payload": {"generic_name": "Paracetamol", "strength": "500mg", "dosage_form": "Tablet"},
            "attempt_count": 1,
        },
        {
            "id": "row-2",
            "pipeline_name": "janaushadhi",
            "status": "failed",
            "row_payload": {"generic_name": "Bad Float", "strength": "not-a-float", "dosage_form": "Tablet"},
            "attempt_count": 2,
        },
    ]
    client = FakeSupabaseClient(fail_generic_names={"Bad Float"}, retry_rows=retry_rows)
    loader = make_loader(client, tmp_path)

    stats = loader.retry_failed_rows()

    assert stats["total"] == 2
    assert stats["inserted"] == 1
    assert stats["failed"] == 1

    updates = [call[1] for call in client.update_calls if call[0] == "etl_failed_rows"]
    assert updates[0]["status"] == "retry_succeeded"
    assert updates[0]["attempt_count"] == 2
    assert updates[1]["status"] == "failed"
    assert updates[1]["attempt_count"] == 3
    assert updates[1]["error_category"] == "duplicate_key"


def test_retry_success_is_counted_only_after_retry_metadata_update_succeeds(tmp_path):
    retry_rows = [
        {
            "id": "row-1",
            "pipeline_name": "janaushadhi",
            "status": "failed",
            "row_payload": {"generic_name": "Paracetamol", "strength": "500mg", "dosage_form": "Tablet"},
            "attempt_count": 1,
        },
    ]
    client = FakeSupabaseClient(retry_rows=retry_rows, update_fail_ids={"row-1"})
    loader = make_loader(client, tmp_path)

    stats = loader.retry_failed_rows()

    assert stats["total"] == 1
    assert stats["inserted"] == 0
    assert stats["failed"] == 1


def test_persist_failure_updates_existing_retry_row_for_same_payload(tmp_path):
    client = FakeSupabaseClient(fail_generic_names={"Bad Float"})
    loader = make_loader(client, tmp_path)
    df = pd.DataFrame(
        [
            {"generic_name": "Bad Float", "strength": "not-a-float", "dosage_form": "Tablet"},
        ]
    )

    first_stats = loader.load(df)
    second_stats = loader.load(df)

    assert first_stats["failed"] == 1
    assert second_stats["failed"] == 1
    assert len(client.insert_calls) == 1
    retry_updates = [call[1] for call in client.update_calls if call[0] == "etl_failed_rows"]
    assert retry_updates[-1]["attempt_count"] == 2
    assert len(client.retry_rows) == 1


# ── Tests for merge_commercial_mrp ────────────────────────────────────────────

# ---------------------------------------------------------------------------
# Extended FakeTable helpers needed for the merge tests.
# The existing FakeTable already handles select/update/eq — we only need to
# add .is_() and .range() so the pagination loop in merge_commercial_mrp works.
# ---------------------------------------------------------------------------

class MergeFakeTable(FakeTable):
    """FakeTable extended with .is_() and .range() for merge tests."""

    def __init__(self, name, client):
        super().__init__(name, client)
        self._is_filters: list[tuple[str, str]] = []
        self._range_start: int | None = None
        self._range_end: int | None = None

    def is_(self, column: str, value: str):
        self._is_filters.append((column, value))
        return self

    def range(self, start: int, end: int):
        self._range_start = start
        self._range_end = end
        return self

    def execute(self):
        if self.operation == "select":
            rows = list(self.client.medicines)
            # Apply eq filters first
            for col, val in self.eq_filters:
                rows = [r for r in rows if r.get(col) == val]
            # Apply is_null filter
            for col, val in self._is_filters:
                if val == "null":
                    rows = [r for r in rows if r.get(col) is None]
            # Apply range AFTER filtering — PostgREST applies WHERE before LIMIT/OFFSET
            if self._range_start is not None and self._range_end is not None:
                page_size = self._range_end - self._range_start + 1
                rows = rows[self._range_start: self._range_start + page_size]
            return FakeExecuteResponse(rows)

        # Delegate all other ops to the parent implementation
        return super().execute()


class MergeFakeSupabaseClient:
    """Minimal Supabase fake for merge_commercial_mrp tests."""

    def __init__(self, medicines: list[dict] | None = None):
        self.medicines: list[dict] = medicines or []
        self.update_calls: list[tuple] = []

    def table(self, name: str):
        t = MergeFakeTable(name, self)
        # Wire update recording
        original_execute = t.execute

        def patched_execute():
            if t.operation == "update":
                row_id = next((v for c, v in t.eq_filters if c == "id"), None)
                self.update_calls.append((name, t.pending_update, t.eq_filters))
                for med in self.medicines:
                    if med.get("id") == row_id:
                        med.update(t.pending_update)
                return FakeExecuteResponse()
            return original_execute()

        t.execute = patched_execute
        return t


def make_merge_loader(client, tmp_path):
    loader = SupabaseLoader.__new__(SupabaseLoader)
    loader.client = client
    loader.failed_rows_dir = tmp_path
    loader.pipeline_name = "commercial_mrp"
    return loader


# ---------------------------------------------------------------------------
# Test: all null-mrp rows are updated (no hidden .limit() cap)
# ---------------------------------------------------------------------------

def test_merge_updates_all_null_mrp_rows_beyond_old_limit(tmp_path):
    """All rows with null MRP must be updated, not just the first 5."""
    medicines = [
        {"id": f"med-{i}", "generic_name": "Paracetamol", "strength": "500mg", "mrp": None}
        for i in range(10)
    ]
    client = MergeFakeSupabaseClient(medicines=medicines)
    loader = make_merge_loader(client, tmp_path)

    mrp_df = pd.DataFrame([
        {"generic_name": "Paracetamol", "strength": "500mg", "mrp": 18.50}
    ])
    stats = loader.merge_commercial_mrp(mrp_df, page_size=1000)

    assert stats["checked"] == 10
    assert stats["updated"] == 10
    assert stats["skipped"] == 0
    assert stats["failed"] == 0
    assert all(m["mrp"] == 18.50 for m in medicines)


# ---------------------------------------------------------------------------
# Test: rows already having an MRP are not touched (is_null filter)
# ---------------------------------------------------------------------------

def test_merge_skips_rows_that_already_have_mrp(tmp_path):
    medicines = [
        {"id": "med-1", "generic_name": "Paracetamol", "strength": "500mg", "mrp": None},
        {"id": "med-2", "generic_name": "Paracetamol", "strength": "500mg", "mrp": 20.0},
    ]
    client = MergeFakeSupabaseClient(medicines=medicines)
    loader = make_merge_loader(client, tmp_path)

    mrp_df = pd.DataFrame([{"generic_name": "Paracetamol", "strength": "500mg", "mrp": 18.50}])
    stats = loader.merge_commercial_mrp(mrp_df, page_size=1000)

    # Only the null-mrp row should have been fetched and updated
    assert stats["checked"] == 1
    assert stats["updated"] == 1


# ---------------------------------------------------------------------------
# Test: strict name matching — 'iron' must NOT update 'spironolactone'
# ---------------------------------------------------------------------------

def test_merge_does_not_match_iron_against_spironolactone(tmp_path):
    """
    The old ilike('%iron%') query would incorrectly match spironolactone.
    Exact matching must prevent this false positive.
    """
    medicines = [
        {"id": "med-1", "generic_name": "Spironolactone", "strength": "25mg", "mrp": None},
        {"id": "med-2", "generic_name": "Iron",            "strength": "100mg", "mrp": None},
    ]
    client = MergeFakeSupabaseClient(medicines=medicines)
    loader = make_merge_loader(client, tmp_path)

    mrp_df = pd.DataFrame([{"generic_name": "Iron", "strength": "100mg", "mrp": 32.0}])
    stats = loader.merge_commercial_mrp(mrp_df, page_size=1000)

    spiro = next(m for m in medicines if m["id"] == "med-1")
    iron  = next(m for m in medicines if m["id"] == "med-2")

    assert spiro["mrp"] is None, "spironolactone must NOT be updated by 'iron' lookup"
    assert iron["mrp"] == 32.0,  "iron must be updated"
    assert stats["updated"] == 1
    assert stats["skipped"] == 1


# ---------------------------------------------------------------------------
# Test: different strengths of the same drug get the right MRP
# ---------------------------------------------------------------------------

def test_merge_assigns_strength_specific_mrp(tmp_path):
    medicines = [
        {"id": "para-500", "generic_name": "Paracetamol", "strength": "500mg", "mrp": None},
        {"id": "para-650", "generic_name": "Paracetamol", "strength": "650mg", "mrp": None},
    ]
    client = MergeFakeSupabaseClient(medicines=medicines)
    loader = make_merge_loader(client, tmp_path)

    mrp_df = pd.DataFrame([
        {"generic_name": "Paracetamol", "strength": "500mg", "mrp": 18.50},
        {"generic_name": "Paracetamol", "strength": "650mg", "mrp": 22.00},
    ])
    stats = loader.merge_commercial_mrp(mrp_df, page_size=1000)

    assert next(m["mrp"] for m in medicines if m["id"] == "para-500") == 18.50
    assert next(m["mrp"] for m in medicines if m["id"] == "para-650") == 22.00
    assert stats["updated"] == 2


# ---------------------------------------------------------------------------
# Test: pagination processes more rows than page_size
# ---------------------------------------------------------------------------

def test_merge_paginates_when_rows_exceed_page_size(tmp_path):
    medicines = [
        {"id": f"med-{i}", "generic_name": "Metformin", "strength": "500mg", "mrp": None}
        for i in range(25)
    ]
    client = MergeFakeSupabaseClient(medicines=medicines)
    loader = make_merge_loader(client, tmp_path)

    mrp_df = pd.DataFrame([{"generic_name": "Metformin", "strength": "500mg", "mrp": 20.0}])
    stats = loader.merge_commercial_mrp(mrp_df, page_size=10)

    assert stats["checked"] == 25
    assert stats["updated"] == 25
    assert all(m["mrp"] == 20.0 for m in medicines)


# ---------------------------------------------------------------------------
# Test: drug with no MRP reference is skipped gracefully
# ---------------------------------------------------------------------------

def test_merge_skips_drugs_not_in_reference(tmp_path):
    medicines = [
        {"id": "med-1", "generic_name": "Obscure Drug XYZ", "strength": "10mg", "mrp": None},
    ]
    client = MergeFakeSupabaseClient(medicines=medicines)
    loader = make_merge_loader(client, tmp_path)

    mrp_df = pd.DataFrame([{"generic_name": "Paracetamol", "strength": "500mg", "mrp": 18.50}])
    stats = loader.merge_commercial_mrp(mrp_df, page_size=1000)

    assert stats["skipped"] == 1
    assert stats["updated"] == 0
    assert medicines[0]["mrp"] is None


# ---------------------------------------------------------------------------
# Test: empty mrp_df returns all-zero stats without touching the DB
# ---------------------------------------------------------------------------

def test_merge_with_empty_mrp_df_returns_zero_stats(tmp_path):
    medicines = [
        {"id": "med-1", "generic_name": "Paracetamol", "strength": "500mg", "mrp": None},
    ]
    client = MergeFakeSupabaseClient(medicines=medicines)
    loader = make_merge_loader(client, tmp_path)

    stats = loader.merge_commercial_mrp(pd.DataFrame(), page_size=1000)

    assert stats == {"checked": 0, "updated": 0, "skipped": 0, "failed": 0}
    assert len(client.update_calls) == 0


# ---------------------------------------------------------------------------
# Test: strength-less fallback used when DB row has no strength
# ---------------------------------------------------------------------------

def test_merge_uses_fallback_mrp_when_db_row_has_no_strength(tmp_path):
    medicines = [
        {"id": "med-1", "generic_name": "Insulin", "strength": None, "mrp": None},
    ]
    client = MergeFakeSupabaseClient(medicines=medicines)
    loader = make_merge_loader(client, tmp_path)

    mrp_df = pd.DataFrame([{"generic_name": "Insulin", "strength": None, "mrp": 320.0}])
    stats = loader.merge_commercial_mrp(mrp_df, page_size=1000)

    assert stats["updated"] == 1
    assert medicines[0]["mrp"] == 320.0
