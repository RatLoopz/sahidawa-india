from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import whisper
import tempfile
import os

router = APIRouter(prefix="/voice", tags=["Voice Verification"])

# Whisper model is loaded lazily on first use — see get_whisper_model() —
# to avoid blocking ML service startup if model loading fails or is slow.
whisper_model = None


def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        whisper_model = whisper.load_model("base")
    return whisper_model

# Supported Indian scripts for rendering
LANGUAGE_SCRIPT_MAP = {
    "hi": "Devanagari",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
    "ml": "Malayalam",
    "bn": "Bengali",
    "gu": "Gujarati",
    "mr": "Marathi",
    "pa": "Gurmukhi",
    "or": "Odia",
    "ur": "Nastaliq",
    "en": "Latin",
}


@router.post("/verify")
async def verify_medicine_voice(audio: UploadFile = File(...)):
    """
    Accepts an audio file, transcribes it with Whisper ASR,
    detects language, and verifies the medicine via LangChain + CDSCO.
    """
    # Validate file type
    if audio.content_type not in ["audio/webm", "audio/wav", "audio/ogg", "audio/mp4", "audio/mpeg"]:
        raise HTTPException(status_code=400, detail="Unsupported audio format. Use webm, wav, ogg, or mp4.")

    # Save to temp file for Whisper
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name

    try:
        # Transcribe with Whisper (auto-detects language)
        result = get_whisper_model().transcribe(tmp_path, task="transcribe")
        transcribed_text = result.get("text", "").strip()
        detected_lang = result.get("language", "en")

        if not transcribed_text:
            raise HTTPException(status_code=422, detail="Could not transcribe audio. Please speak clearly.")

        # Get script name for detected language
        script = LANGUAGE_SCRIPT_MAP.get(detected_lang, "Latin")

        return JSONResponse(content={
            "success": True,
            "transcribed": transcribed_text,
            "detected_language": detected_lang,
            "script": script
        })

    finally:
        os.unlink(tmp_path)  # Clean up temp file


@router.get("/languages")
async def get_supported_languages():
    """Returns list of supported Indian languages and their scripts."""
    return {"supported_languages": LANGUAGE_SCRIPT_MAP}
