# PR #312 — Codex/ml telemetry logging

> **Merged:** 2026-05-19 | **Author:** @palakjaiswal16 | **Area:** ML/AI | **Impact Score:** 32 | **Closes:** #293

## What Changed

This pull request introduces a dedicated telemetry logging service for our ML inference components, specifically targeting the Whisper ASR transcription flow. We've added helper functions to measure transcription latency, audio clip duration, and memory usage, and integrated these measurements into the `transcribe_audio` endpoint. Furthermore, we've centralized the application's base logging configuration to ensure consistent telemetry output.

## The Problem Being Solved

Before this PR, our ML service, particularly the ASR transcription endpoint, lacked granular visibility into its operational performance. We had no standardized way to track key metrics such as the time taken for audio transcription, the duration of the processed audio clips, or the memory consumption during inference. This absence of telemetry made it challenging to identify performance bottlenecks, optimize resource allocation, debug latency issues, or make data-driven decisions regarding model scaling and deployment. The linked issue #293 highlighted this critical need for better observability within our ML pipeline to ensure the SahiDawa platform remains efficient and scalable for rural health applications.

## Files Modified

- `apps/ml/main.py`
- `apps/ml/routers/asr.py`
- `apps/ml/services/telemetry.py`
- `apps/ml/tests/test_telemetry.py`

## Implementation Details

We implemented a new service module, `apps/ml/services/telemetry.py`, to encapsulate all telemetry-related logic.

1.  **`apps/ml/services/telemetry.py`**:
    *   **`TELEMETRY_LOGGER_NAME`**: A constant `sahidawa.ml.telemetry` is defined for consistent logger identification.
    *   **`configure_telemetry_logging(level: int = logging.INFO)`**: This function is responsible for setting up the root logger's basic configuration with a standardized format (`%(asctime)s %(levelname)s [%(name)s] %(message)s`). Crucially, it also ensures `tracemalloc.start()` is called if tracing is not already active, providing a fallback mechanism for memory tracking.
    *   **`get_telemetry_logger()`**: A simple getter to retrieve the logger instance named `TELEMETRY_LOGGER_NAME`.
    *   **`start_timer()`**: Returns `time.perf_counter()`, providing a high-resolution timestamp for measuring elapsed time.
    *   **`get_memory_usage_mb()`**: This is a robust, multi-platform function designed to retrieve the current process's Resident Set Size (RSS) memory usage in megabytes. It attempts to use `psutil` first for its comprehensive capabilities. If `psutil` is unavailable, it falls back to Windows-specific `ctypes` calls (`GetProcessMemoryInfo`) for `WorkingSetSize`. If neither `psutil` nor `ctypes` (on Windows) succeed, it tries `resource.getrusage(resource.RUSAGE_SELF).ru_maxrss` (common on POSIX systems). As a final fallback, it uses Python's built-in `tracemalloc.get_traced_memory()` to report peak memory usage. This layered approach ensures memory metrics are captured across various deployment environments.
    *   **`get_audio_duration_seconds(audio_data: Any, sample_rate: int | float)`**: Calculates the duration of an audio clip in seconds given its raw `audio_data` (e.g., a NumPy array) and `sample_rate`. It handles both array-like objects with a `shape` attribute and simple sequences.
    *   **`log_transcription_finished(...)`**: This is the core logging function. It takes a `started_at` timestamp, `audio_duration_seconds`, `memory_before_mb`, and an optional `logger`. It calculates the `elapsed_seconds` and `memory_delta_mb` (current memory minus `memory_before_mb`) and logs a formatted message including these metrics.

2.  **`apps/ml/main.py`**:
    *   We imported `configure_telemetry_logging` from `services.telemetry`.
    *   `configure_telemetry_logging()` is now called immediately after `load_dotenv()` at the application's startup. This centralizes the basic logging configuration for the entire ML service.

3.  **`apps/ml/routers/asr.py`**:
    *   We removed the generic `logging.basicConfig(level=logging.INFO)` call, as the global logging configuration is now handled by `configure_telemetry_logging` in `main.py`.
    *   We imported `get_audio_duration_seconds`, `get_memory_usage_mb`, `get_telemetry_logger`, `log_transcription_finished`, and `start_timer` from `services.telemetry`.
    *   A `telemetry_logger` instance is initialized using `get_telemetry_logger()`.
    *   Within the `transcribe_audio` asynchronous endpoint:
        *   `audio_duration_seconds` is calculated using `get_audio_duration_seconds` after the normalized WAV file is read by `soundfile`.
        *   `transcription_started_at` is captured using `start_timer()` just before `model.transcribe()` is called.
        *   `memory_before_mb` is captured using `get_memory_usage_mb()` just before `model.transcribe()` is called.
        *   After the transcription completes and the `transcript` is assembled, `log_transcription_finished` is called with the collected metrics (`started_at`, `audio_duration_seconds`, `memory_before_mb`, and `telemetry_logger`).

