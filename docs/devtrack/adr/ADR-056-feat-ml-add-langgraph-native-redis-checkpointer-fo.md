# ADR — feat(ml): add LangGraph-native Redis checkpointer for triage session

> **Date:** 2026-07-18 | **PR:** #3740 | **Status:** Accepted

## Context

The SahiDawa medical triage conversational flow requires robust session state persistence to survive container restarts and scale horizontally. However, SahiDawa is deployed across highly diverse environments—ranging from resource-constrained rural health centers to cloud environments utilizing free-tier managed Redis instances (such as Upstash). 

Standard LangGraph checkpointing via `AsyncRedisSaver` requires Redis Stack or Redis >= 8.0 with specific modules (RedisJSON and RediSearch) enabled. Forcing this as a hard dependency would break compatibility with basic Redis instances and free-tier cloud providers, while relying solely on manual JSON serialization would deprive the platform of native LangGraph state management, replay, and time-travel capabilities where supported.

## Decision

We implemented a hybrid, resilient checkpointing architecture for the ML triage service:

1. **Native Checkpointing**: Integrated `langgraph-checkpoint-redis` using `AsyncRedisSaver` as the primary state persistence mechanism.
2. **Graceful Fallback**: Implemented a silent, zero-downtime fallback mechanism. During FastAPI startup (`lifespan`), the system attempts to initialize the native checkpointer. If the required Redis modules are missing, or if the `langgraph-checkpoint-redis` package is not installed, the system gracefully downgrades `CHECKPOINTER_MODE` to `"manual"`, falling back to manual JSON state persistence via the existing `redis_client`.
3. **Lifecycle Management**: Managed the connection pool of the native checkpointer using `AsyncExitStack` to ensure clean startup and shutdown phases during the FastAPI application lifecycle.
4. **Security Hardening**: Upgraded 7 vulnerable dependency pins in `apps/ml/requirements.txt` to resolve pre-existing PIP audit security alerts.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Mandate Redis Stack as a Hard Requirement** | Rejected because it would prevent deployments on standard/legacy Redis instances and lightweight, free-tier cloud databases (e.g., Upstash free tier), violating SahiDawa's goal of low-cost, accessible rural health deployment. |
| **Exclusively Use Manual JSON Persistence** | Rejected because it bypasses LangGraph's native ecosystem, making it difficult to implement advanced agentic features such as human-in-the-loop intervention, state rollback, and granular step-by-step conversational replays. |

## Consequences

**Positive:**
- **High Availability**: Triage sessions persist seamlessly across container restarts without risking service downtime due to database incompatibility.
- **Deployment Flexibility**: Supports both enterprise-grade Redis Stack deployments (utilizing native features) and low-cost/edge deployments (utilizing manual JSON fallback).
- **Improved Security**: Resolved 7 known Python dependency vulnerabilities through updated requirements pinning.
- **Clean Resource Lifecycle**: Connection pools are safely managed and closed via `AsyncExitStack` during application shutdown.

**Trade-offs:**
- **Code Complexity**: The codebase must maintain and test two parallel state-handling pathways (`native` and `manual`).
- **Feature Disparity**: Advanced LangGraph state features (like time-travel debugging) are unavailable when running in `manual` fallback mode.

## Related Issues & PRs

- PR #3740: feat(ml): add LangGraph-native Redis checkpointer for triage session
- Issue #3686