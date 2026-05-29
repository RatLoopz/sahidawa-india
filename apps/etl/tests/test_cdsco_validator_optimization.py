import sys
from pathlib import Path
import pandas as pd
import pytest

# Ensure src.* imports resolve when running pytest from apps/etl/
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.validators.cdsco_validator import CDSCOValidator


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
