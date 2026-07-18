# PR #3510 — perf(ml): remove redundant event loops from triage flow

> **Merged:** 2026-07-12 | **Author:** @Shreya-nipunge | **Area:** ML/AI | **Impact Score:** 32 | **Closes:** #3487

## What Changed

We refactored our machine learning triage flow to be fully asynchronous, eliminating several performance bottlenecks in the SahiDawa ML service. Specifically, we removed redundant `asyncio.run()` calls used for Redis session persistence, replaced synchronous LangGraph execution with native asynchronous invocation (`await triage_app.ainvoke(...)`), and removed Starlette's `run_in_threadpool` wrapper from our FastAPI triage endpoints. Additionally, we updated our test suite to support async execution using AnyIO and `AsyncMock`.

## The Problem Being Solved

Prior to this PR, our triage system suffered from severe performance inefficiencies due to a nested event loop anti-pattern. 

The FastAPI endpoints (`/triage/chat` and `/triage/clear`) are naturally asynchronous. However, they offloaded the triage execution to a synchronous thread pool using Starlette's `run_in_threadpool(run_triage_flow, ...)`. Inside the synchronous `run_triage_flow` function, the system needed to interact with our asynchronous Redis client to load and save session states. To bridge this gap, it spun up *new* temporary event loops using `asyncio.run(_load_session_state(...))` and `asyncio.run(_save_session_state(...))`. 

This "async endpoint -> sync threadpool -> async Redis event loop" pattern caused massive thread context-switching overhead, blocked the thread pool, and risked event loop exhaustion under high concurrent loads. This was a critical issue for SahiDawa, as our rural health platform must remain highly responsive even on low-bandwidth, high-latency networks.

## Files Modified

- `apps/ml/routers/triage.py`
- `apps/ml/services/triage_graph.py`
- `apps/ml/tests/test_triage_graph.py`
- `apps/ml/tests/test_triage_session_persistence.py`

## Implementation Details

### 1. Router Refactoring (`apps/ml/routers/triage.py`)
We removed the `run_in_threadpool` import from `starlette.concurrency`. The endpoints `triage_chat` and `triage_clear` were updated to directly await the underlying services:
- In `triage_chat`, the call to `run_triage_flow` was refactored from:
  ```python
  result = await run_in_threadpool(
      run_triage_flow, messages_list, locale=payload.locale, session_id=session_id
  )
  ```
  to:
  ```python
  result = await run_triage_flow(
      messages_list, locale=payload.locale, session_id=session_id
  )
  ```
- In `triage_clear`, the call to `clear_session` was refactored from:
  ```python
  cleared = await run_in_threadpool(clear_session, payload.session_id)
  ```
  to:
  ```python
  cleared = await clear_session(payload.session_id)
  ```

### 2. Service Refactoring (`apps/ml/services/triage_graph.py`)
We removed the unused `import asyncio` statement and converted the core functions to native async functions:
- **`clear_session`**: Converted to `async def clear_session(session_id: str) -> bool` and simplified to directly await the internal helper:
  ```python
  async def clear_session(session_id: str) -> bool:
      """Clear persisted session state from the API's existing event loop."""
      return await _clear_session_state(session_id)
  ```
- **`run_triage_flow`**: Converted to `async def run_triage_flow(...)`.
  - Replaced `asyncio.run(_load_session_state(session_id))` with `await _load_session_state(session_id)`.
  - Replaced the synchronous LangGraph execution `triage_app.invoke(initial_state)` with `await triage_app.ainvoke(initial_state)`.
  - Replaced `asyncio.run(_save_session_state(session_id, final_state))` with `await _save_session_state(session_id, final_state)`.

### 3. Test Suite Migration (`apps/ml/tests/`)
- **`test_triage_graph.py`**: Updated the mock for `run_triage_flow` to use `AsyncMock` instead of `MagicMock` and added `mock_run_triage.assert_awaited_once()` to verify that the router is properly awaiting the async service.
- **`test_triage_session_persistence.py`**: 
  - Added an `anyio_backend` fixture returning `"asyncio"` to support AnyIO-based async test execution.
  - Decorated all async test cases with `@pytest.mark.anyio`.
  - Converted test assertions to await `_save_session_state`, `clear_session`, and `run_triage_flow`.
  - Added a new test `test_run_triage_flow_without_session_skips_persistence` to verify that when no `session_id` is provided, the system skips loading/saving states entirely and directly awaits `triage_app.ainvoke`.