4.  **`apps/ml/tests/test_telemetry.py`**:
    *   A new test file was added to verify the core telemetry functions.
    *   `test_get_audio_duration_seconds()`: Asserts the correct calculation of audio duration for a given `numpy` array and sample rate.
    *   `test_log_transcription_finished_outputs_latency_message(caplog)`: Uses `pytest`'s `caplog` fixture to verify that `log_transcription_finished` produces the expected log message containing "transcription finished in", "audio clip", and "memory" details.

## Technical Decisions

1.  **Dedicated Telemetry Service (`services/telemetry.py`)**: We chose to create a separate module for telemetry concerns to maintain a clean separation of concerns. This makes the telemetry logic reusable across different ML models or endpoints and keeps the core business logic in `asr.py` focused on transcription.
2.  **Centralized Logging Configuration**: Moving `logging.basicConfig` to `apps/ml/main.py` via `configure_telemetry_logging` ensures that our application's logging setup is consistent and applied once at startup. This prevents potential conflicts or overrides that could arise from multiple modules attempting to configure the root logger independently.
3.  **Robust Memory Measurement (`get_memory_usage_mb`)**: The decision to implement multiple fallback mechanisms for memory usage was driven by the need for cross-platform compatibility and resilience. Relying solely on `psutil` would introduce an external dependency that might not always be available or desired in all deployment environments. By attempting `psutil`, then platform-specific APIs (Windows `ctypes`), then `resource`, and finally `tracemalloc`, we maximize the chances of successfully capturing memory metrics without requiring specific OS-level tools or Python packages to be present. `tracemalloc` serves as a valuable built-in Python fallback.
4.  **High-Resolution Timer (`time.perf_counter`)**: For measuring transcription latency, `time.perf_counter()` was chosen over `time.time()` because it provides a higher-resolution timer, ideal for benchmarking short-duration operations like model inference, and is not subject to system clock adjustments.
5.  **Specific Telemetry Logger Name**: Using `TELEMETRY_LOGGER_NAME = "sahidawa.ml.telemetry"` allows for easy filtering, routing, or even different handling of telemetry logs compared to general application logs. This could be beneficial for integration with external monitoring systems.
6.  **Integration Points**: Placing the timing and memory measurements directly around the `model.transcribe()` call ensures we capture the most relevant performance data for the core inference step, rather than including file I/O or pre/post-processing overhead in the primary latency metric.

## How To Re-Implement (Contributor Reference)

To re-implement this telemetry feature from scratch, a contributor would follow these steps:

1.  **Create the Telemetry Service Module**:
    *   Create `apps/ml/services/telemetry.py`.
    *   Define a constant `TELEMETRY_LOGGER_NAME = "sahidawa.ml.telemetry"`.
    *   Implement `configure_telemetry_logging(level: int = logging.INFO)`: This function should call `logging.basicConfig` with a desired format (e.g., `"%(asctime)s %(levelname)s [%(name)s] %(message)s"`) and ensure `tracemalloc.start()` is called for memory tracing.
    *   Implement `get_telemetry_logger()`: A simple wrapper around `logging.getLogger(TELEMETRY_LOGGER_NAME)`.
    *   Implement `start_timer()`: Return `time.perf_counter()`.
    *   Implement `get_memory_usage_mb()`: This is the most complex part. Start with `psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)`. Include `try...except` blocks. If `psutil` fails, add platform-specific alternatives (e.g., `ctypes` for Windows, `resource.getrusage` for POSIX). Finally, include `tracemalloc.get_traced_memory()` as a last resort, ensuring `tracemalloc.start()` is called if not already active.
    *   Implement `get_audio_duration_seconds(audio_data: Any, sample_rate: int | float)`: Calculate `sample_count / sample_rate`, handling `audio_data` as a NumPy array (using `shape[0]`) or a generic sequence (using `len`).
    *   Implement `log_transcription_finished(...)`: This function should accept `started_at`, `audio_duration_seconds`, `memory_before_mb`, and an optional `logger`. Calculate `elapsed_seconds` and `memory_delta_mb`, then use the provided or default telemetry logger to log a formatted string (e.g., `f"transcription finished in %.2f seconds for %.2f seconds of audio clip | memory %.2f MB (delta %.2f MB)"`).

2.  **Integrate Telemetry Configuration into Application Startup**:
    *   In `apps/ml/main.py`, import `configure_telemetry_logging`.
    *   Call `configure_telemetry_logging()` early in the application's lifecycle, typically after environment variables are loaded.

