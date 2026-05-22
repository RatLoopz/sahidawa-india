# ADR — Codex/ml telemetry logging

> **Date:** 2026-05-19 | **PR:** #312 | **Status:** Accepted

## Context

The SahiDawa ML service, specifically its Automatic Speech Recognition (ASR) component, lacked granular performance visibility. There was no standardized mechanism to track key operational metrics such as transcription latency, audio processing duration, or memory consumption per request. This absence hindered performance analysis, optimization efforts, and proactive identification of resource bottlenecks, which are critical for a high-throughput, resource-sensitive service.

## Decision

A dedicated telemetry logging system was implemented within the ML service to capture critical performance metrics. This involved:
1.  Introduction of a new `apps/ml/services/telemetry.py` module to centralize telemetry-related helper functions, including timer management (`start_timer`), memory usage (`get_memory_usage_mb` leveraging `psutil` and `tracemalloc`), and audio duration calculation (`get_audio_duration_seconds`).
2.  Configuration of a distinct telemetry logger (`sahidawa.ml.telemetry`) at the application entry point (`apps/ml/main.py`) using `logging.basicConfig` and initiation of `tracemalloc` for memory profiling.
3.  Integration of telemetry calls into the ASR transcription flow (`apps/ml/routers/asr.py`). Specifically, `start_timer`, `get_audio_duration_seconds`, and `get_memory_usage_mb` were invoked before and after the `model.transcribe` operation, with results logged via `log_transcription_finished` to the dedicated telemetry logger.
4.  Standard application logging (`logging.getLogger(__name__)`) was retained for general operational messages, separating telemetry from other log types.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **External APM/Monitoring Solution** | Would introduce an external dependency (e.g., Prometheus, Datadog agent), requiring additional setup, configuration, and potential licensing costs. The current solution leverages existing logging infrastructure, offering a lightweight, immediate path to visibility without external service integration overhead. |
| **Database-backed Metric Storage** | Storing metrics directly in a database would necessitate schema design, database write operations for each request, and a separate query interface for analysis. Logging to standard output, which can be aggregated by existing log management systems, was deemed simpler and more performant for initial data collection. |
| **Manual Profiling on Demand** | Relying solely on manual profiling tools (e.g., `cProfile`, `memory_profiler`) when performance issues arose would be a reactive approach. It would not provide continuous, real-time insights into performance trends or intermittent issues, making proactive optimization difficult. |

## Consequences

**Positive:**
- Enhanced visibility into the performance characteristics of the ASR transcription process, including latency, audio duration, and memory footprint.
- Provides actionable data for performance optimization, resource allocation, and capacity planning for the ML service.
- Establishes a foundational telemetry framework that can be extended for other ML service metrics.
- Leverages standard Python logging, simplifying integration with existing log aggregation systems.

**Trade-offs:**
- Introduces a minor computational overhead to each ASR request due to metric collection and logging.
- Relies on `psutil` for memory usage, adding a runtime dependency to the ML service.
- Telemetry data is currently output to standard logs, requiring external log parsing or aggregation for advanced analytics and visualization.

## Related Issues & PRs

- PR #312: Codex/ml telemetry logging
- Issue #293