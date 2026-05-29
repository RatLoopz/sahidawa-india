"""
SahiDawa — Commercial Medicine Scraper + Normalizer
===================================================
Fetches commercial medicine data from the public Indian Medicine Dataset repository,
normalizes it, and maps it to our medicines table schema.
"""

import hashlib
import os
import re
from pathlib import Path
import pandas as pd
import requests

from src.utils.logger import logger

DATASET_URL = "https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/main/DATA/indian_medicine_data.csv"
RAW_DATA_DIR = Path(__file__).resolve().parents[4] / "data" / "raw" / "commercial"

class CommercialMedicineScraper:
    """
    Downloads the open-source Indian Medicine Dataset CSV.
    """

    def __init__(self):
        RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)

    def scrape(self, force: bool = False) -> Path:
        save_path = RAW_DATA_DIR / "indian_medicine_data.csv"
        if save_path.exists() and not force:
            logger.info(f"[CommercialScraper] Local dataset already exists at {save_path} — skipping download.")
            return save_path

        logger.info(f"[CommercialScraper] Downloading commercial medicine database from {DATASET_URL}...")
        try:
            response = requests.get(DATASET_URL, timeout=60)
            response.raise_for_status()
            with open(save_path, "wb") as f:
                f.write(response.content)
            logger.info(f"[CommercialScraper] Downloaded successfully and saved to {save_path} ({save_path.stat().st_size / 1024 / 1024:.2f} MB)")
            return save_path
        except Exception as e:
            if save_path.exists():
                logger.warning(f"[CommercialScraper] Download failed: {e}. Falling back to existing local file.")
                return save_path
            raise e


class CommercialMedicineNormalizer:
    """
    Normalizes the raw commercial CSV into a DataFrame matching our Supabase schema.
    """

    def normalize(self, raw_csv_path: Path) -> pd.DataFrame:
        logger.info(f"[CommercialNormalizer] Reading raw CSV from {raw_csv_path}")
        df = pd.read_csv(raw_csv_path, encoding="utf-8")
        logger.info(f"[CommercialNormalizer] Loaded {len(df)} records. Columns: {list(df.columns)}")

        # Drop rows that don't have a name
        df = df.dropna(subset=["name"])
        df["name"] = df["name"].str.strip()
        df = df[df["name"] != ""]

        df["brand_name"] = df["name"]
        df["manufacturer"] = df["manufacturer_name"].fillna("Unknown Manufacturer").str.strip()

        # Build clean composition string
        def combine_compositions(row):
            comp1 = str(row["short_composition1"]).strip() if pd.notna(row["short_composition1"]) else ""
            comp2 = str(row["short_composition2"]).strip() if pd.notna(row["short_composition2"]) else ""
            if comp1 and comp2:
                return f"{comp1} + {comp2}"
            return comp1 or comp2 or "Unknown Composition"

        df["composition"] = df.apply(combine_compositions, axis=1)

        # Parse generic name by extracting clean chemical names (removing numbers/units)
        def extract_generic_name(comp):
            parts = comp.split("+")
            cleaned_parts = []
            for part in parts:
                # Remove numbers and units like mg, mcg, ml, g, %, etc.
                cleaned = re.sub(r"\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|units?|%)", "", part, flags=re.IGNORECASE)
                cleaned = cleaned.strip()
                if cleaned:
                    cleaned_parts.append(cleaned)
            return " + ".join(cleaned_parts) if cleaned_parts else comp

        df["generic_name"] = df["composition"].apply(extract_generic_name)

        # Parse MRP
        price_col = "price(₹)" if "price(₹)" in df.columns else "price"
        if price_col in df.columns:
            df["mrp"] = pd.to_numeric(df[price_col], errors="coerce").fillna(0.0)
        else:
            df["mrp"] = 0.0

        # Filter out discontinued items
        if "Is_discontinued" in df.columns:
            df = df[df["Is_discontinued"] != True]

        df["cdsco_approval_status"] = "approved"
        df["is_counterfeit_alert"] = False
        df["source"] = "commercial"
        df["jan_aushadhi_price"] = None

        # Extract strength
        strength_pattern = re.compile(
            r"(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?|%)",
            re.IGNORECASE,
        )
        def _extract_strength(name: str) -> str | None:
            matches = strength_pattern.findall(name)
            return " + ".join(f"{val}{unit}" for val, unit in matches) if matches else None

        df["strength"] = df["composition"].apply(_extract_strength)

        # Infer dosage form
        def _infer_dosage_form(row):
            text = f"{row.get('type', '')} {row.get('pack_size_label', '')} {row.get('brand_name', '')}".lower()
            if "tablet" in text:     return "Tablet"
            if "capsule" in text:    return "Capsule"
            if "syrup" in text or "suspension" in text or "liquid" in text: return "Liquid"
            if "injection" in text or "vial" in text or "ampoule" in text:  return "Injectable"
            if "drop" in text:       return "Eye Drop"
            if "ointment" in text:   return "Ointment"
            if "cream" in text:      return "Cream"
            if "gel" in text:        return "Gel"
            if "inhaler" in text:    return "Inhaler"
            return "Tablet"

        df["dosage_form"] = df.apply(_infer_dosage_form, axis=1)

        # Generate deterministic Indian barcodes (starting with 890)
        def generate_barcode(row):
            bname = str(row["brand_name"])
            manuf = str(row["manufacturer"])
            h = hashlib.md5(f"{bname}:{manuf}".encode("utf-8")).hexdigest()
            digits = "".join(filter(str.isdigit, h))
            while len(digits) < 9:
                digits += "0"
            digits = digits[:9]
            full_12 = f"890{digits}"
            # Calculate check digit
            total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(full_12))
            check_digit = (10 - (total % 10)) % 10
            return f"{full_12}{check_digit}"

        df["barcode_id"] = df.apply(generate_barcode, axis=1)

        # Remove duplicate barcodes
        before = len(df)
        df = df.drop_duplicates(subset=["barcode_id"])
        logger.info(f"[CommercialNormalizer] Removed {before - len(df)} duplicates. Final: {len(df)} records")

        output_cols = [
            "barcode_id", "brand_name", "generic_name", "manufacturer",
            "composition", "strength", "dosage_form", "mrp", "jan_aushadhi_price",
            "cdsco_approval_status", "is_counterfeit_alert", "source"
        ]
        return df[output_cols]
