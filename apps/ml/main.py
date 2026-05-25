from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import logging

from services.telemetry import configure_telemetry_logging
from services.router_loader import include_router_if_available
from src.image_compare import router as image_compare_router

load_dotenv()
configure_telemetry_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SahiDawa ML Service",
    description="Machine Learning API for medicine verification and voice assistance.",
    version="1.0.0"
)

# Configure CORS - load dynamically from environment variables
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:4000,http://localhost:8000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include ASR as a required router and OCR as optional so voice triage can boot
# even when OCR-only dependencies are not installed in the current environment.
include_router_if_available(app, "routers.asr", required=True)
ocr_loaded = include_router_if_available(app, "routers.ocr", required=False)
if not ocr_loaded:
    logger.warning("OCR routes are disabled in this runtime.")

app.include_router(image_compare_router, prefix="/api/v1", tags=["image-compare"])

@app.get("/")
def read_root():
    return {"message": "Welcome to SahiDawa ML API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
