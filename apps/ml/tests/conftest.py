import os
import shutil
import sys
from types import SimpleNamespace

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Guarantee a GEMINI_API_KEY before the app modules load, so any code path
# that expects the variable (triage get_llm, embedding embed_query) works in
# environments without the real secret (CI, fresh local checkouts). Tests mock
# the LLM, so the placeholder value is never used for a real API call.
os.environ.setdefault("GEMINI_API_KEY", "mock_api_key_for_testing")

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


@pytest.fixture(autouse=True)
def override_ml_auth(request):
    """Bypass the x-api-key check for tests that aren't about auth.

    Every ML route now requires a valid key (dependencies.verify_api_key), so
    feature tests that hit those routes would otherwise all fail with 401. They
    target route behaviour, not auth, so we override the dependency to a no-op.
    The dedicated auth tests in test_api.py opt out and exercise the real check.
    """
    if "test_api" in request.module.__name__:
        yield
        return

    from main import app
    from dependencies import verify_api_key

    app.dependency_overrides[verify_api_key] = lambda: None
    yield
    app.dependency_overrides.pop(verify_api_key, None)


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

