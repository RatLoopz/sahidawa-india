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


@pytest.fixture(autouse=True)
def mock_ner_model(request, monkeypatch):
    """
    Prevent the slow scispaCy model from loading during unit tests,
    which causes a 60s+ timeout on Python 3.12 due to regex compilation.
    Skip this mock only for the actual NER tests.
    """
    if "test_medicine_ner" in request.module.__name__:
        return
        
    try:
        import services.medicine_ner as medicine_ner
        monkeypatch.setattr(medicine_ner, "_load_model", lambda: False)
    except ImportError:
        pass
