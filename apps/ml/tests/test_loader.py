import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from etl.loader import SupabaseLoader


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


def test_summary_prints_alert_when_success_rate_is_below_threshold(tmp_path, capsys):
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
    output = capsys.readouterr().out
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
