"""
SahiDawa — CDSCO Validator
===========================
Migrated from: data/validate_cdsco.py
              data/normalization.py

Fuzzy-matches a normalized medicines DataFrame against the CDSCO
brand-name registry to produce a verification verdict per row.

PIPELINE ROLE:
    validate(df) → same DataFrame with added columns:
        is_cdsco_verified       bool
        cdsco_match_score       float
        matched_cdsco_product   str | None
        matched_cdsco_manufacturer str | None
        product_match_score     float
        manufacturer_match_score float
"""

import re
from string import punctuation

import pandas as pd
from rapidfuzz import fuzz, process

from src.utils.logger import logger


# ── Text normalisation helpers (migrated from data/normalization.py) ───────────

_TRANSLATOR = str.maketrans("", "", punctuation)

_REMOVABLE_TOKENS = {
    "tablet", "tablets", "tab", "capsule", "capsules", "cap",
    "syrup", "suspension", "solution", "inj", "injection",
    "cream", "ointment", "drops", "oral", "ip", "mg", "ml", "gm", "g", "mcg",
}

_CORPORATE_SUFFIXES = {
    "pvt", "pvt.", "private", "limited", "ltd", "ltd.", "inc", "corp",
    "corporation", "pharmaceuticals", "pharma", "labs", "laboratories", "healthcare",
}


def _normalize_text(text) -> str:
    if not text or pd.isna(text):
        return ""
    text = str(text).lower().translate(_TRANSLATOR)
    text = re.sub(r"\b\d+\s?(mg|ml|mcg|g|gm)\b", " ", text)
    tokens = [t for t in text.split() if t not in _REMOVABLE_TOKENS]
    return " ".join(tokens).strip()


def _normalize_manufacturer(text) -> str:
    if not text or pd.isna(text):
        return ""
    text = str(text).lower().translate(_TRANSLATOR)
    tokens = [t for t in text.split() if t not in _CORPORATE_SUFFIXES]
    return " ".join(tokens).strip()


# ── Validator ──────────────────────────────────────────────────────────────────

MATCH_THRESHOLD = 90
PRODUCT_WEIGHT = 0.7
MANUFACTURER_WEIGHT = 0.3


class CDSCOValidator:
    """
    Validates a medicines DataFrame against the CDSCO reference dataset
    using weighted fuzzy matching (70% product name, 30% manufacturer).
    """

    def __init__(self, threshold: int = MATCH_THRESHOLD):
        self.threshold = threshold
        self._cdsco_df: pd.DataFrame | None = None

    def load_reference(self, cdsco_df: pd.DataFrame) -> None:
        """
        Pre-load and normalise the CDSCO reference DataFrame.

        Expected columns: brand_name, firm_name
        """
        required = {"brand_name", "firm_name"}
        missing = required - set(cdsco_df.columns)
        if missing:
            raise ValueError(f"[Validator] Missing columns in CDSCO reference: {missing}")

        df = cdsco_df.fillna("").copy()
        df["_norm_product"] = df["brand_name"].apply(_normalize_text)
        df["_norm_manufacturer"] = df["firm_name"].apply(_normalize_manufacturer)
        df = df.drop_duplicates(subset=["_norm_product", "_norm_manufacturer"])
        self._cdsco_df = df
        logger.info(f"[Validator] Loaded {len(df)} CDSCO reference rows")

    def validate(self, df: pd.DataFrame, product_col: str, manufacturer_col: str) -> pd.DataFrame:
        """
        Validate each row in df against the loaded CDSCO reference.

        Args:
            df:               Input medicines DataFrame
            product_col:      Column name for the product/brand name
            manufacturer_col: Column name for the manufacturer

        Returns:
            df with six additional verification columns appended.
        """
        if self._cdsco_df is None:
            raise RuntimeError("[Validator] Call load_reference() before validate().")

        logger.info(f"[Validator] Validating {len(df)} rows against CDSCO reference...")
        results = [self._validate_row(row, product_col, manufacturer_col) for _, row in df.iterrows()]
        validated = pd.DataFrame(results)

        verified_count = validated["is_cdsco_verified"].sum()
        logger.info(f"[Validator] Done — {verified_count}/{len(validated)} verified")
        return validated

    # ── Private ────────────────────────────────────────────────────────────────

    def _validate_row(self, row: pd.Series, product_col: str, manufacturer_col: str) -> dict:
        result = row.to_dict()
        match_data, score = self._find_best_match(
            str(row.get(product_col, "")),
            str(row.get(manufacturer_col, "")),
        )
        result["is_cdsco_verified"] = score >= self.threshold
        result["cdsco_match_score"] = round(score, 2)
        result["matched_cdsco_product"] = match_data["matched_product"] if match_data else None
        result["matched_cdsco_manufacturer"] = match_data["matched_manufacturer"] if match_data else None
        result["product_match_score"] = match_data["product_score"] if match_data else 0
        result["manufacturer_match_score"] = match_data["manufacturer_score"] if match_data else 0
        return result

    def _find_best_match(self, product_name: str, manufacturer: str) -> tuple[dict | None, float]:
        norm_product = _normalize_text(product_name)
        norm_manufacturer = _normalize_manufacturer(manufacturer)

        if not norm_product:
            return None, 0.0

        choices = self._cdsco_df["_norm_product"].tolist()
        product_match = process.extractOne(norm_product, choices, scorer=fuzz.token_sort_ratio)
        if not product_match:
            return None, 0.0

        _, product_score, idx = product_match
        cdsco_row = self._cdsco_df.iloc[idx]
        manufacturer_score = fuzz.token_sort_ratio(norm_manufacturer, cdsco_row["_norm_manufacturer"])
        final_score = PRODUCT_WEIGHT * product_score + MANUFACTURER_WEIGHT * manufacturer_score

        return {
            "matched_product": cdsco_row["brand_name"],
            "matched_manufacturer": cdsco_row["firm_name"],
            "product_score": round(product_score, 2),
            "manufacturer_score": round(manufacturer_score, 2),
        }, final_score
