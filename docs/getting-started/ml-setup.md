# ML Service Setup Guide

This guide explains how to set up and run the FastAPI-based ML service locally.

## Table of Contents

- [Service Information](#service-information)
- [Prerequisites](#prerequisites)
- [Navigate to the ML Service](#navigate-to-the-ml-service)
- [Create a Virtual Environment](#create-a-virtual-environment)
- [Install Dependencies](#install-dependencies)
- [Configure Environment Variables](#configure-environment-variables)
- [Recommended Voice ASR Settings](#recommended-voice-asr-settings)
- [Run the Development Server](#run-the-development-server)
- [Verify the Service](#verify-the-service)
- [Cold-Start Strategy](#cold-start-strategy)
- [Troubleshooting](#troubleshooting)

## Service Information

- Framework: FastAPI
- Default Port: `8000`
- API Docs: `http://localhost:8000/docs`

## Prerequisites

Before starting, make sure you have the following installed:

- Python 3.11 or higher
- pip (Python package manager)
- **FFmpeg** (required for audio normalization before transcription)
    - Ubuntu: `sudo apt install ffmpeg`
    - macOS: `brew install ffmpeg`
    - Windows: install from [ffmpeg.org](https://ffmpeg.org/download.html) and add it to `PATH`
- **Tesseract OCR** (System dependency for OCR features)
    - Ubuntu: `sudo apt install tesseract-ocr`
    - macOS: `brew install tesseract`
    - Windows: Download installer from [UB Mannheim](https://github.com/UB-Mannheim/tesseract/wiki)

Check your versions:

```bash
python --version
pip --version
```

---

## Navigate to the ML Service

From the project root:

```bash
cd apps/ml
```

---

## Create a Virtual Environment

### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

### macOS/Linux

```bash
python3 -m venv venv
source venv/bin/activate
```

After activation, you should see `(venv)` in your terminal.

## Install Dependencies

Install all required Python packages:

```bash
pip install -r requirements.txt
```

Current dependencies include:

- fastapi
- uvicorn
- pydantic
- python-dotenv
- faster-whisper
- soundfile
- noisereduce
- python-multipart

## Configure Environment Variables

Go back to the project root if needed and copy the example environment file.

### Windows

```bash
copy .env.example .env
```

### macOS/Linux

```bash
cp .env.example .env
```

Update the `.env` file with your own values if required.

For voice triage, the important variables are:

```bash
ML_SERVICE_URL=http://localhost:8000
NEXT_PUBLIC_ML_SERVICE_URL=http://localhost:8000
WHISPER_MODEL_SIZE=tiny
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
WHISPER_BEAM_SIZE=5
WHISPER_PRELOAD_ON_STARTUP=true
```

Notes:

- `ML_SERVICE_URL` is used by the Next.js proxy route at `/api/voice/transcribe`.
- `NEXT_PUBLIC_ML_SERVICE_URL` is used by the Voice Triage page for direct browser WebSocket streaming to `ws://localhost:8000/asr/stream`.
- `WHISPER_MODEL_SIZE` controls the Faster-Whisper model. `tiny` is the recommended CPU baseline for this feature.
- `WHISPER_PRELOAD_ON_STARTUP=true` makes the service load Whisper during boot instead of delaying the first citizen request.
- Make sure `ALLOWED_ORIGINS` includes the web app origin, typically `http://localhost:3000`, so local browser clients can connect cleanly to the ML service.

## Recommended Voice ASR Settings

For the current Voice Triage flow, the recommended production-oriented settings are:

```bash
WHISPER_MODEL_SIZE=tiny
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
WHISPER_BEAM_SIZE=5
WHISPER_PRELOAD_ON_STARTUP=true
```

Why this is the recommended baseline:

- `tiny` keeps latency low enough for web voice triage on CPU-only deployments.
- `int8` reduces memory pressure while staying accurate enough for symptom intake.
- `beam_size=5` is a balanced default for latency versus recognition quality.
- preloading avoids a poor first-request experience caused by lazy model initialization.

If you later deploy GPU-backed inference or have stronger CPU capacity, you can evaluate larger model sizes, but the Voice Triage branch should not assume that by default.

## Run the Development Server

Inside `apps/ml`:

```bash
uvicorn main:app --reload
```

To run with the recommended voice settings locally:

```bash
WHISPER_MODEL_SIZE=tiny \
WHISPER_DEVICE=cpu \
WHISPER_COMPUTE_TYPE=int8 \
WHISPER_BEAM_SIZE=5 \
WHISPER_PRELOAD_ON_STARTUP=true \
uvicorn main:app --reload
```

You should see output similar to:

```text
Uvicorn running on http://127.0.0.1:8000
```

## Verify the Service

### Swagger UI

Open your browser and visit:

```text
http://localhost:8000/docs
```

### Health Endpoint

Verify the service is running correctly:

```text
http://localhost:8000/health
```

Expected response:

```json
{
    "status": "healthy"
}
```

This confirms the ML service is up and functioning properly.

For end-to-end voice triage, also verify:

- the Next.js app can reach `ML_SERVICE_URL`
- `/api/voice/transcribe` returns a normalized JSON response
- a warm ASR request completes within the web proxy timeout budget

## Cold-Start Strategy

Voice transcription has a meaningful cold-start cost if the Whisper model must be downloaded or loaded on demand.

Recommended deployment strategy:

- enable `WHISPER_PRELOAD_ON_STARTUP=true`
- keep the Hugging Face model cache persisted between restarts, or bake the selected Faster-Whisper model into the image layer
- do not treat the service as ready for live traffic until startup preload has completed

Without preload, the first real user request may block on model initialization or download and exceed the web proxy timeout.

## Troubleshooting

### `ModuleNotFoundError`

Make sure the virtual environment is activated before installing dependencies or running the server.

### `ModuleNotFoundError` when using `python3`

On some systems (especially M1 Macs), you may need to explicitly use `python3`:

```bash
python3 -m venv venv
source venv/bin/activate
python3 -m pip install -r requirements.txt
python3 -m uvicorn main:app --reload
```

### `uvicorn: command not found`

Install dependencies again:

```bash
pip install -r requirements.txt
```

Or run uvicorn with Python:

```bash
python -m uvicorn main:app --reload
```

### Port 8000 Already in Use

Stop the process using port 8000 or run on another port:

```bash
uvicorn main:app --reload --port 8001
```

### `.env` File Not Found

Make sure you copied `.env.example` to `.env`.

### First ASR request is very slow

This usually means the Whisper model is still being downloaded or loaded. Confirm:

```bash
echo $WHISPER_MODEL_SIZE
echo $WHISPER_PRELOAD_ON_STARTUP
```

For the Voice Triage feature, prefer `WHISPER_MODEL_SIZE=tiny` and `WHISPER_PRELOAD_ON_STARTUP=true`.

## Additional Notes

- The ML service uses FastAPI.
- API documentation is automatically generated by Swagger UI.
- The service loads environment variables using `python-dotenv`.
- OCR dependencies can be missing without blocking the ASR router from starting; the app now treats OCR as optional at boot so voice triage can still come up cleanly.
