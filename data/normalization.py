
import re
from string import punctuation
import pandas as pd

COMMON_REMOVABLE_TOKENS = {
    "tablet",
    "tablets",
    "tab",
    "capsule",
    "capsules",
    "cap",
    "syrup",
    "suspension",
    "solution",
    "inj",
    "injection",
    "cream",
    "ointment",
    "drops",
    "oral",
    "ip",
    "mg",
    "ml",
    "gm",
    "g",
    "mcg",
}

COMMON_CORPORATE_SUFFIXES = {
    "pvt",
    "pvt.",
    "private",
    "limited",
    "ltd",
    "ltd.",
    "inc",
    "corp",
    "corporation",
    "pharmaceuticals",
    "pharma",
    "labs",
    "laboratories",
    "healthcare",
}





TRANSLATOR = str.maketrans("", "", punctuation)


def normalize_text(text):
    """
    Normalize medicine/product names.

    Steps:
    - lowercase
    - remove punctuation
    - remove dosage units
    - remove common medicine tokens
    - normalize whitespace
    """

    if not text or pd.isna(text):
        return ""

    text = str(text).lower()

    # Remove punctuation
    text = text.translate(TRANSLATOR)

    # Remove numeric dosage patterns like:
    # 500mg, 10ml, 250 mcg
    text = re.sub(r"\b\d+\s?(mg|ml|mcg|g|gm)\b", " ", text)

    tokens = text.split()

    cleaned_tokens = [
        token
        for token in tokens
        if token not in COMMON_REMOVABLE_TOKENS
    ]

    normalized = " ".join(cleaned_tokens)

    return " ".join(normalized.split()).strip()


def normalize_manufacturer(text):
    """
    Normalize manufacturer/company names.
    """

    if not text or pd.isna(text):
        return ""

    text = str(text).lower()

    text = text.translate(TRANSLATOR)

    tokens = text.split()

    cleaned_tokens = [
        token
        for token in tokens
        if token not in COMMON_CORPORATE_SUFFIXES
    ]

    normalized = " ".join(cleaned_tokens)

    return " ".join(normalized.split()).strip()
