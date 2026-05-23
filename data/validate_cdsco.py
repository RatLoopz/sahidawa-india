# pipelines/data/validate_cdsco.py

from __future__ import annotations
import os

from logger import logger
from normalization import normalize_text, normalize_manufacturer

import pandas as pd
from rapidfuzz import fuzz, process

import requests

## CONFIGS

MATCH_THRESHOLD = 90

PRODUCT_WEIGHT = 0.7
MANUFACTURER_WEIGHT = 0.3


CDSCO_URL = "https://cdscoonline.gov.in/CDSCO/loadRule84abBrandNames?searchText="


## GET DATA FROM CDSCO PORTAL

def get_cdsco_data() :
    """
    Uses requests to fetch data from CDSCO portal.
    and converts it to a CSV
    """
    
    logger.info("Fetching CDSCO data from portal .....")
    response = requests.get(CDSCO_URL)
    
    if response.status_code != 200:
        logger.error(
            f"Failed to fetch CDSCO data | Status code: {response.status_code}"
        )
        return None
    
    logger.info("Successfully fetched CDSCO data")
    
    data = response.json()
    
    logger.info(f"Retrieved {len(data['aaData'])} records from CDSCO")
    
    cdsco_df = pd.DataFrame(data['aaData'])
    
    logger.info("Converting CDSCO data to CSV format")
    
    cdsco_df.to_csv(os.path.join("seeds", "cdsco_reference.csv"), index=False)
    
    logger.info(f"CDSCO data saved to {os.path.join('seeds', 'cdsco_reference.csv')}")
    return

## LOAD CDSCO REFERENCE DATA
def load_cdsco_data(csv_path) :
    """
    Load CDSCO reference data.

    Expected columns:
    - product_name
    - manufacturer

    Returns normalized dataframe.
    """

    logger.info(f"Loading CDSCO data from: {csv_path}")

    df = pd.read_csv(csv_path)

    required_columns = {"brand_name", "firm_name"}

    missing = required_columns - set(df.columns)

    if missing:
        raise ValueError(
            f"Missing required columns in CDSCO CSV: {missing}"
        )

    df = df.fillna("")

    df["normalized_product"] = df["brand_name"].apply(
        normalize_text
    )

    df["normalized_manufacturer"] = df["firm_name"].apply(
        normalize_manufacturer
    )

    # Remove duplicates
    df = df.drop_duplicates(
        subset=[
            "normalized_product",
            "normalized_manufacturer",
        ]
    )

    logger.info(f"Loaded {len(df)} CDSCO reference rows")

    return df


## MATCHING LOGIC

def calculate_match_score(
    product_score,
    manufacturer_score
) :
    """
    Calculate weighted match score.
    """

    return (
        PRODUCT_WEIGHT * product_score
        + MANUFACTURER_WEIGHT * manufacturer_score
    )


def find_best_match(
    product_name,
    manufacturer,
    cdsco_df: pd.DataFrame,
) :
    """
    Find best CDSCO match for a product/manufacturer pair.
    """

    normalized_product = normalize_text(product_name)
    normalized_manufacturer = normalize_manufacturer(manufacturer)

    if not normalized_product:
        return None, 0.0

    product_choices = cdsco_df["normalized_product"].tolist()

    product_match = process.extractOne(
        normalized_product,
        product_choices,
        scorer=fuzz.token_sort_ratio,
    )

    if not product_match:
        return None, 0.0

    matched_product, product_score, matched_index = product_match

    cdsco_row = cdsco_df.iloc[matched_index]

    manufacturer_score = fuzz.token_sort_ratio(
        normalized_manufacturer,
        cdsco_row["normalized_manufacturer"],
    )

    final_score = calculate_match_score(
        product_score,
        manufacturer_score,
    )

    match_data = {
        "matched_product": cdsco_row["brand_name"],
        "matched_manufacturer": cdsco_row["firm_name"],
        "product_score": round(product_score, 2),
        "manufacturer_score": round(manufacturer_score, 2),
        "final_score": round(final_score, 2),
    }

    return match_data, final_score



# VALIDATION PIPELINE


def validate_cdsco(
    input_df,
    cdsco_reference_path,
    product_column,
    manufacturer_column,
    threshold = MATCH_THRESHOLD,
) :
    """
    Validate medicines against CDSCO reference data.

    Parameters
    ----------
    input_df : pd.DataFrame
        Input medicine dataframe

    cdsco_reference_path : str | Path
        Path to CDSCO reference CSV

    product_column : str
        Product name column in input dataframe

    manufacturer_column : str
        Manufacturer column in input dataframe

    threshold : int
        Verification threshold

    Returns
    -------
    pd.DataFrame
        Validated dataframe with CDSCO verification fields
    """

    logger.info("Starting CDSCO validation pipeline")

    cdsco_df = load_cdsco_data(cdsco_reference_path)

    results = []

    for _, row in input_df.iterrows():

        product_name = row.get(product_column, "")
        manufacturer = row.get(manufacturer_column, "")

        match_data, final_score = find_best_match(
            product_name=product_name,
            manufacturer=manufacturer,
            cdsco_df=cdsco_df,
        )

        is_verified = final_score >= threshold

        result_row = row.to_dict()

        result_row["is_cdsco_verified"] = bool(is_verified)
        result_row["cdsco_match_score"] = round(final_score, 2)

        if match_data:
            result_row["matched_cdsco_product"] = match_data[
                "matched_product"
            ]
            result_row["matched_cdsco_manufacturer"] = match_data[
                "matched_manufacturer"
            ]
            result_row["product_match_score"] = match_data[
                "product_score"
            ]
            result_row["manufacturer_match_score"] = match_data[
                "manufacturer_score"
            ]
        else:
            result_row["matched_cdsco_product"] = None
            result_row["matched_cdsco_manufacturer"] = None
            result_row["product_match_score"] = 0
            result_row["manufacturer_match_score"] = 0

        results.append(result_row)

    validated_df = pd.DataFrame(results)

    verified_count = validated_df[
        "is_cdsco_verified"
    ].sum()

    logger.info(
        f"Validation complete | "
        f"Verified: {verified_count}/{len(validated_df)}"
    )

    return validated_df


## MAIN EXECUTION

if __name__ == "__main__":
    
    if os.path.exists(os.path.join("seeds", "cdsco_reference.csv")):
        logger.info("CDSCO reference data already exists. Skipping fetch.")
    else:
        logger.info("CDSCO reference data not found. Fetching from portal.")
        get_cdsco_data()
        logger.info("CDSCO reference data fetched and saved successfully.")

    # Example usage
    import os

    INPUT_DATA_PATH = os.path.join("seeds", "medicines.csv")
    CDSCO_REFERENCE_PATH = os.path.join("seeds", "cdsco_reference.csv")
    OUTPUT_PATH = os.path.join("seeds", "validated_medicines.csv")

    logger.info("Reading input medicine data")

    input_df = pd.read_csv(INPUT_DATA_PATH)

    validated_df = validate_cdsco(
        input_df=input_df,
        cdsco_reference_path=CDSCO_REFERENCE_PATH,
        product_column="brand_name",
        manufacturer_column="manufacturer",
    )

    validated_df.to_csv(OUTPUT_PATH, index=False)

    logger.info(f"Saved validated data to: {OUTPUT_PATH}")