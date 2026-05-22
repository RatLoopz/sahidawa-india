"""
SahiDawa — Jan Aushadhi Data Normalizer
=========================================
INPUT:  Raw CSV from Jan Aushadhi website
OUTPUT: Clean pandas DataFrame (and optionally saves to data/processed/)

WHY A SEPARATE NORMALIZER FILE?
    The scraper's job is to "get data" — nothing else.
    The normalizer's job is to "clean data" — nothing else.
    The loader's job is to "save data" — nothing else.
    
    This separation (Single Responsibility Principle) means:
    - If Jan Aushadhi changes their CSV format → only update the normalizer
    - If Supabase schema changes → only update the loader
    - Each piece is testable independently

WHAT RAW JAN AUSHADHI DATA LOOKS LIKE:
    Sr.No | Drug Code | Generic Name                          | Unit Size | MRP  | Group Name
    1     | 1         | Aceclofenac 100mg and Paracetamol ... | 10's      | 9.38 | Analgesic/Antipyretic

WHAT WE WANT AFTER NORMALIZATION:
    generic_name  = "Aceclofenac + Paracetamol"   (cleaned, no dosage)
    strength      = "Aceclofenac 100mg + Paracetamol 325mg"  (extracted)
    dosage_form   = "Tablet"  (inferred from unit size / group)
    schedule      = "H"  (inferred from drug category)
    source        = "janaushadhi"
    cdsco_approval_status = "approved"  (all Jan Aushadhi drugs are govt approved)
"""

import re
import pandas as pd
from pathlib import Path


# ── Constants ──────────────────────────────────────────────────────────────────

PROCESSED_DIR = Path(__file__).resolve().parents[3] / "data" / "processed"


# ── Category → Schedule Mapping ───────────────────────────────────────────────
# Jan Aushadhi groups medicines by therapeutic category.
# We map these to India's drug scheduling system:
#   Schedule H  = Prescription only
#   Schedule H1 = Controlled (psychotropic, antibiotics, etc.)
#   OTC         = Over The Counter (no prescription needed)
#   Schedule X  = Narcotic / highly controlled

CATEGORY_SCHEDULE_MAP = {
    # Prescription (Schedule H) categories
    "analgesic":          "H",
    "antipyretic":        "H",
    "antibiotic":         "H",
    "anti-infective":     "H",
    "antihypertensive":   "H",
    "antidiabetic":       "H",
    "cardiovascular":     "H",
    "gastro":             "H",
    "respiratory":        "H",
    "neurological":       "H",
    "central nervous":    "H",
    "hormonal":           "H",
    "endocrine":          "H",
    "renal":              "H",
    "hepatic":            "H",
    "ophthalmic":         "H",
    "ent":                "H",
    "dental":             "H",
    "oncology":           "H",
    "immunosuppressant":  "H",
    
    # Controlled (Schedule H1)
    "antipsychotic":      "H1",
    "antidepressant":     "H1",
    "anxiolytic":         "H1",
    "sedative":           "H1",
    
    # OTC categories
    "vitamin":            "OTC",
    "mineral":            "OTC",
    "supplement":         "OTC",
    "antacid":            "OTC",
    "laxative":           "OTC",
    "surgical":           "OTC",
    "diagnostic":         "OTC",
    "medical device":     "OTC",
}


# ── Dosage Form Inference ─────────────────────────────────────────────────────
# Jan Aushadhi's Unit Size column hints at the dosage form:
#   "10's"   → Tablet (10 tablets per strip)
#   "100ml"  → Syrup/Liquid
#   "1 unit" → Injectable or Single-use device

UNIT_SIZE_FORM_MAP = [
    (r"\d+'s",          "Tablet"),      # "10's", "30's" → Tablet
    (r"\d+\s*ml",       "Liquid"),      # "100ml", "60 ml" → Liquid
    (r"\d+\s*mg",       "Tablet"),      # "500mg" directly listed → Tablet
    (r"1\s*unit",       "Injectable"),  # "1 unit" → Injectable (vials etc.)
    (r"tube",           "Ointment"),    # "1 tube" → Ointment/Cream
    (r"drop",           "Eye Drop"),    # "10ml drops" → Eye Drop
    (r"inhaler",        "Inhaler"),     # "1 inhaler" → Inhaler
    (r"patch",          "Patch"),       # "patch" → Transdermal Patch
    (r"sachet",         "Sachet"),      # "sachet" → Powder Sachet
    (r"strip",          "Tablet"),      # "1 strip" → Tablet (same as "10's")
    (r"capsule",        "Capsule"),     # "10 capsules" → Capsule
]


# ── Strength Extraction ───────────────────────────────────────────────────────
# Example inputs from the Generic Name column:
#   "Paracetamol 500mg Tablets"  → strength = "500mg"
#   "Amoxicillin 250mg + Clavulanic Acid 125mg" → strength = "250mg + 125mg"
STRENGTH_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?|%)",
    re.IGNORECASE
)


# ── Main Normalizer Class ─────────────────────────────────────────────────────

