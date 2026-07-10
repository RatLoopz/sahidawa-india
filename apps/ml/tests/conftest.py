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
    original_run = asr.subprocess.run
    def dummy_run(*args, **kwargs):
        cmd = args[0] if args else kwargs.get("args", "")
        cmd_str = str(cmd)
        if "ffmpeg" in cmd_str:
            is_text = kwargs.get("text") or kwargs.get("universal_newlines")
            return SimpleNamespace(returncode=0, stderr="" if is_text else b"", stdout="" if is_text else b"")
        return original_run(*args, **kwargs)
    monkeypatch.setattr(
        asr.subprocess,
        "run",
        dummy_run,
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


class FakeRedis:
    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        self.store[key] = value
        return True

    def pipeline(self, transaction=True):
        return FakePipeline()

    async def expire(self, key, seconds):
        return True


class FakePipeline:
    async def incr(self, key):
        pass

    async def ttl(self, key):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    async def execute(self):
        return [1, 60]


@pytest.fixture(autouse=True)
def mock_get_redis():
    from main import app
    from utils.database import get_redis

    async def fake_get_redis():
        return FakeRedis()

    app.dependency_overrides[get_redis] = fake_get_redis
    yield
    app.dependency_overrides.pop(get_redis, None)

