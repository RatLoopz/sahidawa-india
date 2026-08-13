from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import asyncio
import os
import logging
from contextlib import asynccontextmanager
from utils.database import redis_client
from utils.ws_registry import listen_for_revocations
from services import triage_graph as _triage_graph_service

from tracing import setup_tracing
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor


load_dotenv()
setup_tracing()
RequestsInstrumentor().instrument()

from services.telemetry import configure_telemetry_logging
from services.router_loader import include_router_if_available
from dependencies import verify_api_key

configure_telemetry_logging()
logger = logging.getLogger(__name__)


# Define the Lifespan to clean up Redis connections on shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup phase (App boots up)
    logger.info("SahiDawa ML Service starting up...")
    # Attempt to initialise the LangGraph-native AsyncRedisSaver.  Falls back
    # to manual JSON persistence silently if Redis Stack / Redis >= 8.0 is not
    # available (e.g. Upstash free tier).  See services/triage_graph.py for
    # the full fallback strategy and known tradeoffs.
    await _triage_graph_service.init_checkpointer()

    # Background task: force-close a user's active WebSocket streams when their
    # API key is revoked (signal broadcast over Redis Pub/Sub by the API).
    revocation_listener = asyncio.create_task(listen_for_revocations(redis_client))

    try:
        yield
    finally:
        # Shutdown phase (App stops/reloads)
        logger.info("Closing connections...")
        revocation_listener.cancel()
        try:
            await revocation_listener
        except asyncio.CancelledError:
            pass
        await _triage_graph_service.close_checkpointer()  # closes AsyncExitStack
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

# Every router below requires a valid x-api-key. This service runs on a public
# origin (the API rejects private/loopback ML_SERVICE_URL values), so the
# transcription, OCR, TTS and triage routes must not be reachable anonymously.
# "/" and "/health" are declared on the app directly and stay open for probes.
if not os.getenv("ML_API_KEY"):
    logger.error(
        "ML_API_KEY is not set. Authenticated routes will return 503 until it is configured."
    )

auth = [Depends(verify_api_key)]

# Include ASR as a required router and OCR as optional so voice triage can boot
# even when OCR-only dependencies are not installed in the current environment.
# TTS is optional - app boots without it but cloud TTS is disabled.
include_router_if_available(app, "routers.health", required=True, dependencies=auth)
include_router_if_available(app, "routers.verify", required=True, dependencies=auth)
include_router_if_available(app, "routers.asr", required=True, dependencies=auth)
include_router_if_available(app, "routers.analyze", required=True, dependencies=auth)
include_router_if_available(app, "routers.triage", required=True, dependencies=auth)
ocr_loaded = include_router_if_available(app, "routers.ocr", required=False, dependencies=auth)
if not ocr_loaded:
    logger.warning("OCR routes are disabled in this runtime.")
tts_loaded = include_router_if_available(app, "routers.tts", required=False, dependencies=auth)
if not tts_loaded:
    logger.warning(
        "TTS routes are disabled. Install google-cloud-texttospeech or configure Azure TTS."
    )
include_router_if_available(app, "routers.voice_verify", required=True, dependencies=auth)
# Optional: voice-driven medicine-name extraction. Degrades gracefully to an
# empty list when the LLM stack/API key is absent, so it need not be required.
extract_loaded = include_router_if_available(
    app, "routers.medicine_extract", required=False, dependencies=auth
)
if not extract_loaded:
    logger.warning("Medicine-extraction routes are disabled in this runtime.")

@app.get("/")
@app.head("/")
def read_root():
    return {"message": "Welcome to SahiDawa ML API"}


@app.get("/health")
@app.head("/health")
def health_check():
    return {"status": "healthy"}