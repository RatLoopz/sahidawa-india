"""
Medicine Named Entity Recognition (NER) pipeline.

Uses scispaCy's en_ner_bc5cdr_md model (trained on BC5CDR corpus) to extract
drug names and dosages from transcribed voice input. Falls back to regex
patterns when the model is unavailable or returns no entities.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class MedicineEntity:
    text: str
    label: str          # "DRUG" | "DOSAGE" | "FREQUENCY"
    confidence: float   # 0.0 – 1.0 heuristic score
    start: int          # character offset in transcript
    end: int


@dataclass
class NERResult:
    transcript: str
    entities: list[MedicineEntity] = field(default_factory=list)
    primary_medicine: Optional[str] = None   # first DRUG entity, lowercased
    primary_dosage: Optional[str] = None     # first DOSAGE entity


# ---------------------------------------------------------------------------
# Regex fallback patterns
# ---------------------------------------------------------------------------

# Dosage: 500mg / 10 ml / 250 mcg / 5000 IU / 2g
_DOSAGE_RE = re.compile(
    r"\b(\d+(?:\.\d+)?)\s*(mg|ml|mcg|iu|g|mcg|tablet|tab|cap|capsule)\b",
    re.IGNORECASE,
)

# Frequency: twice daily, OD, BD, TDS, QID, once a day …
_FREQ_RE = re.compile(
    r"\b(once\s+(?:a\s+)?daily|twice\s+daily|thrice\s+daily"
    r"|od|bd|tds|qid|sos|prn|every\s+\d+\s*hours?)\b",
    re.IGNORECASE,
)

# Common Indian brand → generic mappings (extend as needed)
_BRAND_MAP: dict[str, str] = {
    "crocin": "paracetamol",
    "dolo": "paracetamol",
    "calpol": "paracetamol",
    "augmentin": "amoxicillin clavulanate",
    "mox": "amoxicillin",
    "pan": "pantoprazole",
    "rantac": "ranitidine",
    "combiflam": "ibuprofen paracetamol",
    "sinarest": "cetirizine paracetamol",
}


def _regex_extract(transcript: str) -> list[MedicineEntity]:
    """Extract dosage and frequency entities using regex when NER model is unavailable."""
    entities: list[MedicineEntity] = []

    for m in _DOSAGE_RE.finditer(transcript):
        entities.append(
            MedicineEntity(
                text=m.group(),
                label="DOSAGE",
                confidence=0.80,
                start=m.start(),
                end=m.end(),
            )
        )

    for m in _FREQ_RE.finditer(transcript):
        entities.append(
            MedicineEntity(
                text=m.group(),
                label="FREQUENCY",
                confidence=0.75,
                start=m.start(),
                end=m.end(),
            )
        )

    return sorted(entities, key=lambda e: e.start)


def _normalise_drug(text: str) -> str:
    """Lowercase and resolve known brand names to generics."""
    lower = text.lower().strip()
    return _BRAND_MAP.get(lower, lower)


# ---------------------------------------------------------------------------
# scispaCy loader (lazy — loaded once on first call)
# ---------------------------------------------------------------------------

_nlp = None          # spacy Language object
_model_loaded = False
_MODEL_NAME = "en_ner_bc5cdr_md"


def _load_model() -> bool:
    """
    Attempt to load scispaCy model. Returns True on success.
    Safe to call multiple times — loads only once.
    """
    global _nlp, _model_loaded
    if _model_loaded:
        return _nlp is not None

    try:
        import spacy  # noqa: PLC0415
        _nlp = spacy.load(_MODEL_NAME)
        logger.info("scispaCy model '%s' loaded successfully.", _MODEL_NAME)
        _model_loaded = True
        return True
    except OSError:
        logger.warning(
            "scispaCy model '%s' not found. "
            "Install with: pip install %s",
            _MODEL_NAME,
            _MODEL_NAME,
        )
    except ImportError:
        logger.warning("spacy not installed — NER will use regex fallback only.")

    _model_loaded = True   # don't retry on every call
    return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_medicine_entities(transcript: str) -> NERResult:
    """
    Main entry point.

    Parameters
    ----------
    transcript:
        Raw text from faster-whisper ASR.

    Returns
    -------
    NERResult with structured entity list and convenience fields.

    Example
    -------
    >>> result = extract_medicine_entities("I need paracetamol 500mg twice daily")
    >>> result.primary_medicine
    'paracetamol'
    >>> result.primary_dosage
    '500mg'
    """
    if not transcript or not transcript.strip():
        return NERResult(transcript=transcript)

    entities: list[MedicineEntity] = []
    model_available = _load_model()

    # --- scispaCy path ---
    if model_available and _nlp is not None:
        doc = _nlp(transcript)
        for ent in doc.ents:
            # BC5CDR labels: CHEMICAL (drugs), DISEASE
            if ent.label_ not in ("CHEMICAL", "DISEASE"):
                continue

            label = "DRUG" if ent.label_ == "CHEMICAL" else "DISEASE"

            # Heuristic confidence: longer, more specific spans score higher
            span_len = len(ent.text.split())
            confidence = min(0.60 + span_len * 0.10, 0.97)

            entities.append(
                MedicineEntity(
                    text=ent.text,
                    label=label,
                    confidence=round(confidence, 2),
                    start=ent.start_char,
                    end=ent.end_char,
                )
            )

    # Always run regex on top — catches dosages/frequencies the NER model misses
    regex_entities = _regex_extract(transcript)

    # Merge: avoid duplicating spans already found by scispaCy
    existing_spans = {(e.start, e.end) for e in entities}
    for re_ent in regex_entities:
        if (re_ent.start, re_ent.end) not in existing_spans:
            entities.append(re_ent)

    entities.sort(key=lambda e: e.start)

    # Derive convenience fields
    primary_medicine: Optional[str] = None
    primary_dosage: Optional[str] = None

    for ent in entities:
        if ent.label == "DRUG" and primary_medicine is None:
            primary_medicine = _normalise_drug(ent.text)
        if ent.label == "DOSAGE" and primary_dosage is None:
            primary_dosage = ent.text.lower()

    # Last-resort: if no DRUG entity found but brand name in transcript
    if primary_medicine is None:
        lower_t = transcript.lower()
        for brand, generic in _BRAND_MAP.items():
            if brand in lower_t:
                primary_medicine = generic
                # inject a synthetic entity so frontend has consistent shape
                idx = lower_t.index(brand)
                entities.insert(
                    0,
                    MedicineEntity(
                        text=brand,
                        label="DRUG",
                        confidence=0.70,
                        start=idx,
                        end=idx + len(brand),
                    ),
                )
                break

    return NERResult(
        transcript=transcript,
        entities=entities,
        primary_medicine=primary_medicine,
        primary_dosage=primary_dosage,
    )


def entities_to_dict(result: NERResult) -> dict:
    """Serialize NERResult to JSON-safe dict for API response."""
    return {
        "transcript": result.transcript,
        "entities": [
            {
                "text": e.text,
                "label": e.label,
                "confidence": e.confidence,
                "start": e.start,
                "end": e.end,
            }
            for e in result.entities
        ],
        "primary_medicine": result.primary_medicine,
        "primary_dosage": result.primary_dosage,
    }