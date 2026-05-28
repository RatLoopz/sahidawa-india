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


# ── Tests for merge_commercial_mrp ────────────────────────────────────────────

class MergeFakeTable(FakeTable):
    """FakeTable extended with .is_() and .range() for merge tests."""

    def __init__(self, name, client):
        super().__init__(name, client)
        self._is_filters = []
        self._range_start = None
        self._range_end = None

    def is_(self, column, value):
        self._is_filters.append((column, value))
        return self

    def range(self, start, end):
        self._range_start = start
        self._range_end = end
        return self

    def execute(self):
        if self.operation == "select":
            rows = list(self.client.medicines)

            for col, val in self.eq_filters:
                rows = [r for r in rows if r.get(col) == val]

            for col, val in self._is_filters:
                if val == "null":
                    rows = [r for r in rows if r.get(col) is None]

            if self._range_start is not None and self._range_end is not None:
                page_size = self._range_end - self._range_start + 1
                rows = rows[self._range_start: self._range_start + page_size]

            return FakeExecuteResponse(rows)

        return super().execute()


class MergeFakeSupabaseClient:
    """Minimal Supabase fake for merge_commercial_mrp tests."""

    def __init__(self, medicines=None):
        self.medicines = medicines or []
        self.update_calls = []

    def table(self, name):
        t = MergeFakeTable(name, self)
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


def test_merge_updates_all_null_mrp_rows_beyond_old_limit(tmp_path):
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


def test_merge_does_not_match_iron_against_spironolactone(tmp_path):
    medicines = [
        {"id": "med-1", "generic_name": "Spironolactone", "strength": "25mg", "mrp": None},
        {"id": "med-2", "generic_name": "Iron", "strength": "100mg", "mrp": None},
    ]

    client = MergeFakeSupabaseClient(medicines=medicines)
    loader = make_merge_loader(client, tmp_path)

    mrp_df = pd.DataFrame([
        {"generic_name": "Iron", "strength": "100mg", "mrp": 32.0}
    ])

    stats = loader.merge_commercial_mrp(mrp_df, page_size=1000)

    spiro = next(m for m in medicines if m["id"] == "med-1")
    iron = next(m for m in medicines if m["id"] == "med-2")

    assert spiro["mrp"] is None
    assert iron["mrp"] == 32.0
    assert stats["updated"] == 1
    assert stats["skipped"] == 1


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
