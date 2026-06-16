"""
Tests for apps/ml/src/ner/medicine_ner.py

Run with:
    pytest apps/ml/tests/test_medicine_ner.py -v
"""

import pytest
from unittest.mock import patch, MagicMock

from services.medicine_ner import (
    extract_medicine_entities,
    entities_to_dict,
    NERResult,
    MedicineEntity,
    _regex_extract,
    _normalise_drug,
)


# ---------------------------------------------------------------------------
# Regex layer tests (no model needed)
# ---------------------------------------------------------------------------

class TestRegexExtract:
    def test_dosage_mg(self):
        entities = _regex_extract("give me paracetamol 500mg")
        assert any(e.label == "DOSAGE" and "500mg" in e.text.lower() for e in entities)

    def test_dosage_ml(self):
        entities = _regex_extract("10ml syrup please")
        assert any(e.label == "DOSAGE" for e in entities)

    def test_frequency_bd(self):
        entities = _regex_extract("take it BD after meals")
        assert any(e.label == "FREQUENCY" for e in entities)

    def test_frequency_twice_daily(self):
        entities = _regex_extract("twice daily for 5 days")
        assert any(e.label == "FREQUENCY" for e in entities)

    def test_empty_transcript(self):
        assert _regex_extract("") == []

    def test_no_matches(self):
        assert _regex_extract("I feel unwell today") == []


# ---------------------------------------------------------------------------
# Brand normalisation
# ---------------------------------------------------------------------------

class TestNormaliseDrug:
    def test_crocin_maps_to_paracetamol(self):
        assert _normalise_drug("crocin") == "paracetamol"

    def test_dolo_maps_to_paracetamol(self):
        assert _normalise_drug("Dolo") == "paracetamol"

    def test_unknown_brand_passes_through(self):
        assert _normalise_drug("amoxicillin") == "amoxicillin"

    def test_case_insensitive(self):
        assert _normalise_drug("AUGMENTIN") == "amoxicillin clavulanate"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_ent(text: str, label: str, start: int, end: int) -> MagicMock:
    ent = MagicMock()
    ent.text = text
    ent.label_ = label
    ent.start_char = start
    ent.end_char = end
    return ent


def _make_nlp_mock(*ents: tuple[str, str, int, int]) -> MagicMock:
    """
    Build a callable mock that returns a doc whose .ents contains
    the provided (text, label, start, end) tuples regardless of input text.
    """
    nlp = MagicMock()
    doc = MagicMock()
    doc.ents = [_make_mock_ent(*e) for e in ents]
    nlp.return_value = doc
    return nlp


# ---------------------------------------------------------------------------
# Full pipeline — model mocked
# ---------------------------------------------------------------------------

class TestExtractMedicineEntities:
    def test_empty_string_returns_empty_result(self):
        result = extract_medicine_entities("")
        assert isinstance(result, NERResult)
        assert result.entities == []
        assert result.primary_medicine is None

    def test_whitespace_only(self):
        result = extract_medicine_entities("   ")
        assert result.primary_medicine is None

    @patch("services.medicine_ner._nlp", None)
    @patch("services.medicine_ner._model_loaded", True)
    def test_regex_fallback_when_no_model(self):
        """When model is absent, dosage regex still works."""
        result = extract_medicine_entities("need 500mg tablet")
        assert any(e.label == "DOSAGE" for e in result.entities)

    def test_brand_name_fallback(self):
        """crocin should resolve via brand map even without NER model."""
        with patch("services.medicine_ner._load_model", return_value=False), \
             patch("services.medicine_ner._nlp", None), \
             patch("services.medicine_ner._model_loaded", True):
            result = extract_medicine_entities("give me crocin please")
        assert result.primary_medicine == "paracetamol"

    def test_scispacy_drug_extracted(self):
        nlp_mock = _make_nlp_mock(("paracetamol", "CHEMICAL", 0, 11))
        with patch("services.medicine_ner._nlp", nlp_mock), \
             patch("services.medicine_ner._model_loaded", True):
            result = extract_medicine_entities("I need paracetamol 500mg")
        assert result.primary_medicine == "paracetamol"
        assert result.primary_dosage == "500mg"
        drug_entities = [e for e in result.entities if e.label == "DRUG"]
        assert len(drug_entities) >= 1
        assert drug_entities[0].confidence > 0

    def test_multi_drug_utterance(self):
        """Primary medicine should be the first drug mentioned."""
        nlp_mock = _make_nlp_mock(
            ("paracetamol", "CHEMICAL", 0, 11),
            ("amoxicillin", "CHEMICAL", 16, 27),
        )
        with patch("services.medicine_ner._nlp", nlp_mock), \
             patch("services.medicine_ner._model_loaded", True):
            result = extract_medicine_entities("paracetamol 500mg and amoxicillin 250mg")
        assert result.primary_medicine == "paracetamol"

    def test_entities_sorted_by_start(self):
        nlp_mock = _make_nlp_mock(("paracetamol", "CHEMICAL", 0, 11))
        with patch("services.medicine_ner._nlp", nlp_mock), \
             patch("services.medicine_ner._model_loaded", True):
            result = extract_medicine_entities("paracetamol 500mg twice daily")
        starts = [e.start for e in result.entities]
        assert starts == sorted(starts)

    def test_hindi_transliteration_partial(self):
        """'dolo' is a common Hindi-context brand name."""
        with patch("services.medicine_ner._load_model", return_value=False), \
             patch("services.medicine_ner._nlp", None), \
             patch("services.medicine_ner._model_loaded", True):
            result = extract_medicine_entities("mujhe dolo chahiye")
        assert result.primary_medicine == "paracetamol"


# ---------------------------------------------------------------------------
# Serialisation
# ---------------------------------------------------------------------------

class TestEntitiesToDict:
    def test_shape(self):
        result = NERResult(
            transcript="paracetamol 500mg",
            entities=[
                MedicineEntity("paracetamol", "DRUG", 0.94, 0, 11),
                MedicineEntity("500mg", "DOSAGE", 0.80, 12, 17),
            ],
            primary_medicine="paracetamol",
            primary_dosage="500mg",
        )
        d = entities_to_dict(result)
        assert d["transcript"] == "paracetamol 500mg"
        assert len(d["entities"]) == 2
        assert d["entities"][0]["label"] == "DRUG"
        assert d["primary_medicine"] == "paracetamol"
        assert d["primary_dosage"] == "500mg"

    def test_empty_entities_serialises(self):
        result = NERResult(transcript="hello")
        d = entities_to_dict(result)
        assert d["entities"] == []
        assert d["primary_medicine"] is None