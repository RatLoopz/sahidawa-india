# ADR — Sec/enhanced rate limitingto use keys alongside ip#3605

> **Date:** 2026-07-16 | **PR:** #3605 | **Status:** Accepted

## Context

SahiDawa handles sensitive operations such as Ayushman Bharat Health Account (ABHA) linking and OTP-based authentication. The existing rate-limiting mechanism (`authLimiter`) relied solely on client IP addresses. This IP-only approach was vulnerable to distributed botnet attacks and proxy rotation schemes, where an attacker could perform OTP bombing or brute-force attacks against a specific target identifier (such as an ABHA address or phone number) by rotating source IPs to bypass the rate limits.

## Decision

We implemented a dual-layer rate limiting strategy by introducing target-based rate limiting alongside the existing IP-based rate limiting. 

Specifically, we:
1. Created a new factory function `createKeyLimiter` in `apps/api/src/middleware/rateLimit.ts` that extends the default configuration to accept a custom `keyGenerator` function.
2. Created `authTargetLimiter` using this factory, configured to extract target identifiers (`abhaAddress` or `phone_number`) from the request body to generate Redis keys (e.g., `abha:<address>` or `phone:<number>`), falling back to the client IP if no target is found.
3. Configured the target-based limiter with a strict threshold of 5 requests per 10 minutes per target.
4. Chained both `authLimiter` (IP-based) and `authTargetLimiter` (target-based) sequentially on sensitive routes, starting with `/api/v1/abha/link`.

This ensures that an attacker cannot bypass OTP limits for a specific user, even when rotating through thousands of distinct IP addresses.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Global application-level rate limiting on OTP endpoints | This would impact legitimate users globally during high-traffic periods or coordinated attacks, leading to a denial of service for innocent users. |
| Database-level tracking of OTP generation attempts | Writing every attempt to the primary database introduces significant write overhead, latency, and potential database lock contention under heavy load, whereas Redis-backed memory stores are highly performant and designed for ephemeral rate-limiting counters. |

## Consequences

**Positive:**
- Effectively mitigates OTP bombing and brute-force attacks leveraging proxy rotation or botnets.
- Protects downstream SMS gateways and external ABHA APIs from abuse and unexpected transactional costs.
- Integrates seamlessly with the existing Redis-backed rate-limiting infrastructure to maintain low latency.

**Trade-offs:**
- Slightly increases memory footprint in Redis due to tracking individual target keys.
- Adds minor processing overhead to parse request bodies in the middleware layer before routing.

## Related Issues & PRs

- PR #3605: Sec/enhanced rate limitingto use keys alongside ip#3605
- Issue #3605