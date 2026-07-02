import sys
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest

# Ensure src.* imports resolve when running pytest from apps/etl/
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.validators.cdsco_validator import CDSCOValidator


class FakeSupabaseRpcQuery:
    def __init__(self, data=None, error=None):
        self.data = data or []
        self.error = error

    def execute(self):
        return SimpleNamespace(data=self.data, error=self.error)


class FakeSupabaseTableQuery:
    def __init__(self, client, table_name):
        self.client = client
        self.table_name = table_name
        self.records = []
        self.on_conflict = None

    def upsert(self, records, on_conflict=None):
        self.records = records
        self.on_conflict = on_conflict
        return self

    def execute(self):
        self.client.table_calls.append(
            {
                "table": self.table_name,
                "records": self.records,
                "on_conflict": self.on_conflict,
            }
        )
        return SimpleNamespace(data=self.records, error=None)


class FakeSupabaseRpcClient:
    def __init__(self, data=None, error=None, raises=None):
        self.data = data or []
        self.error = error
        self.raises = raises
        self.calls = []
        self.table_calls = []

    def rpc(self, function_name, params):
        self.calls.append((function_name, params))
        if self.raises:
            raise self.raises
        return FakeSupabaseRpcQuery(data=self.data, error=self.error)

    def table(self, table_name):
        return FakeSupabaseTableQuery(self, table_name)


def test_cdsco_validator_uses_supabase_rpc_for_global_fallback_without_all_choices_cache():
    cdsco_data = pd.DataFrame([
        {"brand_name": "Crocin Pain Relief", "firm_name": "GSK"},
    ])
    client = FakeSupabaseRpcClient(data=[
        {
            "brand_name": "Crocin Pain Relief",
            "manufacturer": "GSK",
            "product_score": 96.0,
            "manufacturer_score": 100.0,
            "match_score": 97.2,
        }
    ])

    validator = CDSCOValidator(threshold=80, supabase_client=client)
    validator.load_reference(cdsco_data)

    assert validator._all_choices_data == []

    input_df = pd.DataFrame([
        {"brand_name": "Krocin Pain Relief", "manufacturer": "GSK"},
    ])
    validated = validator.validate(input_df, product_col="brand_name", manufacturer_col="manufacturer")

    assert client.calls == [
        (
            "find_cdsco_fuzzy_match",
            {
                "query_brand_name": "krocin pain relief",
                "query_manufacturer": "gsk",
                "match_count": 1,
                "min_similarity": 0.2,
            },
        )
    ]
    assert bool(validated.loc[0, "is_cdsco_verified"])
    assert validated.loc[0, "cdsco_match_score"] == 97.2
    assert validated.loc[0, "matched_cdsco_product"] == "Crocin Pain Relief"
    assert validated.loc[0, "matched_cdsco_manufacturer"] == "GSK"
    assert validated.loc[0, "product_match_score"] == 96.0
    assert validated.loc[0, "manufacturer_match_score"] == 100.0


def test_cdsco_validator_syncs_remote_reference_without_retaining_local_reference_maps():
    cdsco_data = pd.DataFrame(
        [
            {"brand_name": f"Reference Brand {idx}", "firm_name": "Reference Maker"}
            for idx in range(50)
        ]
    )
    client = FakeSupabaseRpcClient()

    validator = CDSCOValidator(threshold=80, supabase_client=client)
    validator.load_reference(cdsco_data)

    assert validator._cdsco_df is None
    assert validator._exact_product_map != {}
    assert validator._first_letter_map != {}
    assert getattr(validator, "_all_choices_data", []) == []
    assert client.table_calls
    assert client.table_calls[0]["table"] == "cdsco_reference"
    assert client.table_calls[0]["on_conflict"] == "brand_name_normalized,firm_name_normalized"
    assert client.table_calls[0]["records"][0] == {
        "brand_name": "Reference Brand 0",
        "firm_name": "Reference Maker",
        "brand_name_normalized": "reference brand 0",
        "firm_name_normalized": "reference maker",
    }


def test_cdsco_validator_does_not_run_local_global_scan_for_empty_rpc_results(monkeypatch):
    cdsco_data = pd.DataFrame([
        {"brand_name": "Crocin Pain Relief", "firm_name": "GSK"},
    ])
    client = FakeSupabaseRpcClient(data=[])

    validator = CDSCOValidator(threshold=80, supabase_client=client)
    validator.load_reference(cdsco_data)

    def fail_if_local_global_scan_runs(_norm_product):
        raise AssertionError("local global fuzzy scan should not run after an empty RPC result")

    monkeypatch.setattr(validator, "_find_local_global_match", fail_if_local_global_scan_runs)

    input_df = pd.DataFrame([
        {"brand_name": "Krocin Pain Relief", "manufacturer": "GSK"},
    ])
    validated = validator.validate(input_df, product_col="brand_name", manufacturer_col="manufacturer")

    assert client.calls
    assert not bool(validated.loc[0, "is_cdsco_verified"])
    assert validated.loc[0, "matched_cdsco_product"] is None


