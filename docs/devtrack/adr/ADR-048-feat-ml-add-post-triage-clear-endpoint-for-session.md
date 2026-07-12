# ADR — feat(ml): add POST /triage/clear endpoint for session reset

> **Date:** 2026-07-11 | **PR:** #3489 | **Status:** Accepted

## Context
The SahiDawa platform lacked a mechanism to explicitly end a triage session, resulting in session state remaining in Redis until it expired, potentially causing issues for users starting new conversations.

## Decision
A new endpoint, `POST /triage/clear`, was introduced to allow for the explicit deletion of a triage session's state from Redis. This endpoint takes a `session_id` as input, deletes the corresponding session state, and returns a response indicating whether a session was actually cleared.

## Alternatives Considered
| Alternative | Why Rejected |
|---|---|
| Implementing a TTL-based expiration mechanism without an explicit clear endpoint | This approach would not provide an immediate way for users to start fresh, as they would have to wait for the TTL to expire. |
| Using a different data store that automatically handles session expiration | This alternative would have introduced additional complexity and potential compatibility issues, whereas the existing Redis infrastructure was already in place. |

## Consequences
**Positive:**
- Users can now explicitly start a new conversation without waiting for the session state to expire.
- The `POST /triage/clear` endpoint provides a clear and idempotent way to reset a triage session.

**Trade-offs:**
- The introduction of a new endpoint adds complexity to the API and requires additional testing and maintenance.

## Related Issues & PRs
- PR #3489: feat(ml): add POST /triage/clear endpoint for session reset
- Issue #3304