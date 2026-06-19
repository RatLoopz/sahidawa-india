import os
import shutil
import sys
from types import SimpleNamespace

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from routers import asr


@pytest.fixture(autouse=True)
def mock_ffmpeg_deps(monkeypatch):
    monkeypatch.setattr(
        asr.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0, stderr=b"", stdout=b""),
    )
    monkeypatch.setattr(
        asr.sf,
        "read",
        lambda *args, **kwargs: (np.zeros(16000, dtype=np.float32), 16000),
    )
    monkeypatch.setattr(asr.nr, "reduce_noise", lambda y, sr: y)
