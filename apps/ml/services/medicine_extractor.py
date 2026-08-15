"""
Conversational medicine-name extraction.

Given free-form, code-switched (Hindi/English) speech transcripts such as
"Main subah Paracetamol aur raat ko Metformin leta hu", extract just the
medicine names as a clean list — ["Paracetamol", "Metformin"].

Mirrors the LangChain + Gemini structured-output pattern already used by
``services/alert_extractor.py`` (the codebase's standard LLM stack), rather
than introducing a new provider. Falls back to Groq when configured, and
degrades gracefully to an empty list when no LLM is available so callers
never crash on a missing API key.
"""

import logging
import os
import re
from typing import List

from pydantic import BaseModel, Field

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.prompts import ChatPromptTemplate

    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False
    logging.warning(
        "LangChain or langchain-google-genai is not installed. "
        "Medicine extractor will return an empty list if called."
    )

logger = logging.getLogger(__name__)

# Guardrails on the returned list — a single conversational utterance realistically
# names only a handful of medicines; anything beyond this is almost certainly noise.
MAX_MEDICINES = 20
MAX_NAME_LENGTH = 100


class ExtractedMedicine(BaseModel):
    name: str = Field(
        description="A single medicine name exactly as a pharmacist would write it "
        "(brand or generic), with no dosage, frequency, or timing words."
    )


class MedicineList(BaseModel):
    medicines: List[ExtractedMedicine] = Field(
        default_factory=list,
        description="Every distinct medicine mentioned in the text.",
    )


def _clean_name(value: str) -> str:
    """Trim, collapse internal whitespace, and strip control/angle characters."""
    if not value:
        return ""
    value = re.sub(r"[\x00-\x1f\x7f-\x9f<>]", "", str(value))
    value = re.sub(r"\s+", " ", value).strip()
    return value[:MAX_NAME_LENGTH]


def _normalise(names: List[str]) -> List[str]:
    """Clean, drop empties/noise, and de-duplicate case-insensitively (order-preserving)."""
    seen: set[str] = set()
    result: List[str] = []
    for raw in names:
        name = _clean_name(raw)
        if len(name) < 2:
            continue
        # Reject anything with no alphabetic character (pure digits/punctuation).
        if not re.search(r"[A-Za-zऀ-ॿ]", name):
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(name)
        if len(result) >= MAX_MEDICINES:
            break
    return result


def _build_structured_llm():
    """Assemble a structured-output LLM (Gemini primary, Groq fallback)."""
    google_api_key = os.getenv("GOOGLE_API_KEY")
    groq_api_key = os.getenv("GROQ_API_KEY")

    if not google_api_key and not groq_api_key:
        logger.warning(
            "No API key set (GOOGLE_API_KEY or GROQ_API_KEY). Cannot extract medicines."
        )
        return None

    google_structured = None
    if google_api_key:
        llm_google = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash", temperature=0, google_api_key=google_api_key
        )
        google_structured = llm_google.with_structured_output(MedicineList)

    groq_structured = None
    if groq_api_key:
        try:
            from langchain_groq import ChatGroq

            llm_groq = ChatGroq(
                model="llama-3.3-70b-versatile", temperature=0, groq_api_key=groq_api_key
            )
            groq_structured = llm_groq.with_structured_output(MedicineList)
        except ImportError:
            logger.warning("langchain-groq not installed. Groq fallback unavailable.")

    if google_structured and groq_structured:
        return google_structured.with_fallbacks([groq_structured])
    return google_structured or groq_structured


def extract_medicines_from_text(text: str) -> List[str]:
    """
    Extract medicine names from conversational, possibly code-switched, text.

    Parameters
    ----------
    text:
        A speech transcript, e.g. "Main subah Paracetamol aur raat ko Metformin leta hu".

    Returns
    -------
    A de-duplicated list of medicine names, e.g. ["Paracetamol", "Metformin"].
    Returns an empty list when the text is blank or no LLM is available.
    """
    if not text or not text.strip():
        return []

    if not LANGCHAIN_AVAILABLE:
        logger.error("LangChain dependencies missing — cannot extract medicines.")
        return []

    try:
        structured_llm = _build_structured_llm()
        if structured_llm is None:
            return []

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are a clinical assistant that extracts medicine names from a "
                    "patient's spoken words. The speech is often conversational and mixes "
                    "Hindi and English (Hinglish). Return ONLY the names of medicines "
                    "(brand or generic). Do NOT include dosages (500mg), frequencies "
                    "(twice daily, subah, raat), symptoms, foods, or any other words. "
                    "Correct obvious spelling/transliteration so the name matches how a "
                    "pharmacist would write it. If no medicine is mentioned, return an "
                    "empty list.",
                ),
                ("human", "Extract the medicine names from this text:\n\n{text}"),
            ]
        )

        chain = prompt | structured_llm
        result = chain.invoke({"text": text})

        items = getattr(result, "medicines", None)
        if items is None and isinstance(result, dict):
            items = result.get("medicines", [])
        if not items:
            return []

        names: List[str] = []
        for item in items:
            if isinstance(item, dict):
                names.append(item.get("name", ""))
            else:
                names.append(getattr(item, "name", ""))

        return _normalise(names)
    except Exception as exc:
        logger.error("Error extracting medicines from text: %s", exc)
        return []
