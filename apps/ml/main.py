from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from services.telemetry import configure_telemetry_logging

load_dotenv()
configure_telemetry_logging()

app = FastAPI(
    title="SahiDawa ML Service",
    description="Machine Learning API for medicine verification and voice assistance.",
    version="1.0.0"
)

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://localhost:4000",
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
from routers import ocr,asr 
app.include_router(ocr.router)
app.include_router(asr.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to SahiDawa ML API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
