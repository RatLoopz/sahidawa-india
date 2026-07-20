# PR #3760 — perf(ml): add Redis circuit breaker to triage flow to avoid double-timeout

> **Merged:** 2026-07-20 | **Author:** @skypank-coder | **Area:** ML/AI | **Impact Score:** 16 | **Closes:** #3744

## What Changed

We implemented a lightweight, async-safe, module-level circuit breaker (`_RedisCircuitBreaker`) inside our ML triage service to prevent cascading timeouts during Redis outages. Every Redis touchpoint in the triage flow—including the native LangGraph checkpointer path, manual session loading, saving, and clearing—is now guarded by this breaker. When Redis is detected to be down, the system immediately short-circuits all database calls and falls back to serving stateless, in-memory triage responses instantly.

## The Problem Being Solved

In rural health environments where network infrastructure can be highly unstable, Redis outages or latency spikes occasionally occur. Previously, when Redis went down, a single triage request suffered from a severe "double-timeout" penalty:
1. The native LangGraph checkpointer path (`_native_triage_app.ainvoke`) blocked waiting for Redis until its internal timeout expired.
2. Upon failing, the manual fallback mechanism immediately attempted to load session state via `_load_session_state -> redis_client.get()`, which blocked *again* because our `redis_client` did not have a strict socket timeout configured.

This stacked latency caused the application server to hang for an extended period before finally serving a stateless response, degrading the user experience and risking event-loop starvation on our ASGI servers.

## Files Modified

- `apps/ml/services/triage_graph.py`
- `apps/ml/tests/test_triage_session_persistence.py`

## Implementation Details

### The `_RedisCircuitBreaker` Class
We implemented a custom, lightweight state machine to track Redis health:
```python
class _RedisCircuitBreaker:
    def __init__(self, failure_threshold: int = 3, cooldown_seconds: float = 60.0) -> None:
        self._failures = 0
        self._opened_at: Optional[float] = None
        self._threshold = max(1, failure_threshold)
        self._cooldown = cooldown_seconds
```

- **Closed State:** The breaker is closed when `_opened_at` is `None`. Calls are allowed through. Every successful Redis operation calls `record_success()`, which resets the failure counter to `0`.
- **Open State:** If consecutive failures reach `_threshold` (configurable via `TRIAGE_REDIS_BREAKER_THRESHOLD`, defaulting to `3`), `record_failure()` is triggered, setting `_opened_at` to `time.monotonic()`. Subsequent calls to `is_open()` return `True`, causing immediate short-circuiting.
- **Half-Open State:** When `is_open()` is called after `_cooldown` seconds (configurable via `TRIAGE_REDIS_BREAKER_COOLDOWN_SECONDS`, defaulting to `60.0`) have elapsed, the breaker resets its state (`_opened_at = None`, `_failures = 0`) and returns `False`. This allows the very next request to probe Redis. If it succeeds, the breaker remains closed; if it fails, it immediately re-opens.

### Guarded Touchpoints
We wrapped all four Redis interaction points in `apps/ml/services/triage_graph.py` with the global `_redis_breaker` instance:

1. **`_load_session_state`**:
   ```python
   if _redis_breaker.is_open():
       return None
   ```
2. **`_save_session_state`**:
   ```python
   if _redis_breaker.is_open():
       return
   ```
3. **`_clear_session_state`**:
   ```python
   if _redis_breaker.is_open():
       return False
   ```
4. **`run_triage_flow` (Native Checkpointer)**:
   ```python
   if (
       CHECKPOINTER_MODE == "native"
       and session_id
       and _native_triage_app is not None
       and not _redis_breaker.is_open()
   ):
   ```

Each of these blocks records success on a completed execution and records failure inside their respective `except Exception` blocks.

## Technical Decisions

### Custom Implementation vs. External Library
We chose to write a custom circuit breaker class rather than pulling in a popular library like `circuitbreaker`. The `circuitbreaker` package is synchronous and decorator-based, which does not compose cleanly with our asynchronous (`async def`) Redis calls and LangGraph execution paths. Writing our own class avoided adding new dependencies to `requirements.txt` and kept our codebase lightweight.

### Global Module-Level Scope
The circuit breaker instance `_redis_breaker` is defined at the module level and shared across all sessions. Because Redis health is a global infrastructure condition rather than a per-session issue, a single failure pattern should protect all concurrent users instantly.

### Guarding `_clear_session_state`
During development, we realized that leaving `_clear_session_state` unguarded would still cause the system to hang during an outage when a session was completed or reset. Guarding this fourth touchpoint ensures that no Redis-dependent code path can block the event loop during an outage.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or port this circuit breaker pattern to another service:

1. **Define the Breaker Class:** Create a class tracking consecutive failures and a monotonic timestamp for the open state. Ensure time calculations use `time.monotonic()` to avoid issues with system clock adjustments.
2. **Instantiate Globally:** Create a single instance of the breaker at the module level. Use environment variables to configure the threshold and cooldown, providing safe defaults:
   ```python
   _redis_breaker = _RedisCircuitBreaker(
       failure_threshold=_breaker_int_env("TRIAGE_REDIS_BREAKER_THRESHOLD", 3),
       cooldown_seconds=_breaker_int_env("TRIAGE_REDIS_BREAKER_COOLDOWN_SECONDS", 60),
   )
   ```
3. **Guard Async Calls:** At the entry point of any function interacting with the external dependency, check `if breaker.is_open(): return fallback_value`.
4. **Record Outcomes:** Wrap the actual network call in a `try...except` block. Call `breaker.record_success()` immediately after a successful await, and `breaker.record_failure()` inside the `except` block before returning the fallback value.
5. **Isolate Tests:** When writing tests for a module-level global state, always write an autouse fixture to reset the breaker state before and after each test run to prevent test pollution:
   ```python
   @pytest.fixture(autouse=True)
   def _reset_redis_breaker():
       triage_graph._redis_breaker.record_success()
       yield
       triage_graph._redis_breaker.record_success()
   ```

## Impact on System Architecture

This change significantly improves the resilience of our ML triage pipeline. By decoupling the core conversational triage logic from Redis availability, we ensure that SahiDawa remains functional even during database outages. The system degrades gracefully: instead of hanging or failing, it continues to serve stateless triage guidance to rural health workers, preserving critical clinical utility when infrastructure is compromised.

## Testing & Verification

We added comprehensive unit and integration tests to `apps/ml/tests/test_triage_session_persistence.py`:

- **`test_redis_circuit_breaker_opens_after_threshold`**: Verifies that the breaker transitions to the open state exactly when the failure threshold is reached.
- **`test_redis_circuit_breaker_success_resets_failure_streak`**: Confirms that a single successful operation resets the consecutive failure counter.
- **`test_redis_circuit_breaker_half_opens_after_cooldown`**: Uses `monkeypatch` to simulate the passage of time and verifies that the breaker transitions back to half-open (allowing a probe call) once the cooldown window expires.
- **`test_open_breaker_short_circuits_load_without_touching_redis`**: Uses an `ExplodingRedis` mock class that raises an `AssertionError` if any of its methods are called. This guarantees that when the breaker is open, `_load_session_state` returns `None` immediately without touching the Redis client.
- **`test_open_breaker_serves_stateless_fallback`**: Verifies that `run_triage_flow` successfully routes requests to the stateless `triage_app` and returns a valid response when the circuit is open.