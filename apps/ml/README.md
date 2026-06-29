# SahiDawa ML Service

FastAPI service for medicine verification, OCR, and ASR transcription workflows.

## Prerequisites

Install these before setting up the Python environment:

- Python 3.11 or higher
- pip
- ffmpeg for audio normalization used by Whisper ASR
- Tesseract OCR for OCR features

Check Python and pip:

```bash
python --version
pip --version
```

## System Binary Prerequisites

The ASR endpoint converts uploaded audio to a 16 kHz mono WAV file before sending it to Whisper. That conversion calls the `ffmpeg` system binary, so `ffmpeg` must be installed and available on your `PATH`.

Common binary locations:

| OS | Install method | Expected binary path |
| --- | --- | --- |
| macOS Apple Silicon | Homebrew | `/opt/homebrew/bin/ffmpeg` |
| macOS Intel | Homebrew | `/usr/local/bin/ffmpeg` |
| Debian/Ubuntu | apt | `/usr/bin/ffmpeg` |
| Windows | Chocolatey | `C:\ProgramData\chocolatey\bin\ffmpeg.exe` |
| Windows | Manual install | `C:\ffmpeg\bin\ffmpeg.exe` |

### macOS

```bash
brew install ffmpeg
ffmpeg -version
```

### Debian/Ubuntu

```bash
sudo apt update
sudo apt install ffmpeg
ffmpeg -version
```

### Windows

Using Chocolatey:

```powershell
choco install ffmpeg
ffmpeg -version
```

Manual installation:

1. Download a Windows build from the official ffmpeg download page.
2. Extract it to a stable folder, for example `C:\ffmpeg`.
3. Add the `bin` folder, for example `C:\ffmpeg\bin`, to the Windows system `Path` environment variable.
4. Open a new PowerShell window and verify the binary is available:

```powershell
ffmpeg -version
```

If `ffmpeg` is installed but the command is not found, restart the terminal and confirm the `bin` directory is listed in `Path`.

## Virtual Environment Isolation

Use a dedicated virtual environment for the ML service. This avoids package collisions with other Python projects, global Python installs, or model tooling already present on your machine.

From the repository root:

```bash
cd apps/ml
```

Create the environment:

```bash
python3 -m venv venv
```

Activate it on macOS/Linux:

```bash
source venv/bin/activate
```

Activate it on Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

If PowerShell blocks activation scripts, run this for the current terminal session and then activate again:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\venv\Scripts\Activate.ps1
```

Install dependencies after the virtual environment is active:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## Model Download Test

Start the FastAPI server from `apps/ml` to verify the service imports correctly and the Whisper model can download and load into memory:

```bash
python -m uvicorn main:app --reload --port 8000
```

During startup, the ASR router loads `faster-whisper` with the `medium` model on CPU. A successful startup should include log output similar to:

```text
Loading Whisper model...
Whisper model loaded
Uvicorn running on http://127.0.0.1:8000
```

Then verify the service is responding:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{
  "status": "healthy"
}
```

Open Swagger UI for endpoint testing:

```text
http://localhost:8000/docs
```
## TTS Cache Storage

The ML service can use Supabase Storage as a shared cache for generated TTS audio.

Create a Supabase Storage bucket named:

```text
tts-cache
```

Set these environment variables:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
TTS_CACHE_BUCKET=tts-cache
```

Generated TTS audio is compressed with gzip and stored as `.mp3.gz` files. If Supabase Storage is not configured, the service falls back to the local cache directory.


## Troubleshooting

### `ffmpeg` Command Not Found

Confirm the binary is installed:

```bash
ffmpeg -version
```

If the command fails:

- macOS: rerun `brew install ffmpeg`.
- Debian/Ubuntu: rerun `sudo apt install ffmpeg`.
- Windows: confirm the ffmpeg `bin` folder is added to `Path`, then open a new PowerShell window.

### Python Package Collisions

If imports fail after installing dependencies, confirm the virtual environment is active before running commands:

```bash
python -m pip --version
python -m pip install -r requirements.txt
```

The pip path should point inside `apps/ml/venv`. If it points to a global Python installation, reactivate the environment.

### Whisper Model Download Fails

The first server startup may download Whisper model files. If startup fails during model download:

- Check that your internet connection is available.
- Retry the `python -m uvicorn main:app --reload --port 8000` command.
- Ensure the environment has enough disk space for local model cache files.

### Server Starts Slowly

Whisper loads into memory when the ASR router is imported. The first startup can take longer because the model is downloaded and cached. Later startups should be faster.

### Port 8000 Already in Use

Run the service on another port:

```bash
python -m uvicorn main:app --reload --port 8001
```

## Load Testing with Locust

Locust is listed in `requirements.txt`, so install the ML dependencies before
starting the load test. The test uploads the existing WAV fixture at
`tests/fixtures/hindi_sample.wav` to `POST /asr/transcribe` as multipart form
data.

Start the ML/Whisper service with the setup instructions above. In a second
terminal, run Locust from `apps/ml`:

```bash
cd apps/ml
locust -f tests/locustfile.py
```

Open the Locust web UI at <http://localhost:8089>. Enter the service host
running the ASR endpoint. For the local service default, use:

```text
http://localhost:8000
```

The user count controls the maximum concurrent Locust users. Spawn rate
controls how quickly Locust starts those users per second. Start small so the
local Whisper model and machine have time to warm up:

| Profile | Users | Spawn Rate |
| --- | ---: | ---: |
| Smoke | 1 | 1 |
| Small load | 5 | 1 |
| Medium load | 10 | 2 |
| Stress | Increase gradually | Match local capacity |

For each run, record the configured concurrent users, requests per second
(RPS), average response time, p95 response time when Locust reports it, and
failure rate. The Locust Statistics view shows request counts, response times,
RPS, and failures while the test is running.

| Users | Spawn Rate | Duration | Avg Response Time | p95 Response Time | RPS | Failures | Notes |
| ---: | ---: | --- | --- | --- | ---: | --- | --- |
|  |  |  |  |  |  |  |  |

Actual results depend on the local machine, Whisper model size, CPU or GPU
availability, and WAV recording duration. Keep the table as a benchmark
template unless a run has been measured locally.

A headless smoke run is also available when the ML service is already running:

```bash
cd apps/ml
locust -f tests/locustfile.py --host http://localhost:8000 --headless -u 1 -r 1 -t 30s
```
