from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import logging
from contextlib import asynccontextmanager
from utils.database import redis_client

from tracing import setup_tracing
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor


load_dotenv()
setup_tracing()
RequestsInstrumentor().instrument()

from services.telemetry import configure_telemetry_logging
from services.router_loader import include_router_if_available
from routers.verify import router as verify_router

configure_telemetry_logging()
logger = logging.getLogger(__name__)


# Define the Lifespan to clean up Redis connections on shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup phase (App boots up)
    logger.info("SahiDawa ML Service starting up...")
    yield
    # Shutdown phase (App stops/reloads)
    logger.info("Closing Redis connection pool...")
    await redis_client.close()


app = FastAPI(
    title="SahiDawa ML Service",
    description="Machine Learning API for medicine verification and voice assistance.",
    version="1.0.0",
    lifespan=lifespan  # <-- Hooked lifespan here
)

FastAPIInstrumentor.instrument_app(app)

# Configure CORS - load dynamically from environment variables
allowed_origins = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:4000,http://localhost:8000"
    ).split(",")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include ASR as a required router and OCR as optional so voice triage can boot
# even when OCR-only dependencies are not installed in the current environment.
# TTS is optional - app boots without it but cloud TTS is disabled.
include_router_if_available(app, "routers.verify", required=True)
include_router_if_available(app, "routers.asr", required=True)
include_router_if_available(app, "routers.analyze", required=True)
include_router_if_available(app, "routers.triage", required=True)
ocr_loaded = include_router_if_available(app, "routers.ocr", required=False)
if not ocr_loaded:
    logger.warning("OCR routes are disabled in this runtime.")
tts_loaded = include_router_if_available(app, "routers.tts", required=False)
if not tts_loaded:
    logger.warning(
        "TTS routes are disabled. Install google-cloud-texttospeech or configure Azure TTS."
    )
include_router_if_available(app, "routers.voice_verify", required=True)

# Directly attach the ML comparison computation layer to structural router
@verify_router.post("/compare")
async def compare_medicines(payload: dict):
    medicine_a = payload.get("medicine_a", "")
    medicine_b = payload.get("medicine_b", "")
    
    if not medicine_a or not medicine_b:
        return {"error": "Both medicine names are required"}, 400
        
    from services.embedding import embed_query
    from services.similarity import cosine_similarity
    
    emb_a = embed_query(medicine_a)
    emb_b = embed_query(medicine_b)
    
    score = cosine_similarity(emb_a, emb_b)
    
    return {
        "medicine_a": medicine_a,
        "medicine_b": medicine_b,
        "similarity_score": score,
        "verdict": "highly_similar" if score >= 0.92 else "different"
    }

@app.get("/")
def read_root():
    return {"message": "Welcome to SahiDawa ML API"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}