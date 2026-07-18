# PR #3740 — feat(ml): add LangGraph-native Redis checkpointer for triage session

> **Merged:** 2026-07-18 | **Author:** @Khanvilkarshravani27 | **Area:** Frontend | **Impact Score:** 49 | **Closes:** #3686

## What Changed

We integrated a LangGraph-native Redis checkpointer (`AsyncRedisSaver`) into our ML triage conversational flow to persist session state across container restarts. We implemented a robust, zero-downtime fallback mechanism that silently reverts to manual JSON state persistence if Redis Stack features (like RedisJSON or RediSearch) are unavailable. Additionally, we updated Python dependencies in `apps/ml/requirements.txt` to patch security vulnerabilities and resolved ESLint/Jest issues in the frontend web workspace.

## The Problem Being Solved

Before this PR, our conversational triage sessions lacked a native, resilient state-tracking mechanism. If an ML service container restarted or scaled, active triage sessions could lose their conversational context unless manually managed via custom JSON serialization. 

While manual JSON state persistence worked, it was inefficient and did not leverage LangGraph's native checkpointing capabilities, which manage complex graph state transitions out-of-the-box. However, native LangGraph checkpointing via `AsyncRedisSaver` requires Redis Stack (Redis >= 8.0 with RedisJSON and RediSearch modules). If our platform was deployed on environments without these modules (such as the Upstash free tier), the service would crash or fail to start. We needed a hybrid solution that uses native checkpointing when available but gracefully falls back to manual JSON persistence without operator intervention.

## Files Modified

- `apps/ml/main.py`
- `apps/ml/requirements.txt`
- `apps/ml/services/triage_graph.py`
- `apps/ml/tests/test_triage_graph.py`
- `apps/web/components/map/MapView.tsx`
- `apps/web/jest.env.cjs`
- `apps/web/tests/interaction-checker-security.test.tsx`
- `apps/web/tests/lasa-cache.test.tsx`
- `apps/web/tests/pharmacy-map-layout.test.tsx`

## Implementation Details

### 1. Lifespan Integration (`apps/ml/main.py`)
We modified the FastAPI lifespan context manager to call `_triage_graph_service.init_checkpointer()` during startup and `_triage_graph_service.close_checkpointer()` during shutdown. This ensures the connection pool is managed cleanly across the application lifecycle.

### 2. Checkpointer Lifecycle (`apps/ml/services/triage_graph.py`)
- **AsyncExitStack Management:** We use an `AsyncExitStack` (`_checkpointer_stack`) to keep the `AsyncRedisSaver` connection pool alive for the entire duration of the application process.
- **Initialization & Fallback:** `init_checkpointer()` attempts to instantiate `AsyncRedisSaver.from_conn_string(REDIS_URL)` and calls `await saver.asetup()` to initialize RediSearch indices. If this fails (e.g., due to missing modules or connection errors), we catch the exception, log a warning, and keep `CHECKPOINTER_MODE = "manual"`.

### 3. Graph Compilation
- **Dual-Compiled Graphs:** We maintain two compiled graphs: `triage_app` (compiled without a checkpointer, used for the manual fallback path to avoid requiring a `thread_id` config) and `_native_triage_app` (compiled with the `AsyncRedisSaver` checkpointer).
- **Compilation Function:** `build_triage_graph(checkpointer=None)` compiles our `StateGraph(TriageState)` with the provided checkpointer.

### 4. Shadow-Writing & Fallback Strategy
In `run_triage_flow()`, we implement a dual-layer persistence strategy:
- **Native Mode:** If `CHECKPOINTER_MODE == "native"`, we invoke `_native_triage_app` with `{"configurable": {"thread_id": session_id}}`.
- **Shadow-Write:** Regardless of the mode, we perform a "shadow-write" of a lightweight JSON snapshot to `triage_session:<session_id>` via `_save_session_state`. If the native checkpointer fails mid-session, the system falls back to the manual path, resuming from the shadow-write copy (representing the last completed turn).

### 5. Frontend & Test Fixes
We resolved ESLint and Jest errors in `apps/web` by removing unused variables in `MapView.tsx` and adding missing React imports in test files (`interaction-checker-security.test.tsx`, `lasa-cache.test.tsx`, `pharmacy-map-layout.test.tsx`).

## Technical Decisions

- **Why AsyncExitStack?** We chose `AsyncExitStack` to manage the lifecycle of the `AsyncRedisSaver` connection pool. This prevents connections from being torn down prematurely after a single request, keeping them alive for the lifespan of the FastAPI process.
- **Why Dual-Compiled Graphs?** LangGraph strictly enforces that if a graph is compiled with a checkpointer, every invocation *must* include a `thread_id` in its configuration. To allow seamless fallback to manual persistence without rewriting the invocation interface or triggering validation errors, we compile `triage_app` without a checkpointer and `_native_triage_app` with one.
- **Why Shadow-Writing?** Native checkpointing and manual JSON persistence use different Redis key namespaces. Shadow-writing ensures that if the Redis Stack instance experiences a transient failure or we scale down to a plain Redis instance, the user's session state is preserved up to the last successful turn.

## How To Re-Implement (Contributor Reference)

If you need to re-implement this feature or set up a similar checkpointer in another service, follow these steps:

1. **Add Dependencies:** Ensure `langgraph-checkpoint-redis>=1.0.0` is added to your environment requirements.
2. **Set Up Lifespan Hooks:** In your application entry point (e.g., `main.py`), initialize and close the checkpointer using an `AsyncExitStack`:
   ```python
   stack = AsyncExitStack()
   saver = await stack.enter_async_context(AsyncRedisSaver.from_conn_string(REDIS_URL))
   await saver.asetup()
   ```
3. **Implement Safe Fallbacks:** Wrap the initialization in a `try...except` block. If the Redis instance does not support RedisJSON or RediSearch, catch the exception and fall back to a manual JSON serialization path.
4. **Compile Graphs Conditionally:**
   ```python
   def build_graph(checkpointer=None):
       workflow = StateGraph(MyState)
       # ... add nodes and edges ...
       return workflow.compile(checkpointer=checkpointer)
   ```
5. **Invoke with Configuration:** When invoking the graph compiled with a checkpointer, always pass the `thread_id` in the config:
   ```python
   config = {"configurable": {"thread_id": session_id}}
   await native_app.ainvoke(inputs, config=config)
   ```
6. **Maintain Shadow-Writes:** Write a lightweight JSON backup of the state to a standard Redis key after every successful graph run to guarantee seamless recovery during a failover.

## Impact on System Architecture

This change introduces a resilient, self-healing state management layer for our ML services. It decouples our deployment environment from strict infrastructure requirements: developers can run SahiDawa locally or on free-tier hosting (like Upstash) using manual JSON fallback, while production environments can leverage high-performance, native Redis checkpointing. This architecture also paves the way for complex multi-turn agentic workflows where state transitions must be audited or rolled back.

## Testing & Verification

We added 5 new `pytest` cases in `apps/ml/tests/test_triage_graph.py` covering:
- Native-path initialization under optimal conditions.
- Startup failure handling (simulating missing Redis Stack modules).
- Mid-run fallback to manual JSON persistence.
- Shadow-writing verification.
- State recovery from shadow-writes.

We ran `npm run audit:all` to verify that all Node and Python dependency security audits passed, ensuring no vulnerabilities exist in the updated packages.