import logging
import os
import sys
import time
from types import SimpleNamespace

import numpy as np


sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services import telemetry
from services.telemetry import (
    get_audio_duration_seconds,
    log_transcription_finished,
)


def test_get_audio_duration_seconds():
    audio_data = np.zeros(32000, dtype=np.float32)

    assert get_audio_duration_seconds(audio_data, 16000) == 2.0


def test_log_transcription_finished_outputs_latency_message(caplog):
    logger = logging.getLogger("test.telemetry")

    with caplog.at_level(logging.INFO, logger=logger.name):
        log_transcription_finished(
            started_at=time.perf_counter(),
            audio_duration_seconds=2.0,
            memory_before_mb=0.0,
            logger=logger,
        )

    assert "transcription finished in" in caplog.text
    assert "for 2.00 seconds of audio clip" in caplog.text
    assert "memory" in caplog.text


def test_get_memory_usage_resource_fallback_converts_darwin_bytes(monkeypatch):
    usage_bytes = 100 * 1024 * 1024
    resource_stub = SimpleNamespace(
        RUSAGE_SELF=object(),
        getrusage=lambda _: SimpleNamespace(ru_maxrss=usage_bytes),
    )

    monkeypatch.setitem(sys.modules, "psutil", None)
    monkeypatch.setitem(sys.modules, "resource", resource_stub)
    monkeypatch.setattr(telemetry.os, "name", "posix")
    monkeypatch.setattr(sys, "platform", "darwin")

    assert telemetry.get_memory_usage_mb() == 100


def test_get_memory_usage_resource_fallback_keeps_linux_kilobytes(monkeypatch):
    usage_kb = 100 * 1024
    resource_stub = SimpleNamespace(
        RUSAGE_SELF=object(),
        getrusage=lambda _: SimpleNamespace(ru_maxrss=usage_kb),
    )

    monkeypatch.setitem(sys.modules, "psutil", None)
    monkeypatch.setitem(sys.modules, "resource", resource_stub)
    monkeypatch.setattr(telemetry.os, "name", "posix")
    monkeypatch.setattr(sys, "platform", "linux")

    assert telemetry.get_memory_usage_mb() == 100
