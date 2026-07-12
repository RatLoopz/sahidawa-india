# ADR — perf(ml): remove redundant event loops from triage flow

> **Date:** 2026-07-12 | **PR:** #3510 | **Status:** Accepted

## Context

The SahiDawa triage flow mixed synchronous and asynchronous execution paradigms, resulting in severe performance bottlenecks. 

The FastAPI/Starlette API endpoints (`/triage/chat` and `/triage/clear`) were offloading triage tasks to a worker thread pool using `run_in_threadpool`. Inside these worker threads, the triage service executed synchronous LangGraph invocations (`triage_app.invoke`) but relied on asynchronous Redis helpers for session state persistence. To bridge this, the service repeatedly invoked `asyncio.run()` to spin up and tear down temporary event loops for loading and saving session states. 

This architecture introduced significant overhead:
1. High CPU utilization and latency due to constant creation and destruction of transient event loops via `asyncio.run()`.
2. Thread pool exhaustion under concurrent load due to blocking operations in `run_in_threadpool`.
3. Unnecessary context-switching overhead between the main ASGI event loop and OS threads.

## Decision

We refactored the entire triage execution path to be natively asynchronous, executing entirely within the existing ASGI event loop. 

Specifically, we:
1. Converted `run_triage_flow(...)` and `clear_session(...)` into fully asynchronous functions (`async def`).
2. Removed Starlette's `run_in_threadpool` wrappers from the `/triage/chat` and `/triage/clear` endpoints, allowing them to directly await the triage services.
3. Replaced synchronous LangGraph execution (`triage_app.invoke`) with native asynchronous execution (`await triage_app.ainvoke`).
4. Eliminated all nested `asyncio.run()` calls inside `services/triage_graph.py`, allowing Redis session persistence operations (`_load_session_state`, `_save_session_state`, and `_clear_session_state`) to be awaited directly.
5. Updated the test suite to use `AsyncMock` and async execution via AnyIO to match the new non-blocking architecture.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Optimize Thread Pool Sizing** | Retaining the synchronous flow while tuning the thread pool size does not address the root cause: the CPU overhead of spinning up and tearing down nested event loops via `asyncio.run()` inside worker threads. |
| **Offload to Background Task Queue (e.g., Celery)** | Offloading triage execution to an asynchronous task queue would introduce significant architectural complexity, message broker overhead, and increased latency for an interactive, real-time chat interface. |

## Consequences

**Positive:**
- **Reduced Latency & CPU Overhead:** Eliminating transient event loops and thread pool context switching significantly reduces request processing latency.
- **Improved Concurrency:** The system can handle a higher volume of concurrent triage requests using fewer system resources, as the ASGI event loop is no longer blocked by synchronous thread execution.
- **Clean Codebase:** Unifies the codebase around a single, idiomatic asynchronous paradigm from the HTTP routing layer down to the database and LLM graph execution layers.

**Trade-offs:**
- **Async Dependency Requirement:** All nodes and tools within the LangGraph triage flow must safely support non-blocking asynchronous execution.
- **Testing Complexity:** Unit and integration tests must now use asynchronous test runners and mock objects capable of handling async/await interfaces.

## Related Issues & PRs

- PR #3510: perf(ml): remove redundant event loops from triage flow
- Issue #3487