class JanAushadhiNormalizer:
    """
    Transforms raw Jan Aushadhi CSV data into a clean DataFrame
    that matches the SahiDawa medicines table schema.
    """

    def normalize(self, raw_csv_path: Path) -> pd.DataFrame:
        """
        Main entry point. Reads raw CSV, cleans it, returns clean DataFrame.
        
        Args:
            raw_csv_path: Path to the raw CSV downloaded by the scraper
            
        Returns:
            pd.DataFrame with columns matching the medicines table schema
        """
        print(f"[Normalizer] Reading raw CSV: {raw_csv_path}")
        
        # ── Step 1: Load raw CSV ───────────────────────────────────────────────
        # Jan Aushadhi CSV columns: Sr.No, Drug Code, Generic Name, Unit Size, MRP, Group Name
        df = pd.read_csv(raw_csv_path, encoding="utf-8-sig")  
        # utf-8-sig handles the BOM (Byte Order Mark) that some govt CSVs have
        
        print(f"[Normalizer] Loaded {len(df)} raw records")
        print(f"[Normalizer] Columns found: {list(df.columns)}")
        
        if len(df) == 0:
            print("[Normalizer] ⚠️ Warning: The raw CSV contains 0 records (only headers).")
            print("[Normalizer] Skipping normalization. Please check the scraper step.")
            return df

        # ── Step 2: Standardize column names ──────────────────────────────────
        # Different govt CSV exports use different header names.
        # We map them all to standard internal names.
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        
        # Rename to known internal names
        # ACTUAL headers from Jan Aushadhi CSV (verified from downloaded file):
        # "Sr No", "Drug Code", "Generic Name", "Unit Size", "MRP", "Group Name"
        column_renames = {
            "sr no":        "row_num",
            "sr.no":        "row_num",
            "sr_no":        "row_num",
            "drug code":    "drug_code",
            "drug_code":    "drug_code",
            "generic name": "raw_name",
            "generic_name": "raw_name",
            "unit size":    "unit_size",
            "unit_size":    "unit_size",
            "mrp":          "mrp",
            "mrp_(rs.)":    "mrp",
            "group name":   "group_name",
            "group_name":   "group_name",
        }
        df = df.rename(columns={k: v for k, v in column_renames.items() if k in df.columns})
        
        # ── Step 3: Drop rows with missing critical fields ────────────────────
        before = len(df)
        df = df.dropna(subset=["raw_name"])
        df["raw_name"] = df["raw_name"].str.strip()
        df = df[df["raw_name"] != ""]
        print(f"[Normalizer] Dropped {before - len(df)} rows with empty names")
        
        # ── Step 4: Extract strength from the generic name ────────────────────
        # "Paracetamol 650mg Tablets" → strength="650mg"
        df["strength"] = df["raw_name"].apply(self._extract_strength)
        
        # ── Step 5: Clean generic name (remove dosage and form text) ──────────
        # "Paracetamol 650mg Tablets IP" → "Paracetamol"
        df["generic_name"] = df["raw_name"].apply(self._clean_generic_name)
        
        # ── Step 6: Infer dosage form from unit size ───────────────────────────
        unit_col = "unit_size" if "unit_size" in df.columns else None
        if unit_col:
            df["dosage_form"] = df[unit_col].apply(self._infer_dosage_form)
        else:
            df["dosage_form"] = None
            
        # Also check the generic name for form hints (e.g., "Syrup", "Capsule")
        df["dosage_form"] = df.apply(
            lambda row: self._infer_form_from_name(row["raw_name"]) or row.get("dosage_form"),
            axis=1
        )
        
        # ── Step 7: Infer drug schedule from category ──────────────────────────
        group_col = "group_name" if "group_name" in df.columns else None
        if group_col:
            df["schedule"] = df[group_col].apply(self._infer_schedule)
        else:
            df["schedule"] = "H"  # Default to prescription if unknown
        
        # ── Step 8: Add fixed fields ───────────────────────────────────────────
        df["brand_name"] = None          # Jan Aushadhi only has generics, no brand names
        df["manufacturer"] = "PMBI"      # Pradhan Mantri Bhartiya Jan Aushadhi Pariyojana
        df["cdsco_approval_status"] = "approved"  # All Jan Aushadhi drugs are govt approved
        df["is_counterfeit_alert"] = False
        df["source"] = "janaushadhi"
        df["barcode_id"] = None          # Jan Aushadhi doesn't provide barcodes
        
        # ── Step 9: Select and order final columns ────────────────────────────
        output_cols = [
            "brand_name",
            "generic_name",
            "manufacturer",
            "strength",
            "dosage_form",
            "schedule",
            "cdsco_approval_status",
            "is_counterfeit_alert",
            "source",
            "barcode_id",
        ]
        result = df[output_cols].copy()
        
        # ── Step 10: Deduplicate ───────────────────────────────────────────────
        # Remove rows where generic_name + strength + dosage_form are identical
        before = len(result)
        result = result.drop_duplicates(subset=["generic_name", "strength", "dosage_form"])
        print(f"[Normalizer] Removed {before - len(result)} duplicate entries")
        print(f"[Normalizer] ✅ Final clean records: {len(result)}")
        
        return result

    # ── Private Helper Methods ─────────────────────────────────────────────────

    def _extract_strength(self, name: str) -> str | None:
        """
        Extracts all dosage strengths from a medicine name.
        
        Examples:
            "Paracetamol 650mg Tablets" → "650mg"
            "Amoxicillin 500mg + Clavulanic Acid 125mg" → "500mg + 125mg"
            "Vitamin C" → None
        """
        matches = STRENGTH_PATTERN.findall(name)
        if not matches:
            return None
        # Combine all matches: [('500', 'mg'), ('125', 'mg')] → "500mg + 125mg"
        return " + ".join(f"{val}{unit}" for val, unit in matches)

    def _clean_generic_name(self, name: str) -> str:
        """
        Removes dosage info and form words from a generic name.
        
        Examples:
            "Paracetamol 650mg Tablets IP" → "Paracetamol"
            "Amoxicillin 500mg + Clavulanic Acid 125mg" → "Amoxicillin + Clavulanic Acid"
        """
        # Remove dosage numbers and units
        cleaned = STRENGTH_PATTERN.sub("", name)
        
        # Remove common form keywords (these are already captured in dosage_form)
        form_words = [
            r"\btablets?\b", r"\bcapsules?\b", r"\bsyrup\b", r"\binjection\b",
            r"\binfusion\b", r"\bointment\b", r"\bcream\b", r"\bdrops?\b",
            r"\binhaler\b", r"\bpatch\b", r"\bsolution\b", r"\bsuspension\b",
            r"\bpowder\b", r"\bsachet\b", r"\bip\b", r"\bbp\b", r"\busp\b",
            r"\bgel\b", r"\blotion\b", r"\bspray\b", r"\bpaste\b",
        ]
        for word in form_words:
            cleaned = re.sub(word, "", cleaned, flags=re.IGNORECASE)
        
        # Clean up extra spaces and punctuation
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,+&")
        
        return cleaned or name  # Return original if cleaning removed everything

    def _infer_dosage_form(self, unit_size: str) -> str | None:
        """
        Infers dosage form from Jan Aushadhi's Unit Size column.
        
        Examples:
            "10's" → "Tablet"
            "100ml" → "Liquid"
            "1 unit" → "Injectable"
        """
        if pd.isna(unit_size):
            return None
        unit_lower = str(unit_size).lower().strip()
        for pattern, form in UNIT_SIZE_FORM_MAP:
            if re.search(pattern, unit_lower, re.IGNORECASE):
                return form
        return None

    def _infer_form_from_name(self, name: str) -> str | None:
        """
        Infers dosage form from keywords in the generic name itself.
        
        Examples:
            "Paracetamol 650mg Tablets" → "Tablet"
            "Amoxicillin Syrup" → "Liquid"
        """
        name_lower = name.lower()
        if "tablet" in name_lower:    return "Tablet"
        if "capsule" in name_lower:   return "Capsule"
        if "syrup" in name_lower:     return "Liquid"
        if "injection" in name_lower: return "Injectable"
        if "drop" in name_lower:      return "Eye Drop"
        if "ointment" in name_lower:  return "Ointment"
        if "cream" in name_lower:     return "Cream"
        if "gel" in name_lower:       return "Gel"
        if "inhaler" in name_lower:   return "Inhaler"
        if "suspension" in name_lower:return "Liquid"
        if "solution" in name_lower:  return "Liquid"
        return None

    def _infer_schedule(self, category: str) -> str:
        """
        Maps Jan Aushadhi's therapeutic category to India's drug schedule.
        
        Examples:
            "Analgesic/Antipyretic" → "H"
            "Vitamins & Minerals" → "OTC"
            "Antipsychotic" → "H1"
        """
        if pd.isna(category):
            return "H"  # Default to prescription if category unknown
        cat_lower = category.lower()
        for keyword, schedule in CATEGORY_SCHEDULE_MAP.items():
            if keyword in cat_lower:
                return schedule
        return "H"  # Default: prescription-only


# ── Runner ────────────────────────────────────────────────────────────────────

def normalize_latest():
    """
    Convenience function: finds the most recent raw CSV and normalizes it.
    Saves the processed output to data/processed/janaushadhi_processed.csv
    """
    raw_dir = Path(__file__).resolve().parents[3] / "data" / "raw" / "janaushadhi"
    raw_files = sorted(raw_dir.glob("janaushadhi_raw_*.csv"))
    
    if not raw_files:
        print("[Normalizer] ❌ No raw CSV found. Run the scraper first.")
        return None
    
    latest = raw_files[-1]  # Most recent file
    print(f"[Normalizer] Using latest raw file: {latest.name}")
    
    normalizer = JanAushadhiNormalizer()
    df = normalizer.normalize(latest)
    
    # Save processed output
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PROCESSED_DIR / "janaushadhi_processed.csv"
    df.to_csv(output_path, index=False)
    print(f"[Normalizer] ✅ Processed data saved to: {output_path}")
    
    return df


if __name__ == "__main__":
    normalize_latest()