## Technical Decisions

### Native Async LangGraph (`ainvoke`)
We chose to leverage LangGraph's native `ainvoke` method rather than wrapping `invoke` in an executor. LangGraph is built on top of LangChain, which fully supports asynchronous execution. Using `ainvoke` allows the underlying LLM calls and node transitions to run concurrently without blocking the main ASGI event loop, maximizing throughput.

### Eliminating `asyncio.run` in Production Paths
Using `asyncio.run()` inside an active event loop or within a worker thread of that loop is a known anti-pattern in Python. It attempts to spawn a new event loop on a thread that might already have one, or creates unnecessary loop lifecycle overhead. By making the entire call chain async from the FastAPI router down to the Redis client, we ensure that all operations run on FastAPI's single, highly optimized event loop.

### AnyIO for Testing
We utilized AnyIO as our asynchronous testing library of choice. It provides a clean, structured way to run asynchronous test cases across different backends (defaulting to `asyncio`) and integrates seamlessly with `pytest` and `FastAPI`'s testing utilities.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar asynchronous flow or refactor another synchronous service in our codebase, follow these steps:

1. **Identify Blocking Wrappers**: Look for occurrences of `run_in_threadpool` in the router layer (`apps/ml/routers/`). If the underlying service can be made async, remove this wrapper.
2. **Convert Service Signatures**: Change the target service function signature from `def my_function(...)` to `async def my_function(...)`.
3. **Remove `asyncio.run`**: Search for any internal calls to `asyncio.run()`. Replace them with direct `await` expressions.
4. **Leverage Async SDKs**: Ensure that any third-party libraries (like LangGraph or Redis) use their async variants (e.g., swapping `.invoke()` for `.ainvoke()`, or using an async Redis connection pool).
5. **Update Unit Tests**:
   - If you patch the refactored function, use `unittest.mock.AsyncMock` instead of `MagicMock`:
     ```python
     @patch("routers.triage.run_triage_flow", new_callable=AsyncMock)
     ```
   - Add the AnyIO backend fixture to your test file:
     ```python
     @pytest.fixture
     def anyio_backend():
         return "asyncio"
     ```
   - Decorate your test cases with `@pytest.mark.anyio` and define them as `async def`.
   - Assert that your mocks were awaited using `.assert_awaited_once()`.

## Impact on System Architecture

This refactoring significantly optimizes the SahiDawa ML service architecture:
- **Reduced Latency**: Eliminating thread pool context switching and event loop creation overhead reduces the round-trip time for triage chat requests.
- **Improved Scalability**: The ML service can now handle a much higher volume of concurrent triage requests. Because threads are no longer blocked waiting for Redis or LLM responses, the system's resource footprint remains low.
- **Future-Proofing**: Moving to a fully async pipeline prepares our triage system for real-time streaming responses (e.g., streaming LLM tokens directly to rural health workers over WebSockets or Server-Sent Events).

## Testing & Verification

We verified these changes by running our comprehensive test suite:
1. **Triage Graph Tests**: Ran `python -m pytest apps/ml/tests/test_triage_graph.py` to ensure that the FastAPI endpoints correctly route requests, generate session IDs when omitted, and return valid triage schemas.
2. **Session Persistence Tests**: Ran `python -m pytest apps/ml/tests/test_triage_session_persistence.py` to verify that Redis session rehydration, state saving, and session clearing work flawlessly under the new async execution model.
3. **Full ML Suite Validation**: Executed `python -m pytest apps/ml/tests -v` to confirm that all 137 tests passed successfully with zero regressions.
4. **Git Diff Check**: Ran `git diff --check` to ensure no trailing whitespaces or unresolved conflicts remained. We also verified that no instances of `asyncio.run()` or `run_in_threadpool` remain in the production triage request path.