# PR #3489 — feat(ml): add POST /triage/clear endpoint for session reset

> **Merged:** 2026-07-11 | **Author:** @shashank03-dev | **Area:** ML/AI | **Impact Score:** 24 | **Closes:** #3304

## What Changed

We added a new `POST /triage/clear` endpoint to our ML triage service to allow immediate, explicit deletion of a user's persisted triage session state in Redis. This endpoint is backed by a new async Redis deletion helper `_clear_session_state` and its synchronous wrapper `clear_session` in our triage graph service. Additionally, we secured this endpoint using our existing `triage_limiter` rate limiting dependency to prevent denial-of-service attacks.

## The Problem Being Solved

Before this PR, there was no mechanism to explicitly terminate or reset an ongoing triage session. The triage state remained persisted in Redis until its 30-minute Time-To-Live (TTL) expired naturally. Consequently, if a user wanted to start a fresh triage conversation, the frontend had no way to clear the previous session's context. This led to stale context (such as previously collected symptoms, language preferences, or emergency flags) leaking into new conversations, degrading the accuracy of our ML-driven triage flow.

## Files Modified

- `apps/ml/routers/triage.py`
- `apps/ml/services/triage_graph.py`
- `apps/ml/tests/test_triage_session_persistence.py`

## Implementation Details

### 1. API Schema & Endpoint Definition
In `apps/ml/routers/triage.py`, we introduced two Pydantic models to handle validation:
- `ClearSessionRequest`: Validates that the incoming payload contains a non-empty `session_id` string (enforced via `min_length=1`).
- `ClearSessionResponse`: Returns the requested `session_id` and a boolean `cleared` flag indicating whether a session was actually found and deleted.

The endpoint is defined as:
```python
@router.post(
    "/clear",
    response_model=ClearSessionResponse,
    dependencies=[Depends(triage_limiter)],
)
async def triage_clear(payload: ClearSessionRequest):
```
Because the router is mounted at `/triage`, the absolute path is `POST /triage/clear`. To avoid blocking FastAPI's main event loop, we execute the synchronous service wrapper `clear_session` inside a threadpool using Starlette's `run_in_threadpool`.

### 2. Redis State Deletion
In `apps/ml/services/triage_graph.py`, we implemented the core deletion logic:
- `_clear_session_state(session_id: str) -> bool`: An asynchronous function that attempts to delete the Redis key associated with the session ID. It returns `True` if the key was deleted, and `False` if the key did not exist.
- `clear_session(session_id: str) -> bool`: A synchronous wrapper that runs `_clear_session_state` using `asyncio.run()`. This mirrors the design of our existing `run_triage_flow` helper, ensuring callers running in a threadpool do not need to manage their own event loop plumbing.

### 3. Rate Limiting
We attached the `triage_limiter` dependency to the `/clear` endpoint. The rate limiter keys off the request path combined with the client's IP address. This ensures that `/clear` has its own isolated quota bucket (5 requests per 60 seconds) and does not consume the client's `/chat` allowance.

## Technical Decisions

### Idempotency and 200 OK for Missing Sessions
We decided that clearing a non-existent or already expired session should return a `200 OK` with `cleared: false` rather than throwing a `404 Not Found` or `422 Unprocessable Entity` error. This ensures that the frontend's "Reset" button can be clicked multiple times without generating unnecessary error states or breaking user experience.

### Swallowing Redis Exceptions
In `_clear_session_state`, we catch and log Redis exceptions, returning `False` instead of propagating the error. This aligns with our existing load/save helpers, ensuring that a transient Redis outage does not completely crash the triage service, though the endpoint itself will raise a 500 if the threadpool execution fails.

### Router Path Prefix
We chose to mount the endpoint at `/triage/clear` instead of `/api/v1/triage/clear` to match the existing router prefix configuration. Changing the prefix to match the issue description would have broken existing clients calling `/triage/chat`.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar session-clearing mechanism in another service, follow these steps:

1. **Define Pydantic Schemas**:
   Create request and response schemas to validate the session ID and return the deletion status.
   ```python
   class ClearSessionRequest(BaseModel):
       session_id: str = Field(..., min_length=1)

   class ClearSessionResponse(BaseModel):
       session_id: str
       cleared: bool
   ```

2. **Implement the Redis Deletion Logic**:
   Write an async helper to delete the key from Redis. Wrap the call in a `try/except` block to handle Redis connection issues gracefully.
   ```python
   async def _clear_session_state(session_id: str) -> bool:
       try:
           removed = await redis_client.delete(f"session:{session_id}")
           return bool(removed)
       except Exception:
           logging.exception("Failed to clear session")
           return False
   ```

3. **Create a Synchronous Wrapper**:
   Use `asyncio.run` to bridge the async service layer with the synchronous execution context of the router's threadpool.
   ```python
   def clear_session(session_id: str) -> bool:
       return asyncio.run(_clear_session_state(session_id))
   ```

4. **Register the Endpoint**:
   Add the POST endpoint to your FastAPI router, applying the rate-limiting dependency and executing the synchronous wrapper inside `run_in_threadpool`.

## Impact on System Architecture

This change introduces explicit state lifecycle management to our ML triage pipeline. By allowing the frontend to signal the end of a session, we reduce memory overhead in Redis (by deleting keys early instead of waiting for the 30-minute TTL) and ensure strict context isolation between consecutive user sessions.

## Testing & Verification

We added 8 new test cases to `apps/ml/tests/test_triage_session_persistence.py` to verify the endpoint end-to-end:

1. **Successful Deletion**: Verifies that an existing session is successfully removed from Redis and returns `cleared: True`.
2. **No-Op Deletion**: Verifies that attempting to clear a non-existent session returns `cleared: False` with a `200 OK`.
3. **Redis Connection Failure**: Verifies that if Redis is offline, the exception is caught, logged, and returns `cleared: False` without crashing.
4. **Synchronous Wrapper Execution**: Verifies that `clear_session` correctly drives the underlying async helper.
5. **Request Validation**: Verifies that missing or empty `session_id` payloads are rejected with a `422 Unprocessable Entity` status code.
6. **Rate Limiting**: Verifies that exceeding the rate limit returns a `429 Too Many Requests` response. This is tested using an `OverLimitRedis` mock that simulates a client already past their quota window.