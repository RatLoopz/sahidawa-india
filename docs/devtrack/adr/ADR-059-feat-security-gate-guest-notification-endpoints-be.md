# ADR — feat(security): gate guest notification endpoints behind a proof-of-ownership token (Closes #3836)

> **Date:** 2026-07-24 | **PR:** #3858 | **Status:** Accepted

## Context
The guest subscription management system previously trusted a phone number sent in the request, allowing anyone to read, change, or delete another person's alert settings by knowing their phone number. This vulnerability required an architectural decision to secure guest notification endpoints.

## Decision
The decision was made to gate guest notification endpoints behind a proof-of-ownership token. A guest now proves they own the phone number before they can access its settings by verifying a one-time password (OTP), which mints a short-lived (24h) HS256 JWT tied to that number. The token is sent in its own `X-Guest-Token` header, separate from the `Authorization` header used for Supabase sessions.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Using the `Authorization` header for guest tokens | This would confuse the guest token with a Supabase session token, potentially leading to authentication issues. |
| Implementing a session-based system for guests | This approach would add unnecessary complexity for guests who do not need a full user account, and could lead to issues with session management and expiration. |

## Consequences

**Positive:**
- Guests can securely manage their notification settings without fear of unauthorized access.
- The system is more secure against potential attacks that exploit the previous vulnerability.

**Trade-offs:**
- Additional complexity is introduced for handling guest tokens, which must be verified and validated on each request.
- Guests must now complete an additional step (OTP verification) to access their settings, which may impact user experience.

## Related Issues & PRs

- PR #3858: feat(security): gate guest notification endpoints behind a proof-of-ownership token (Closes #3836)
- Issue #3836