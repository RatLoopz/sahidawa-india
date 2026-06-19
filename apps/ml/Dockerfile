# ============================================================
# Stage 1: builder — Install Python dependencies in a venv
# ============================================================
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build-time system libraries needed to compile C extensions
# (e.g. numpy, soundfile, noisereduce, faster-whisper CTranslate2 bindings)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create an isolated virtual environment so we can copy it cleanly
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ============================================================
# Stage 2: runner — Minimal production image
# ============================================================
FROM python:3.12-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV MEDICINES_CSV_PATH=/data/seeds/medicines.csv

# Install only the runtime system libraries (no compilers)
# curl is needed for HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libtesseract-dev \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy the pre-built virtual environment from the builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Run as non-root for security
RUN groupadd --system --gid 1001 mlgroup && \
    useradd  --system --uid 1001 --gid mlgroup mluser

# Compose mounts the root seed CSV here for dev/prod verification.
RUN mkdir -p /data/seeds && \
    chown -R mluser:mlgroup /data

# Copy application source code
COPY --chown=mluser:mlgroup . .

USER mluser

EXPOSE 8000

# Health check — verify the FastAPI app responds after required routers load
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
