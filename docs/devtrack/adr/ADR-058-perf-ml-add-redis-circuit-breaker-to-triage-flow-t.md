# ADR — perf(ml): add Redis circuit breaker to triage flow to avoid double-timeout

> **Date:** 2026-07-20 | **PR:** #3760 | **Status:** Accepted

## Context

During a genuine Redis outage, the SahiDawa triage flow stalled twice on a single request. First, the native checkpointer (`_native_triage_app.ainvoke`) blocked until its timeout. Second, the manual fallback mechanism immediately called `_load_session_state -> redis_client.get()` and blocked again. 

Because the global `redis_client` did not have a strict `socket_timeout` configured, these blocking calls did not fail fast. This "double timeout" behavior severely degraded response times, which is unacceptable for a rural health platform operating under constrained network conditions. The system needed a way to fail fast and immediately serve stateless, in-memory triage responses when Redis is unhealthy.

## Decision

We implemented a lightweight, async-safe, module-level circuit breaker (`_RedisCircuitBreaker`) directly within `apps/ml/services/triage_graph.py`. 

Key implementation details:
- **Zero Dependencies:** Avoided external packages to keep `requirements.txt` unchanged and ensure compatibility with async/await patterns.
- **Shared Global State:** A single module-level instance (`_redis_breaker`) is shared across all sessions, as Redis health is a global infrastructure condition rather than a per-session state.
- **Fail-Fast Guarding:** Guarded all four Redis touchpoints (`_load_session_state`, `_save_session_state`, `_clear_session_state`, and the native checkpointer path) with `is_open()`. When the circuit is open, these calls short-circuit instantly.
- **State Transitions:** After a configurable threshold of consecutive failures (default: 3, via `TRIAGE_REDIS_BREAKER_THRESHOLD`), the circuit opens for a cooldown period (default: 60 seconds, via `TRIAGE_REDIS_BREAKER_COOLDOWN_SECONDS`). Once the cooldown expires, the circuit half-opens to allow a single probe request to test Redis recovery.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Using the standard `circuitbreaker` PyPI package | Most popular Python circuit breaker packages are synchronous and decorator-based. They do not natively compose with `async def` Redis calls without introducing blocking behavior or complex async wrappers. |
| Configuring strict socket timeouts on the Redis client | While socket timeouts prevent indefinite hangs, they still require the application to wait for the timeout duration on every single request during an outage. This does not prevent stacked latency across multiple sequential Redis calls in a single triage flow. |

## Consequences

**Positive:**
- Eliminates double-timeout latency spikes during Redis outages, ensuring instant fallback to stateless triage.
- Prevents cascading failures and resource exhaustion (e.g., event loop starvation) under high-concurrency scenarios when Redis is down.
- Avoids adding external dependency overhead or bloat to the ML service container.

**Trade-offs:**
- The circuit breaker state is stored in-memory per application process. In a multi-worker or multi-container deployment, workers do not share breaker states, meaning each worker must independently detect the Redis outage.
- During the 60-second cooldown period, users will experience a temporary loss of session persistence (falling back to stateless execution) even if Redis recovers immediately after the circuit opens.