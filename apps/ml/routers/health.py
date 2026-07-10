import os
from pathlib import Path
from fastapi import APIRouter
from routers import asr
from services import medicine_ner
from services import embedding

# Try optional imports
try:
    from routers import tts
    tts_available = True
except ImportError:
    tts_available = False

try:
    from services import triage_graph
    triage_available = True
except ImportError:
    triage_available = False

router = APIRouter(tags=["Health"])

@router.get("/models/current")
def get_current_models():
    # ASR model metadata
    asr_metadata = {
        "model_size": getattr(asr, "WHISPER_MODEL_SIZE", "small"),
        "device": getattr(asr, "WHISPER_DEVICE", "cpu"),
        "compute_type": getattr(asr, "WHISPER_COMPUTE_TYPE", "int8"),
        "loaded": getattr(asr, "model", None) is not None
    }

    # TTS model metadata
    if tts_available:
        tts_metadata = {
            "provider": getattr(tts, "TTS_PROVIDER", "google"),
            "google_client_loaded": getattr(tts, "tts_google_client", None) is not None,
            "azure_client_loaded": getattr(tts, "azure_tts_key", None) is not None
        }
    else:
        tts_metadata = {
            "provider": "disabled",
            "google_client_loaded": False,
            "azure_client_loaded": False
        }

    # NER model metadata
    ner_metadata = {
        "model_name": getattr(medicine_ner, "_MODEL_NAME", "en_ner_bc5cdr_md"),
        "loaded": getattr(medicine_ner, "_nlp", None) is not None
    }

    # Embedding metadata
    embedding_metadata = {
        "model_name": getattr(embedding, "EMBEDDING_MODEL", "gemini-embedding-2"),
        "dimensions": getattr(embedding, "EMBEDDING_DIMENSIONS", 768)
    }

    # Triage metadata
    if triage_available:
        triage_metadata = {
            "default_model": "gemini-2.5-flash",
            "langgraph_available": getattr(triage_graph, "LANGGRAPH_AVAILABLE", False)
        }
    else:
        triage_metadata = {
            "default_model": "gemini-2.5-flash",
            "langgraph_available": False
        }

    # Dynamic TFLite models check
    models_dir = Path(__file__).parent.parent / "models"
    tflite_models = []
    if models_dir.exists() and models_dir.is_dir():
        for f in models_dir.glob("*.tflite"):
            tflite_models.append({
                "filename": f.name,
                "size_bytes": f.stat().st_size,
                "exists": True
            })

    return {
        "asr": asr_metadata,
        "tts": tts_metadata,
        "ner": ner_metadata,
        "embedding": embedding_metadata,
        "triage": triage_metadata,
        "tflite_models": tflite_models
    }
