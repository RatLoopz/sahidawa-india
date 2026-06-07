"""
Text-to-Speech (TTS) router for generating speech audio from text.
Supports multiple languages: English, Hindi, Tamil, Bengali, Marathi, Telugu.

Provider: Google Cloud Text-to-Speech (primary), Azure TTS (fallback)
Free tier: 1M characters/month (Google), 0.5M characters/month (Azure)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Literal
import os
import logging
import hashlib
import base64
from pathlib import Path
import tempfile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice/tts", tags=["voice-tts"])

# Language to Google Cloud voice mapping (highest-quality female voice available
# per language). Google only offers Neural2 for en-IN/hi-IN; Tamil/Bengali/Marathi
# fall back to WaveNet, and Telugu only has Standard voices. All chosen voices
# support the speaking_rate audio config used below.
GOOGLE_VOICES_MAP = {
    "en-IN": "en-IN-Neural2-A",   # English - Indian (Neural2)
    "hi-IN": "hi-IN-Neural2-A",   # Hindi (Neural2)
    "ta-IN": "ta-IN-Wavenet-A",   # Tamil (no Neural2 -> WaveNet)
    "bn-IN": "bn-IN-Wavenet-A",   # Bengali (no Neural2 -> WaveNet)
    "mr-IN": "mr-IN-Wavenet-A",   # Marathi (no Neural2 -> WaveNet)
    "te-IN": "te-IN-Standard-A",  # Telugu (no Neural2/WaveNet -> Standard)
}

# Language to Azure voice mapping
AZURE_VOICES_MAP = {
    "en-IN": "en-IN-PallaviNeural",  # English - Indian
    "hi-IN": "hi-IN-SwaraNeural",     # Hindi
    "ta-IN": "ta-IN-PallaviNeural",   # Tamil
    "bn-IN": "bn-IN-TanayaNeural",    # Bengali
    "mr-IN": "mr-IN-AarohiNeural",    # Marathi
    "te-IN": "te-IN-ShrutiNeural",    # Telugu
}

# Cache configuration using cross-platform temp directory
CACHE_DIR = Path(tempfile.gettempdir()) / "tts_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Cache limit configuration from environment
MAX_CACHE_SIZE_MB = int(os.getenv("MAX_CACHE_SIZE_MB", "100"))
MAX_CACHE_FILES = int(os.getenv("MAX_CACHE_FILES", "500"))


def prune_cache():
    """Prune oldest cache files if cache limits (size or file count) are exceeded."""
    try:
        if not CACHE_DIR.exists():
            return

        files = []
        total_size = 0
        for p in CACHE_DIR.glob("*.mp3"):
            if p.is_file():
                try:
                    stat = p.stat()
                    # Use st_atime if available (fallback to st_mtime)
                    atime = stat.st_atime if stat.st_atime else stat.st_mtime
                    size = stat.st_size
                    files.append((p, atime, size))
                    total_size += size
                except Exception as e:
                    logger.warning(f"Failed to stat cache file {p}: {e}")

        max_size_bytes = MAX_CACHE_SIZE_MB * 1024 * 1024
        if len(files) <= MAX_CACHE_FILES and total_size <= max_size_bytes:
            return

        # Sort files by last access/modification time (oldest first)
        files.sort(key=lambda x: x[1])

        removed_count = 0
        for path, _, size in files:
            if (len(files) - removed_count) <= MAX_CACHE_FILES and total_size <= max_size_bytes:
                break
            try:
                path.unlink(missing_ok=True)
                total_size -= size
                removed_count += 1
                logger.info(f"✓ Pruned cache file {path} (size: {size} bytes)")
            except Exception as e:
                logger.warning(f"Failed to delete cache file {path}: {e}")
    except Exception as e:
        logger.warning(f"Error during cache pruning: {e}")

# Provider detection from environment
TTS_PROVIDER = os.getenv("TTS_PROVIDER", "google").lower()

# Initialize TTS clients
tts_google_client = None
tts_azure_client = None
azure_tts_key = None
azure_tts_region = None

# Initialize Google Cloud TTS client
if TTS_PROVIDER == "google" or TTS_PROVIDER == "both":
    try:
        from google.cloud import texttospeech
        tts_google_client = texttospeech.TextToSpeechClient()
        logger.info("✓ Google Cloud TTS client initialized")
    except ImportError:
        logger.warning("⚠ google-cloud-texttospeech not installed. Install with: pip install google-cloud-texttospeech")
    except Exception as e:
        logger.warning(f"⚠ Google Cloud TTS initialization failed: {e}")

# Initialize Azure TTS client
if TTS_PROVIDER == "azure" or TTS_PROVIDER == "both":
    azure_tts_key = os.getenv("AZURE_TTS_KEY")
    azure_tts_region = os.getenv("AZURE_TTS_REGION", "southindia")
    if azure_tts_key:
        logger.info(f"✓ Azure TTS configured for region: {azure_tts_region}")
    else:
        logger.warning("⚠ AZURE_TTS_KEY not set. Azure TTS disabled.")


class TTSRequest(BaseModel):
    """Request model for TTS generation"""
    text: str = Field(..., min_length=1, max_length=5000, description="Text to synthesize")
    language_code: str = Field(..., description="BCP-47 language code (e.g., 'en-IN', 'hi-IN')")
    gender: Optional[Literal["MALE", "FEMALE", "NEUTRAL"]] = "FEMALE"


class TTSResponse(BaseModel):
    """Response model for TTS generation"""
    audio_base64: str
    language_code: str
    provider: str
    cached: bool
    character_count: int


def get_cache_key(text: str, language_code: str) -> str:
    """Generate cache key from text and language"""
    combined = f"{text}:{language_code}"
    return hashlib.md5(combined.encode()).hexdigest()


def generate_with_google(text: str, language_code: str, gender: str) -> tuple[bytes, str]:
    """Generate TTS using Google Cloud Text-to-Speech"""
    if not tts_google_client:
        raise HTTPException(
            status_code=503,
            detail="Google Cloud TTS service is not configured"
        )

    if language_code not in GOOGLE_VOICES_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Language '{language_code}' not supported. Supported: {', '.join(GOOGLE_VOICES_MAP.keys())}"
        )

    try:
        from google.cloud import texttospeech

        synthesis_input = texttospeech.SynthesisInput(text=text)
        
        gender_enum = {
            "MALE": texttospeech.SsmlVoiceGender.MALE,
            "FEMALE": texttospeech.SsmlVoiceGender.FEMALE,
            "NEUTRAL": texttospeech.SsmlVoiceGender.NEUTRAL,
        }.get(gender, texttospeech.SsmlVoiceGender.FEMALE)

        voice = texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=GOOGLE_VOICES_MAP[language_code],
            ssml_gender=gender_enum
        )

        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=0.9  # Slightly slower for clarity
        )

        response = tts_google_client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )

        logger.info(f"✓ Generated {len(text)} chars of {language_code} audio via Google TTS")
        return response.audio_content, "google"

    except Exception as e:
        logger.error(f"❌ Google TTS error: {e}")
        raise HTTPException(status_code=500, detail="Google TTS generation failed")


def generate_with_azure(text: str, language_code: str, gender: str) -> tuple[bytes, str]:
    """Generate TTS using Azure Cognitive Services"""
    if not azure_tts_key:
        raise HTTPException(
            status_code=503,
            detail="Azure TTS service is not configured"
        )

    if language_code not in AZURE_VOICES_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Language '{language_code}' not supported by Azure. Supported: {', '.join(AZURE_VOICES_MAP.keys())}"
        )

    try:
        import requests

        voice_name = AZURE_VOICES_MAP[language_code]
        ssml_text = f"""
        <speak version='1.0' xml:lang='{language_code}'>
            <voice name='{voice_name}'>
                <prosody rate='0.9'>{text}</prosody>
            </voice>
        </speak>
        """

        headers = {
            "Ocp-Apim-Subscription-Key": azure_tts_key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3"
        }

        endpoint = f"https://{azure_tts_region}.tts.speech.microsoft.com/cognitiveservices/v1"
        
        response = requests.post(endpoint, headers=headers, data=ssml_text.encode('utf-8'), timeout=30)
        
        if response.status_code != 200:
            raise Exception(f"Azure API returned {response.status_code}: {response.text}")

        logger.info(f"✓ Generated {len(text)} chars of {language_code} audio via Azure TTS")
        return response.content, "azure"

    except Exception as e:
        logger.error(f"❌ Azure TTS error: {e}")
        raise HTTPException(status_code=500, detail="Azure TTS generation failed")


@router.post("/generate", response_model=TTSResponse)
async def generate_tts(request: TTSRequest):
    """
    Generate speech audio from text.
    
    Supported languages:
    - en-IN: English (Indian)
    - hi-IN: हिन्दी (Hindi)
    - ta-IN: தமிழ் (Tamil)
    - bn-IN: বাংলা (Bengali)
    - mr-IN: मराठी (Marathi)
    - te-IN: తెలుగు (Telugu)
    
    Returns:
    - audio_base64: MP3 audio encoded as Base64 string (standard for web clients)
    - provider: Which service generated the audio
    - cached: Whether the result came from cache
    """

    cache_key = get_cache_key(request.text, request.language_code)
    cache_file = CACHE_DIR / f"{cache_key}.mp3"

    # Check cache first
    if cache_file.exists():
        try:
            # Update access time to implement LRU cache policy
            try:
                cache_file.touch(exist_ok=True)
            except Exception as te:
                logger.warning(f"Failed to update cache file access time: {te}")

            with open(cache_file, "rb") as f:
                audio_data = f.read()
            
            return TTSResponse(
                audio_base64=base64.b64encode(audio_data).decode('utf-8'),
                language_code=request.language_code,
                provider="cache",
                cached=True,
                character_count=len(request.text)
            )
        except Exception as e:
            logger.warning(f"Cache read failed: {e}")

    # Generate new audio
    try:
        if TTS_PROVIDER == "google":
            audio_content, provider = generate_with_google(request.text, request.language_code, request.gender)
        elif TTS_PROVIDER == "azure":
            audio_content, provider = generate_with_azure(request.text, request.language_code, request.gender)
        else:
            # Fallback: try Google first, then Azure
            try:
                audio_content, provider = generate_with_google(request.text, request.language_code, request.gender)
            except Exception as e:
                logger.warning(f"Google TTS failed, trying Azure: {e}")
                audio_content, provider = generate_with_azure(request.text, request.language_code, request.gender)

        # Cache the result
        try:
            with open(cache_file, "wb") as f:
                f.write(audio_content)
            logger.info(f"✓ Cached TTS result to {cache_file}")
            try:
                prune_cache()
            except Exception as pe:
                logger.warning(f"Cache pruning failed: {pe}")
        except Exception as e:
            logger.warning(f"Cache write failed: {e}")

        return TTSResponse(
            audio_base64=base64.b64encode(audio_content).decode('utf-8'),
            language_code=request.language_code,
            provider=provider,
            cached=False,
            character_count=len(request.text)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ TTS generation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Text-to-speech generation failed. Please try again."
        )


@router.get("/health")
def tts_health():
    """Health check for TTS service"""
    return {
        "status": "healthy",
        "provider": TTS_PROVIDER,
        "google_available": tts_google_client is not None,
        "azure_available": azure_tts_key is not None,
        "supported_languages": list(GOOGLE_VOICES_MAP.keys()) if TTS_PROVIDER == "google" else list(AZURE_VOICES_MAP.keys())
    }
