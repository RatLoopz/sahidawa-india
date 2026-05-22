import logging
import os
import time
import tracemalloc
from typing import Any


TELEMETRY_LOGGER_NAME = "sahidawa.ml.telemetry"


def configure_telemetry_logging(level: int = logging.INFO) -> None:
    """Configure process-wide telemetry logging for the ML service."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )

    if not tracemalloc.is_tracing():
        tracemalloc.start()


def get_telemetry_logger() -> logging.Logger:
    return logging.getLogger(TELEMETRY_LOGGER_NAME)


def start_timer() -> float:
    return time.perf_counter()


def get_memory_usage_mb() -> float:
    try:
        import psutil

        return psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)
    except Exception:
        pass

    if os.name == "nt":
        try:
            import ctypes
            from ctypes import wintypes

            class ProcessMemoryCounters(ctypes.Structure):
                _fields_ = [
                    ("cb", wintypes.DWORD),
                    ("PageFaultCount", wintypes.DWORD),
                    ("PeakWorkingSetSize", ctypes.c_size_t),
                    ("WorkingSetSize", ctypes.c_size_t),
                    ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                    ("PagefileUsage", ctypes.c_size_t),
                    ("PeakPagefileUsage", ctypes.c_size_t),
                ]

            psapi = ctypes.WinDLL("psapi")
            kernel32 = ctypes.WinDLL("kernel32")
            psapi.GetProcessMemoryInfo.argtypes = [
                wintypes.HANDLE,
                ctypes.POINTER(ProcessMemoryCounters),
                wintypes.DWORD,
            ]
            psapi.GetProcessMemoryInfo.restype = wintypes.BOOL
            kernel32.GetCurrentProcess.restype = wintypes.HANDLE

            counters = ProcessMemoryCounters()
            counters.cb = ctypes.sizeof(ProcessMemoryCounters)
            process_handle = kernel32.GetCurrentProcess()
            psapi.GetProcessMemoryInfo(
                process_handle,
                ctypes.byref(counters),
                counters.cb,
            )
            return counters.WorkingSetSize / (1024 * 1024)
        except Exception:
            pass

    try:
        import resource

        usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        if os.name == "posix":
            return usage / 1024
        return usage / (1024 * 1024)
    except Exception:
        pass

    try:
        if not tracemalloc.is_tracing():
            tracemalloc.start()
        _, peak = tracemalloc.get_traced_memory()
        return peak / (1024 * 1024)
    except Exception:
        return 0.0


def get_audio_duration_seconds(audio_data: Any, sample_rate: int | float) -> float:
    if not sample_rate:
        return 0.0

    audio_shape = getattr(audio_data, "shape", None)
    sample_count = audio_shape[0] if audio_shape else len(audio_data)
    return float(sample_count) / float(sample_rate)


def log_transcription_finished(
    *,
    started_at: float,
    audio_duration_seconds: float,
    memory_before_mb: float,
    logger: logging.Logger | None = None,
) -> None:
    elapsed_seconds = time.perf_counter() - started_at
    memory_after_mb = get_memory_usage_mb()
    memory_delta_mb = memory_after_mb - memory_before_mb

    (logger or get_telemetry_logger()).info(
        "transcription finished in %.2f seconds for %.2f seconds of audio clip | "
        "memory %.2f MB (delta %.2f MB)",
        elapsed_seconds,
        audio_duration_seconds,
        memory_after_mb,
        memory_delta_mb,
    )
