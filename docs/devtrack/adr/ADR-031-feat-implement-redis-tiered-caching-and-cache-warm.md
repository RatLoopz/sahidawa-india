# ADR — feat: implement redis tiered caching and cache-warming for CDSCO drug lookup

> **Date:** 2026-06-12 | **PR:** #1640 | **Status:** Accepted

## Context

The CDSCO drug-lookup API was experiencing significant latency and high database load due to direct database queries for every request. This impacted performance, user experience, and system scalability. An efficient mechanism was required to reduce database reliance and accelerate data retrieval for frequently accessed drug information.

## Decision

A **tiered Redis caching layer** was implemented for the CDSCO drug-lookup API. This system utilizes three distinct cache tiers (Hot: 24h TTL, Warm: 6h TTL, Cold: 1h TTL) with hit-frequency tracking to optimize data retention based on access patterns.

Key aspects of the implementation include:
-   **Cache Warm-up:** A `hot_drugs_seed.ts` file was introduced to pre-populate the hot cache tier on service startup, ensuring immediate availability of critical drug data.
-   **Observability & Control:** An admin-gated `POST /cache/invalidate` endpoint was added for manual cache invalidation, alongside new log statements for detailed cache hit/miss metrics.
-   **Internationalisation:** 14 new locale JSON files were integrated for the "How It Works" page, expanding language support.
-   **Documentation:** Relevant `docs/devtrack/README.md` updates and new ADRs for admin-gate mutation controls were added.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **No Caching (Direct Database Access)** | This was the existing state, which directly led to the performance bottlenecks and high database load that this ADR aims to resolve. It offered no solution to the core problem. |
| **Single-Tier Redis Cache** | While providing performance benefits, a single-tier cache would not offer the granular optimization for varying data access patterns (hot vs. warm vs. cold) that a tiered approach provides. It would be less efficient in managing cache eviction and retention, potentially leading to either premature eviction of frequently used data or prolonged retention of less used data. |
| **In-Memory Caching (e.g., Node.js `Map` or `node-cache`)** | In-memory caches are fast but are not distributed across multiple API instances, leading to cache inconsistencies and reduced hit rates in horizontally scaled environments. They are also volatile, losing all cached data on service restarts, which would negate the benefits of cache warming and require re-population from scratch. |

## Consequences

**Positive:**
-   Significantly reduced latency for CDSCO drug lookup API responses.
-   Dramatically decreased database load, improving system stability and reducing operational costs.
-   Enhanced user experience due to faster retrieval of drug information.
-   Improved system resilience and availability of critical data through cache warm-up on service startup.
-   Increased operational control and visibility with manual cache invalidation and detailed hit/miss metrics.
-   Expanded accessibility for the "How It Works" page to a broader Indian audience through new locale translations.

**Trade-offs:**
-   Introduced an additional infrastructure dependency (Redis), requiring its deployment and management.
-   Increased complexity in the data flow and service architecture due to the multi-tier caching logic.
-   Requires careful management of cache keys, TTLs, and invalidation strategies to ensure data freshness and consistency.
-   Added maintenance overhead for the `hot_drugs_seed.ts` file to keep the warm-up data relevant.

## Related Issues & PRs

-   PR #1640: feat: implement redis tiered caching and cache-warming for CDSCO drug lookup
-   Issue #1637