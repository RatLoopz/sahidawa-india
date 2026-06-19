# ADR — Feat: Implement Medicine Interaction Checker (closes #1626)

> **Date:** 2026-06-11 | **PR:** #1694 | **Status:** Accepted

## Context

SahiDawa required a robust system to identify potential adverse drug-drug interactions, a critical feature for patient safety, especially within rural health contexts where internet connectivity can be intermittent. The existing platform lacked a dedicated, resilient mechanism for users to check medicine compatibility, leading to potential health risks and operational inefficiencies.

## Decision

A comprehensive Medicine Interaction Checker was implemented with a multi-layered architecture to ensure reliability and user experience.

1.  **Database Integration:** A new `drug_interactions` schema migration was added to Supabase, featuring bidirectional index optimizations and Row-Level Security (RLS) policies. This database stores standard interaction seed data (e.g., *Sildenafil + Nitroglycerin*, *Paracetamol + Warfarin*).
2.  **Backend API:** A new endpoint, `/api/v1/interactions/check`, was mounted. This endpoint resolves brand/medicine names to active generic ingredients and performs a bidirectional search against the `drug_interactions` database.
3.  **Offline Fallback Resilience:** The system was designed to automatically bypass Supabase connection timeouts. If the database is unreachable, it immediately falls back to local, in-memory standard interaction lookups, ensuring continuous functionality.
4.  **Frontend Implementation:** A dedicated, responsive Medicine Interaction Checker page was mounted at `/interaction-checker`. This UI includes debounced fuzzy autocomplete searches, chip badge representation for selected medicines, color-coded alert cards grouped by severity (Critical, Serious, Moderate, Minor), and `localStorage` persistence for user selections.
5.  **API Client & Translations:** A `checkInteractions` fetch client wrapper was added, supporting CSRF. Corresponding translation keys were defined in `en.json` under `"Interactions"`.
6.  **Automated Testing:** Comprehensive tests were implemented to verify bidirectional checker lookups, request payload validation, and the critical database offline automatic fallback behavior.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Purely External API Integration | Relying solely on a third-party drug interaction API would introduce external dependencies, potential costs, and data privacy concerns. Crucially, it would not inherently provide the required offline fallback resilience without significant local caching logic, which would largely replicate the chosen solution's complexity. |
| Client-Side Only Interaction Logic | Downloading the entire interaction database to the client for local processing would result in a large initial payload, potential performance issues on less powerful devices, and increased complexity in keeping data updated. This approach also lacks the server-side RLS benefits and robust data management of a dedicated database. |
| Server-Side Only (No Offline Fallback) | This approach would have relied entirely on the Supabase database for all interaction checks. It was rejected as it directly contradicts the requirement for resilience in environments with intermittent connectivity, a core challenge for a rural health platform like SahiDawa, leading to a poor user experience during outages. |

## Consequences

**Positive:**
-   Significantly enhanced patient safety by providing immediate access to critical drug interaction information.
-   Improved user experience and system reliability, particularly in rural areas, due to robust offline fallback capabilities.
-   Established a scalable and maintainable system for managing and querying drug interaction data.
-   Provided a modern, intuitive user interface for interaction checking, improving user engagement.

**Trade-offs:**
-   Increased architectural complexity due to the dual-path data retrieval mechanism (database vs. in-memory fallback) and the logic for managing this failover.
-   Ongoing maintenance overhead for keeping the local static interaction data synchronized or updated with the primary database, although the initial seed data is expected to be relatively stable.

## Related Issues & PRs

- PR #1694: Feat: Implement Medicine Interaction Checker (closes #1626)
- Issue #1626