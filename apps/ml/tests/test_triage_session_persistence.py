import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
import services.triage_graph as triage_graph

client = TestClient(app)


@pytest.fixture
def anyio_backend():
    return "asyncio"


class FakeRedis:
    """Minimal in-memory stand-in for the async Redis client used in tests."""

    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        self.store[key] = value
        return True

    async def delete(self, *keys):
        removed = 0
        for key in keys:
            if self.store.pop(key, None) is not None:
                removed += 1
        return removed


# ---------------------------------------------------------------------------
# services.triage_graph — unit-level tests
# ---------------------------------------------------------------------------

def test_save_and_load_session_state_roundtrip(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setattr(triage_graph, "redis_client", fake_redis)

    state = {
        "language": "Hindi",
        "emergency_detected": False,
        "collected_info": {"onset": "2 days ago", "severity": "mild"},
        "retrieved_medicines": [{"brand_name": "Crocin"}],
        "messages": [{"role": "user", "content": "should not be persisted"}],
    }

    asyncio.run(triage_graph._save_session_state("session-abc", state))
    loaded = asyncio.run(triage_graph._load_session_state("session-abc"))

    assert loaded["language"] == "Hindi"
    assert loaded["collected_info"]["onset"] == "2 days ago"
    assert loaded["retrieved_medicines"] == [{"brand_name": "Crocin"}]
    # messages are intentionally excluded from persisted state
    assert "messages" not in loaded


def test_load_session_state_missing_session_returns_none(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setattr(triage_graph, "redis_client", fake_redis)

    assert asyncio.run(triage_graph._load_session_state("does-not-exist")) is None


def test_load_session_state_corrupt_json_returns_none(monkeypatch):
    fake_redis = FakeRedis()
    fake_redis.store[triage_graph._session_key("bad-session")] = "not valid json {"
    monkeypatch.setattr(triage_graph, "redis_client", fake_redis)

    assert asyncio.run(triage_graph._load_session_state("bad-session")) is None


def test_load_session_state_redis_error_returns_none(monkeypatch):
    class BrokenRedis:
        async def get(self, key):
            raise ConnectionError("redis unavailable")

    monkeypatch.setattr(triage_graph, "redis_client", BrokenRedis())

    # Should not raise — gracefully falls back to a fresh session.
    assert asyncio.run(triage_graph._load_session_state("session-x")) is None


def test_clear_session_state_removes_stored_session(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setattr(triage_graph, "redis_client", fake_redis)

    asyncio.run(
        triage_graph._save_session_state(
            "session-to-clear",
            {
                "language": "Tamil",
                "emergency_detected": False,
                "collected_info": {"onset": "today"},
                "retrieved_medicines": [],
            },
        )
    )
    assert asyncio.run(triage_graph._load_session_state("session-to-clear")) is not None

    removed = asyncio.run(triage_graph._clear_session_state("session-to-clear"))

    assert removed is True
    # The state should be gone, so a subsequent load starts fresh.
    assert asyncio.run(triage_graph._load_session_state("session-to-clear")) is None


def test_clear_session_state_unknown_session_is_noop(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setattr(triage_graph, "redis_client", fake_redis)

    # Clearing a session that was never stored (or already expired) is harmless.
    assert asyncio.run(triage_graph._clear_session_state("never-existed")) is False


def test_clear_session_state_redis_error_returns_false(monkeypatch):
    class BrokenRedis:
        async def delete(self, *keys):
            raise ConnectionError("redis unavailable")

    monkeypatch.setattr(triage_graph, "redis_client", BrokenRedis())

    # A Redis failure must not surface as an exception to the caller.
    assert asyncio.run(triage_graph._clear_session_state("session-y")) is False


@pytest.mark.anyio
async def test_clear_session_runs_async_helper(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setattr(triage_graph, "redis_client", fake_redis)

    await triage_graph._save_session_state(
        "wrapper-session",
        {
            "language": "English",
            "emergency_detected": False,
            "collected_info": {},
            "retrieved_medicines": [],
        },
    )

    assert await triage_graph.clear_session("wrapper-session") is True
    assert await triage_graph.clear_session("wrapper-session") is False


@pytest.mark.anyio
async def test_run_triage_flow_reuses_persisted_state(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setattr(triage_graph, "redis_client", fake_redis)
    monkeypatch.setattr(triage_graph, "LANGGRAPH_AVAILABLE", True)

    # Pre-populate a session with prior collected_info, as if turn 1 already ran.
    await triage_graph._save_session_state(
        "session-continue",
        {
            "language": "English",
            "emergency_detected": False,
            "collected_info": {"onset": "yesterday", "severity": "unknown"},
            "retrieved_medicines": [],
        },
    )

    captured_initial_state = {}

    async def fake_invoke(initial_state):
        captured_initial_state.update(initial_state)
        return {
            "response": "Got it, thanks.",
            "emergency_detected": False,
            "language": "English",
            "final_summary": "ok",
            "recommendations": [],
            "disclaimer": "",
            "collected_info": initial_state["collected_info"],
        }

    fake_app = MagicMock()
    fake_app.ainvoke.side_effect = fake_invoke
    monkeypatch.setattr(triage_graph, "triage_app", fake_app)

    new_messages = [{"role": "user", "content": "it's also severe now"}]
    result = await triage_graph.run_triage_flow(new_messages, session_id="session-continue")

    # Prior turn's collected_info should have been rehydrated into the graph's
    # starting state instead of being lost.
    assert captured_initial_state["collected_info"]["onset"] == "yesterday"
    # This request's messages always take precedence over any stored ones.
    assert captured_initial_state["messages"] == new_messages
    assert result["response"] == "Got it, thanks."


@pytest.mark.anyio
async def test_run_triage_flow_missing_session_starts_fresh(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setattr(triage_graph, "redis_client", fake_redis)
    monkeypatch.setattr(triage_graph, "LANGGRAPH_AVAILABLE", True)

    captured_initial_state = {}

    async def fake_invoke(initial_state):
        captured_initial_state.update(initial_state)
        return {
            "response": "Hello, how can I help?",
            "emergency_detected": False,
            "language": "English",
            "final_summary": "",
            "recommendations": [],
            "disclaimer": "",
            "collected_info": {},
        }

    fake_app = MagicMock()
    fake_app.ainvoke.side_effect = fake_invoke
    monkeypatch.setattr(triage_graph, "triage_app", fake_app)

    result = await triage_graph.run_triage_flow(
        [{"role": "user", "content": "hi"}], session_id="brand-new-or-expired-session"
    )

    # No prior state existed, so it should fall back to defaults, not error out.
    assert captured_initial_state["collected_info"] == {}
    assert result["response"] == "Hello, how can I help?"


@pytest.mark.anyio
async def test_run_triage_flow_without_session_skips_persistence(monkeypatch):
    monkeypatch.setattr(triage_graph, "LANGGRAPH_AVAILABLE", True)
    load_session = AsyncMock()
    save_session = AsyncMock()
    monkeypatch.setattr(triage_graph, "_load_session_state", load_session)
    monkeypatch.setattr(triage_graph, "_save_session_state", save_session)

    final_state = {
        "response": "How can I help?",
        "emergency_detected": False,
        "language": "English",
        "final_summary": "",
        "recommendations": [],
        "disclaimer": "",
        "collected_info": {},
    }
    fake_app = MagicMock()
    fake_app.ainvoke = AsyncMock(return_value=final_state)
    monkeypatch.setattr(triage_graph, "triage_app", fake_app)

    result = await triage_graph.run_triage_flow([{"role": "user", "content": "hi"}])

    load_session.assert_not_awaited()
    save_session.assert_not_awaited()
    fake_app.ainvoke.assert_awaited_once()
    assert result == {
        "response": "How can I help?",
        "emergency": False,
        "language": "English",
        "summary": "",
        "recommendations": [],
        "disclaimer": "",
        "details": {},
    }


# ---------------------------------------------------------------------------
# routers.triage — endpoint-level tests
# ---------------------------------------------------------------------------

@patch("routers.triage.run_triage_flow", new_callable=AsyncMock)
def test_triage_chat_generates_session_id_when_omitted(mock_run_triage):
    mock_run_triage.return_value = {
        "response": "How long have you had this pain?",
        "emergency": False,
        "language": "English",
        "summary": "Mild headache symptoms",
        "recommendations": ["Rest"],
        "disclaimer": "Informational only",
        "details": {"onset": "unknown"},
    }

    payload = {"messages": [{"role": "user", "content": "I have a headache."}]}
    response = client.post("/triage/chat", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "session_id" in data and data["session_id"]

    # The generated session_id should have been forwarded to run_triage_flow.
    _, kwargs = mock_run_triage.call_args
    assert kwargs["session_id"] == data["session_id"]
    mock_run_triage.assert_awaited_once()


@patch("routers.triage.run_triage_flow", new_callable=AsyncMock)
def test_triage_chat_reuses_supplied_session_id(mock_run_triage):
    mock_run_triage.return_value = {
        "response": "Thanks, noted.",
        "emergency": False,
        "language": "English",
        "summary": "",
        "recommendations": [],
        "disclaimer": "",
        "details": {},
    }

    payload = {
        "messages": [{"role": "user", "content": "it's worse now"}],
        "session_id": "existing-session-123",
    }
    response = client.post("/triage/chat", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == "existing-session-123"

    _, kwargs = mock_run_triage.call_args
    assert kwargs["session_id"] == "existing-session-123"
    mock_run_triage.assert_awaited_once()


@patch("routers.triage.clear_session", new_callable=AsyncMock)
def test_triage_clear_removes_existing_session(mock_clear):
    mock_clear.return_value = True

    response = client.post("/triage/clear", json={"session_id": "existing-session-123"})

    assert response.status_code == 200
    data = response.json()
    assert data == {"session_id": "existing-session-123", "cleared": True}
    mock_clear.assert_awaited_once_with("existing-session-123")


@patch("routers.triage.clear_session", new_callable=AsyncMock)
def test_triage_clear_unknown_session_reports_not_cleared(mock_clear):
    mock_clear.return_value = False

    response = client.post("/triage/clear", json={"session_id": "never-existed"})

    assert response.status_code == 200
    data = response.json()
    assert data == {"session_id": "never-existed", "cleared": False}
    mock_clear.assert_awaited_once_with("never-existed")


def test_triage_clear_requires_session_id():
    # Missing session_id fails request validation before touching Redis.
    response = client.post("/triage/clear", json={})
    assert response.status_code == 422

    # An empty session_id is likewise rejected by the min_length constraint.
    response = client.post("/triage/clear", json={"session_id": ""})
    assert response.status_code == 422


def test_triage_clear_is_rate_limited():
    """/clear sits behind the same per-IP limiter as /chat (5 req/60s)."""
    from utils.database import get_redis

    class OverLimitPipeline:
        async def incr(self, key):
            pass

        async def ttl(self, key):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def execute(self):
            # Simulate a client already past the 5-requests-per-window limit.
            return [6, 30]

    class OverLimitRedis:
        def pipeline(self, transaction=True):
            return OverLimitPipeline()

        async def expire(self, key, seconds):
            return True

    async def over_limit_redis():
        return OverLimitRedis()

    app.dependency_overrides[get_redis] = over_limit_redis
    try:
        response = client.post("/triage/clear", json={"session_id": "abc"})
    finally:
        app.dependency_overrides.pop(get_redis, None)

    assert response.status_code == 429
