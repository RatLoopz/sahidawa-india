"""
SahiDawa — Commercial MRP Normalizer & Merger
=============================================
INPUT:  Raw CSV from commercial_mrp scraper + processed Jan Aushadhi data
OUTPUT: Clean DataFrame with MRP column populated from commercial sources
"""

import re
import pandas as pd
from pathlib import Path


PROCESSED_DIR = Path(__file__).resolve().parents[3] / "data" / "processed"
RAW_DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "raw" / "commercial_mrp"

STRENGTH_PATTERN = re.compile(r"(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?|%)", re.IGNORECASE)


class CommercialMRPNormalizer:
    """Normalizes commercial MRP data and merges with Jan Aushadhi medicines."""

    def normalize(self, raw_csv_path: Path) -> pd.DataFrame:
        print(f"[CommercialNormalizer] Reading: {raw_csv_path}")
        df = pd.read_csv(raw_csv_path)
        print(f"[CommercialNormalizer] Loaded {len(df)} raw records")

        if len(df) == 0:
            return df

        if "generic_name" in df.columns:
            df["generic_name"] = df["generic_name"].str.strip()
        if "brand_name" in df.columns:
            df["brand_name"] = df["brand_name"].str.strip()
        if "composition" in df.columns:
            df["composition"] = df["composition"].fillna("")

        df["strength"] = df.apply(
            lambda row: self._normalize_strength(row.get("strength") or row.get("composition")), axis=1
        )
        df["mrp"] = pd.to_numeric(df["mrp"], errors="coerce")

        before = len(df)
        df = df.dropna(subset=["mrp"])
        print(f"[CommercialNormalizer] Dropped {before - len(df)} rows without MRP")
        print(f"[CommercialNormalizer] ✅ {len(df)} clean records")
        return df

    def _normalize_strength(self, text: str | None) -> str | None:
        if not text:
            return None
        matches = STRENGTH_PATTERN.findall(text)
        if not matches:
            return None
        return " + ".join(f"{val}{unit}" for val, unit in matches)

    def merge_with_janaushadhi(self, commercial_df: pd.DataFrame, janaushadhi_df: pd.DataFrame) -> pd.DataFrame:
        print(f"[CommercialNormalizer] Merging {len(commercial_df)} commercial with {len(janaushadhi_df)} Jan Aushadhi")

        if "mrp" not in janaushadhi_df.columns:
            janaushadhi_df["mrp"] = None

        commercial_lookup = {}
        for _, row in commercial_df.iterrows():
            key = (row.get("generic_name"), row.get("strength"))
            if key[0] and row.get("mrp"):
                if key not in commercial_lookup:
                    commercial_lookup[key] = []
                commercial_lookup[key].append(row["mrp"])

        avg_mrp_lookup = {key: sum(vals) / len(vals) for key, vals in commercial_lookup.items()}

        matched = 0
        for idx, row in janaushadhi_df.iterrows():
            key = (row.get("generic_name"), row.get("strength"))
            if key in avg_mrp_lookup:
                janaushadhi_df.at[idx, "mrp"] = avg_mrp_lookup[key]
                matched += 1

        print(f"[CommercialNormalizer] ✅ Matched {matched} MRP values")
        janaushadhi_df["mrp_source"] = janaushadhi_df["mrp"].apply(lambda x: "commercial_1mg" if pd.notna(x) else None)
        return janaushadhi_df


def normalize_latest():
    raw_files = sorted(RAW_DATA_DIR.glob("commercial_mrp_raw_*.csv"))
    if not raw_files:
        print("[CommercialNormalizer] ❌ No raw CSV found. Run scraper first.")
        return None

    latest = raw_files[-1]
    print(f"[CommercialNormalizer] Using: {latest.name}")
    normalizer = CommercialMRPNormalizer()
    df = normalizer.normalize(latest)

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PROCESSED_DIR / "commercial_mrp_processed.csv"
    df.to_csv(output_path, index=False)
    print(f"[CommercialNormalizer] ✅ Processed: {output_path}")
    return df


if __name__ == "__main__":
    normalize_latest()