def test_cdsco_validator_uses_local_global_search_after_rpc_failure():
    cdsco_data = pd.DataFrame([
        {"brand_name": "Crocin Pain Relief", "firm_name": "GSK"},
    ])
    client = FakeSupabaseRpcClient(raises=TimeoutError("rpc timed out"))

    validator = CDSCOValidator(threshold=80, supabase_client=client)
    validator.load_reference(cdsco_data)

    input_df = pd.DataFrame([
        {"brand_name": "Krocin Pain Relief", "manufacturer": "GSK"},
    ])
    validated = validator.validate(input_df, product_col="brand_name", manufacturer_col="manufacturer")

    assert client.calls
    assert bool(validated.loc[0, "is_cdsco_verified"])
    assert validated.loc[0, "matched_cdsco_product"] == "Crocin Pain Relief"
    assert validated.loc[0, "matched_cdsco_manufacturer"] == "GSK"


def test_cdsco_validator_uses_local_global_search_without_rpc_client():
    cdsco_data = pd.DataFrame([
        {"brand_name": "Crocin Pain Relief", "firm_name": "GSK"},
    ])

    validator = CDSCOValidator(threshold=80)
    validator.load_reference(cdsco_data)

    input_df = pd.DataFrame([
        {"brand_name": "Krocin Pain Relief", "manufacturer": "GSK"},
    ])
    validated = validator.validate(input_df, product_col="brand_name", manufacturer_col="manufacturer")

    assert bool(validated.loc[0, "is_cdsco_verified"])
    assert validated.loc[0, "matched_cdsco_product"] == "Crocin Pain Relief"
    assert validated.loc[0, "matched_cdsco_manufacturer"] == "GSK"
    assert validator._all_choices_data == []


def test_cdsco_validator_exact_and_fuzzy_matching():
    # Setup mock CDSCO reference dataset
    cdsco_data = pd.DataFrame([
        {"brand_name": "Paracetamol 500", "firm_name": "Cipla Ltd"},
        {"brand_name": "Crocin Paint Relief", "firm_name": "GlaxoSmithKline"},
        {"brand_name": "Aspirin Extra", "firm_name": "Bayer"},
    ])

    validator = CDSCOValidator(threshold=90)
    validator.load_reference(cdsco_data)

    # Test exact product match (with slightly different manufacturer spacing/case)
    input_df = pd.DataFrame([
        # Exact product name match, matching manufacturer
        {"brand_name": "Paracetamol 500", "manufacturer": "Cipla Limited"},
        # Exact product name match, matching manufacturer
        {"brand_name": "Paracetamol 500", "manufacturer": "cipla"},
        # Exact product name match, completely different manufacturer (should result in lower score)
        {"brand_name": "Paracetamol 500", "manufacturer": "Abbott"},
    ])

    validated = validator.validate(input_df, product_col="brand_name", manufacturer_col="manufacturer")

    assert len(validated) == 3
    # Row 0: Exact product match, highly similar manufacturer -> verified
    assert bool(validated.loc[0, "is_cdsco_verified"])
    assert validated.loc[0, "product_match_score"] == 100.0
    assert validated.loc[0, "matched_cdsco_product"] == "Paracetamol 500"
    assert validated.loc[0, "matched_cdsco_manufacturer"] == "Cipla Ltd"

    # Row 1: Exact product match, matching manufacturer (normalized) -> verified
    assert bool(validated.loc[1, "is_cdsco_verified"])
    assert validated.loc[1, "product_match_score"] == 100.0

    # Row 2: Exact product match, bad manufacturer -> not verified
    assert not bool(validated.loc[2, "is_cdsco_verified"])


def test_cdsco_validator_partitioning_fuzzy_matching():
    # Setup mock CDSCO reference dataset
    cdsco_data = pd.DataFrame([
        {"brand_name": "Crocin Pain Relief", "firm_name": "GSK"},
        {"brand_name": "Aspirin Extra", "firm_name": "Bayer"},
    ])

    validator = CDSCOValidator(threshold=80)
    validator.load_reference(cdsco_data)

    # Test fuzzy match with same first letter
    input_df = pd.DataFrame([
        {"brand_name": "Crocin Pain Relif", "manufacturer": "GSK"},
    ])

    validated = validator.validate(input_df, product_col="brand_name", manufacturer_col="manufacturer")
    assert len(validated) == 1
    assert bool(validated.loc[0, "is_cdsco_verified"])
    assert validated.loc[0, "matched_cdsco_product"] == "Crocin Pain Relief"


def test_cdsco_validator_deduplication():
    # Setup mock CDSCO reference dataset
    cdsco_data = pd.DataFrame([
        {"brand_name": "Crocin", "firm_name": "GSK"},
    ])

    validator = CDSCOValidator(threshold=90)
    validator.load_reference(cdsco_data)

    # Test that multiple rows with the same (brand_name, manufacturer) pair are validated correctly
    # and map back the cached values
    input_df = pd.DataFrame([
        {"brand_name": "Crocin", "manufacturer": "GSK", "strength": "100mg"},
        {"brand_name": "Crocin", "manufacturer": "GSK", "strength": "200mg"},
        {"brand_name": "Crocin", "manufacturer": "GSK", "strength": "500mg"},
    ])

    validated = validator.validate(input_df, product_col="brand_name", manufacturer_col="manufacturer")
    assert len(validated) == 3
    for i in range(3):
        assert bool(validated.loc[i, "is_cdsco_verified"])
        assert validated.loc[i, "matched_cdsco_product"] == "Crocin"
        assert validated.loc[i, "matched_cdsco_manufacturer"] == "GSK"
        assert validated.loc[i, "strength"] == f"{(100, 200, 500)[i]}mg"
