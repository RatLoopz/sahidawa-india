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
from typing import Any

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
CDSCO_FUZZY_RPC = "find_cdsco_fuzzy_match"
CDSCO_FUZZY_RPC_MATCH_COUNT = 1
CDSCO_FUZZY_RPC_MIN_SIMILARITY = 0.2
CDSCO_REFERENCE_TABLE = "cdsco_reference"
CDSCO_REFERENCE_BATCH_SIZE = 500


class CDSCOValidator:
    """
    Validates a medicines DataFrame against the CDSCO reference dataset
    using weighted fuzzy matching (70% product name, 30% manufacturer).
    """

    def __init__(
        self,
        threshold: int = MATCH_THRESHOLD,
        supabase_client: Any | None = None,
        rpc_min_similarity: float = CDSCO_FUZZY_RPC_MIN_SIMILARITY,
    ):
        self.threshold = threshold
        self._supabase_client = supabase_client
        self._rpc_min_similarity = rpc_min_similarity
        self._rpc_disabled = False
        self._reference_loaded = False
        self._remote_reference_loaded = False
        self._cdsco_df: pd.DataFrame | None = None
        self._exact_product_map = {}
        self._first_letter_map = {}
        self._all_choices_data = []

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

        self._reset_reference_state()

        if self._supabase_client is not None:
            try:
                self._sync_reference_to_supabase(df)
                self._reference_loaded = True
                self._remote_reference_loaded = True
                logger.info(
                    f"[Validator] Synced {len(df)} CDSCO reference rows to Supabase "
                    "and will use RPC-backed matching"
                )
                self._load_local_reference(df, skip_global_cache=True)
                return
            except Exception as exc:
                self._disable_rpc_fallback(exc)
                logger.warning("[Validator] Falling back to local CDSCO reference indexes")

        self._load_local_reference(df, skip_global_cache=False)

    def _reset_reference_state(self) -> None:
        self._reference_loaded = False
        self._remote_reference_loaded = False
        self._cdsco_df = None
        self._exact_product_map = {}
        self._first_letter_map = {}
        self._all_choices_data = []

    def _sync_reference_to_supabase(self, df: pd.DataFrame) -> None:
        records = []

        for _, row in df.iterrows():
            norm_product = row["_norm_product"]
            if not norm_product:
                continue

            records.append(
                {
                    "brand_name": str(row["brand_name"]).strip(),
                    "firm_name": str(row["firm_name"]).strip(),
                    "brand_name_normalized": norm_product,
                    "firm_name_normalized": row["_norm_manufacturer"],
                }
            )

        for start in range(0, len(records), CDSCO_REFERENCE_BATCH_SIZE):
            batch = records[start:start + CDSCO_REFERENCE_BATCH_SIZE]
            response = (
                self._supabase_client
                .table(CDSCO_REFERENCE_TABLE)
                .upsert(
                    batch,
                    on_conflict="brand_name_normalized,firm_name_normalized",
                )
                .execute()
            )
            error = getattr(response, "error", None)
            if error:
                raise RuntimeError(error)

    def _load_local_reference(self, df: pd.DataFrame, skip_global_cache: bool = False) -> None:
        if not skip_global_cache:
            self._cdsco_df = df
        else:
            self._cdsco_df = None

        # Build optimized lookup structures
        for _, row in df.iterrows():
            norm_p = row["_norm_product"]
            norm_m = row["_norm_manufacturer"]

            # Exact match map
            if norm_p not in self._exact_product_map:
                self._exact_product_map[norm_p] = []
            self._exact_product_map[norm_p].append({
                "brand_name": row["brand_name"],
                "firm_name": row["firm_name"],
                "norm_m": norm_m
            })

            # First letter map for partitioning search space and RPC fallback.
            if norm_p:
                first_char = norm_p[0]
                if first_char not in self._first_letter_map:
                    self._first_letter_map[first_char] = []
                entry = {
                    "brand_name": row["brand_name"],
                    "firm_name": row["firm_name"],
                    "norm_p": norm_p,
                    "norm_m": norm_m
                }

                self._first_letter_map[first_char].append(entry)

        self._reference_loaded = True
        logger.info(f"[Validator] Loaded {len(df)} CDSCO reference rows and built lookup indexes")

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
        if not self._reference_loaded:
            raise RuntimeError("[Validator] Call load_reference() before validate().")

        logger.info(f"[Validator] Validating {len(df)} rows against CDSCO reference...")

        # 1. Deduplicate by product and manufacturer
        unique_pairs = df[[product_col, manufacturer_col]].drop_duplicates()
        logger.info(f"[Validator] Found {len(unique_pairs)} unique product-manufacturer pairs (reduced from {len(df)} total rows)")

        # 2. Validate unique pairs and cache
        cache = {}
        for _, row in unique_pairs.iterrows():
            prod = str(row[product_col])
            manuf = str(row[manufacturer_col])
            cache_key = (prod, manuf)

            match_data, score = self._find_best_match_optimized(prod, manuf)
            cache[cache_key] = {
                "is_cdsco_verified": score >= self.threshold,
                "cdsco_match_score": round(score, 2),
                "matched_cdsco_product": match_data["matched_product"] if match_data else None,
                "matched_cdsco_manufacturer": match_data["matched_manufacturer"] if match_data else None,
                "product_match_score": match_data["product_score"] if match_data else 0,
                "manufacturer_match_score": match_data["manufacturer_score"] if match_data else 0,
            }

        # 3. Map back to original rows
        results = []
        for _, row in df.iterrows():
            prod = str(row.get(product_col, ""))
            manuf = str(row.get(manufacturer_col, ""))
            val_res = cache.get((prod, manuf))

            row_dict = row.to_dict()
            if val_res:
                row_dict.update(val_res)
            else:
                row_dict.update({
                    "is_cdsco_verified": False,
                    "cdsco_match_score": 0.0,
                    "matched_cdsco_product": None,
                    "matched_cdsco_manufacturer": None,
                    "product_match_score": 0,
                    "manufacturer_match_score": 0,
                })
            results.append(row_dict)

        validated = pd.DataFrame(results)
        verified_count = validated["is_cdsco_verified"].sum()
        logger.info(f"[Validator] Done — {verified_count}/{len(validated)} verified")
        return validated

    # ── Private ────────────────────────────────────────────────────────────────

    def _validate_row(self, row: pd.Series, product_col: str, manufacturer_col: str) -> dict:
        result = row.to_dict()
        match_data, score = self._find_best_match_optimized(
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
        # Legacy method kept for backward compatibility/testing
        return self._find_best_match_optimized(product_name, manufacturer)

    def _find_best_match_optimized(self, product_name: str, manufacturer: str) -> tuple[dict | None, float]:
        norm_product = _normalize_text(product_name)
        norm_manufacturer = _normalize_manufacturer(manufacturer)

        if not norm_product:
            return None, 0.0

        # 1. Exact match lookup (checks if product name matches exactly)
        if norm_product in self._exact_product_map:
            candidates = self._exact_product_map[norm_product]
            best_cand = None
            best_score = -1.0
            for cand in candidates:
                # Compare manufacturer
                m_score = fuzz.token_sort_ratio(norm_manufacturer, cand["norm_m"])
                # Exact product match score is 100
                final_score = PRODUCT_WEIGHT * 100.0 + MANUFACTURER_WEIGHT * m_score
                if final_score > best_score:
                    best_score = final_score
                    best_cand = {
                        "matched_product": cand["brand_name"],
                        "matched_manufacturer": cand["firm_name"],
                        "product_score": 100.0,
                        "manufacturer_score": round(m_score, 2),
                    }
            if best_score >= self.threshold:
                return best_cand, best_score

        # 2. Fuzzy match lookup using first-letter partition (fast path)
        first_char = norm_product[0]
        choices_data = self._first_letter_map.get(first_char, [])

        product_match = None

        if choices_data:
            choices = [c["norm_p"] for c in choices_data]
            product_match = process.extractOne(
                norm_product,
                choices,
                scorer=fuzz.token_sort_ratio
            )

        # 3. Fallback global search when partition lookup fails
        if (
            not product_match
            or product_match[1] < self.threshold
        ):
            if self._supabase_client is not None and not self._rpc_disabled:
                rpc_match = self._find_rpc_global_match(norm_product, norm_manufacturer)
                if rpc_match:
                    return rpc_match

                if not self._rpc_disabled:
                    return None, 0.0

            local_match = self._find_local_global_match(norm_product)
            if not local_match:
                return None, 0.0

            cdsco_cand, product_score = local_match

        else:
            _, product_score, idx = product_match
            cdsco_cand = choices_data[idx]

        manufacturer_score = fuzz.token_sort_ratio(
            norm_manufacturer,
            cdsco_cand["norm_m"]
        )

        final_score = (
            PRODUCT_WEIGHT * product_score
            + MANUFACTURER_WEIGHT * manufacturer_score
        )

        return {
            "matched_product": cdsco_cand["brand_name"],
            "matched_manufacturer": cdsco_cand["firm_name"],
            "product_score": round(product_score, 2),
            "manufacturer_score": round(manufacturer_score, 2),
        }, final_score

    def _find_rpc_global_match(
        self,
        norm_product: str,
        norm_manufacturer: str,
    ) -> tuple[dict | None, float] | None:
        if self._supabase_client is None or self._rpc_disabled:
            return None

        params = {
            "query_brand_name": norm_product,
            "query_manufacturer": norm_manufacturer,
            "match_count": CDSCO_FUZZY_RPC_MATCH_COUNT,
            "min_similarity": self._rpc_min_similarity,
        }

        try:
            response = self._supabase_client.rpc(CDSCO_FUZZY_RPC, params).execute()
        except Exception as exc:  # Supabase raises for missing RPCs/network failures.
            self._disable_rpc_fallback(exc)
            return None

        error = getattr(response, "error", None)
        if error:
            self._disable_rpc_fallback(error)
            return None

        data = getattr(response, "data", None) or []
        if isinstance(data, dict):
            rows = [data]
        else:
            rows = list(data)

        if not rows:
            return None

        row = rows[0]
        product_score = self._coerce_score(row.get("product_score"))
        manufacturer_score = self._coerce_score(row.get("manufacturer_score"))
        final_score = self._coerce_score(
            row.get("match_score"),
            PRODUCT_WEIGHT * product_score + MANUFACTURER_WEIGHT * manufacturer_score,
        )

        return {
            "matched_product": row.get("brand_name"),
            "matched_manufacturer": row.get("manufacturer"),
            "product_score": round(product_score, 2),
            "manufacturer_score": round(manufacturer_score, 2),
        }, final_score

    def _find_local_global_match(self, norm_product: str) -> tuple[dict, float] | None:
        best_cand = None
        best_score = -1.0

        for choices_data in self._first_letter_map.values():
            for cand in choices_data:
                score = fuzz.token_sort_ratio(norm_product, cand["norm_p"])
                if score > best_score:
                    best_score = score
                    best_cand = cand

        if best_cand is None:
            return None

        return best_cand, best_score

    def _disable_rpc_fallback(self, error: object) -> None:
        self._rpc_disabled = True
        fallback_note = (
            "using local fallback for remaining validations"
            if self._first_letter_map
            else "remote CDSCO fallback will return no matches until RPC is available"
        )
        logger.warning(
            f"[Validator] CDSCO Supabase RPC fallback unavailable ({error}); {fallback_note}"
        )

    @staticmethod
    def _coerce_score(value: object, default: float = 0.0) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return float(default)