3.  **Integrate Telemetry into the ASR Router**:
    *   In `apps/ml/routers/asr.py`, remove any existing `logging.basicConfig` calls.
    *   Import all necessary functions from `services.telemetry`: `get_audio_duration_seconds`, `get_memory_usage_mb`, `get_telemetry_logger`, `log_transcription_finished`, `start_timer`.
    *   Initialize `telemetry_logger = get_telemetry_logger()` at the module level.
    *   Within the `transcribe_audio` endpoint:
        *   Declare variables like `transcription_started_at`, `audio_duration_seconds`, `memory_before_mb` initialized to `None` or `0.0`.
        *   After reading the audio data (e.g., with `sf.read`), calculate `audio_duration_seconds = get_audio_duration_seconds(audio_data, sample_rate)`.
        *   Immediately before calling `model.transcribe()`:
            *   Set `transcription_started_at = start_timer()`.
            *   Set `memory_before_mb = get_memory_usage_mb()`.
        *   Immediately after `model.transcribe()` completes and the `transcript` is formed:
            *   Call `log_transcription_finished(started_at=transcription_started_at, audio_duration_seconds=audio_duration_seconds, memory_before_mb=memory_before_mb, logger=telemetry_logger)`.

4.  **Add Unit Tests**:
    *   Create `apps/ml/tests/test_telemetry.py`.
    *   Write tests for `get_audio_duration_seconds` using `numpy` arrays.
    *   Write tests for `log_transcription_finished` using `pytest`'s `caplog` fixture to assert that the correct log messages are generated. Mock `time.perf_counter()` and `get_memory_usage_mb()` if precise values are needed for assertions.

## Impact on System Architecture

This change significantly enhances the observability of our ML service, particularly for the critical ASR transcription pipeline.

1.  **Improved Operational Visibility**: We now have concrete, measurable metrics for transcription latency, audio processing duration, and memory footprint. This unlocks the ability to monitor the ML service's health and performance in real-time, which is crucial for a production system like SahiDawa.
2.  **Foundation for Performance Optimization**: By logging these metrics, we can identify performance bottlenecks (e.g., unusually high latency for certain audio durations, unexpected memory spikes). This data will guide future optimization efforts for the Whisper model, pre-processing steps, or infrastructure scaling.
3.  **Data-Driven Decision Making**: The collected telemetry provides empirical data to inform decisions about model updates, resource provisioning (CPU/GPU, RAM), and cost optimization. For instance, if memory usage is consistently low, we might consider smaller instance types. If latency is high, we might explore faster models or distributed inference.
4.  **Enhanced Debugging and Troubleshooting**: When issues arise (e.g., a user reports slow transcription), we can now correlate specific requests with their performance metrics in the logs, significantly speeding up debugging and root cause analysis.
5.  **Modularity and Maintainability**: By encapsulating telemetry logic in a dedicated service, we've improved the modularity of our ML codebase. This makes it easier to extend telemetry to other ML models or endpoints in the future without cluttering existing business logic.
6.  **No External API Changes**: This change is entirely internal to the ML service and does not affect any external APIs, data models, or user-facing functionality. Its impact is primarily on the operational and development aspects of the platform.

## Testing & Verification

The changes introduced in this PR were verified through a combination of compilation checks, direct smoke tests, and dedicated unit tests.

1.  **Compilation Verification**: We ensured that all touched Python files compiled successfully using `python -m compileall apps/ml/main.py apps/ml/routers/asr.py apps/ml/services/telemetry.py`. This confirmed basic syntax correctness and module integrity.
2.  **Direct Telemetry Smoke Test**: A manual smoke test was performed by directly invoking the telemetry logging helper. This involved simulating a transcription flow and observing the terminal output. The expected log message, `transcription finished in X.XX seconds for Y.YY seconds of audio clip`, was successfully printed, confirming the basic functionality of `log_transcription_finished`.
3.  **Unit Tests (`apps/ml/tests/test_telemetry.py`)**:
    *   `test_get_audio_duration_seconds`: This test verifies the accuracy of our audio duration calculation. It uses a `numpy.zeros` array to simulate audio data and asserts that `get_audio_duration_seconds` returns the correct duration based on a given sample rate.
    *   `test_log_transcription_finished_outputs_latency_message`: This test uses `pytest`'s `caplog` fixture to capture log output. It calls `log_transcription_finished` with dummy data and then asserts that the captured log text contains the key phrases "transcription finished in", "for 2.00 seconds of audio clip", and "memory", ensuring the log message is correctly formatted and includes all expected metrics.

While these tests cover the core telemetry functions, full end-to-end integration testing of the ASR endpoint with actual audio files would be part of a broader system test suite to ensure the telemetry is correctly captured under various real-world conditions. This PR focused on establishing the robust logging mechanism itself.