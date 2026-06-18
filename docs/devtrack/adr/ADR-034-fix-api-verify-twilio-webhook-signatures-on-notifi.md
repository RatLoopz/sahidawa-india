# ADR — fix(api): verify Twilio webhook signatures on notification route

> **Date:** 2026-06-17 | **PR:** #2004 | **Status:** Accepted

## Context

The `POST /twilio-webhook` route, responsible for processing Twilio notifications (e.g., opt-in/opt-out requests), was vulnerable to unauthorized manipulation. Without signature verification, an attacker could forge requests to arbitrarily flip a subscriber's `is_active` flag in the database, leading to incorrect user subscription states and potential service disruption or privacy violations.

## Decision

`X-Twilio-Signature` verification was implemented on the `POST /twilio-webhook` route. This involved:
1.  Recomputing the expected signature as a base64 HMAC-SHA1 hash. The hash input consists of the request URL concatenated with sorted POST parameters (key+value), keyed with the `TWILIO_AUTH_TOKEN`.
2.  Comparing the recomputed signature against the `X-Twilio-Signature` header provided by Twilio using a constant-time comparison function to prevent timing attacks.
3.  Rejecting requests with missing, invalid, or tampered signatures with a `403` HTTP status code before any database interaction.
4.  Implementing a "fail closed" mechanism: if `TWILIO_AUTH_TOKEN` is not configured, all requests to the webhook are rejected.
5.  Handling potential URL reconstruction issues behind proxies by attempting multiple scheme variants (`http`, `https`) or using a pinned `TWILIO_WEBHOOK_PUBLIC_URL` environment variable.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| IP Whitelisting | While effective, Twilio's IP ranges can change, requiring manual updates and potentially leading to service interruptions. It also doesn't protect against compromised Twilio accounts or misconfigurations within Twilio's network. |
| Custom API Key/Secret in Request Body/Header | This would deviate from Twilio's standard security mechanism, requiring custom implementation and maintenance. It would also be less robust than Twilio's HMAC-SHA1 signature, which covers the entire request payload and URL. |

## Consequences

**Positive:**
- Prevents forged opt-out/opt-in requests from manipulating subscriber `is_active` flags.
- Significantly enhances the security posture of the Twilio webhook endpoint.
- Protects the integrity of user subscription data.
- Implements robust cryptographic verification (HMAC-SHA1, constant-time comparison).
- Fails closed, preventing silent trust of unverified requests when `TWILIO_AUTH_TOKEN` is absent.

**Trade-offs:**
- Adds computational overhead to each incoming Twilio webhook request for signature recomputation.
- Requires careful management and secure configuration of the `TWILIO_AUTH_TOKEN` environment variable.
- Introduces complexity in URL reconstruction logic to account for proxy behavior and `X-Forwarded-Proto` headers.

## Related Issues & PRs

- PR #2004: fix(api): verify Twilio webhook signatures on notification route
- Issue #1965