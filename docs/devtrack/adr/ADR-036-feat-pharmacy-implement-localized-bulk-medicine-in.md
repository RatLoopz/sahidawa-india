# ADR — feat(pharmacy): implement localized bulk medicine inventory upload framework

> **Date:** 2026-06-20 | **PR:** #2151 | **Status:** Accepted

## Context

Pharmacy owners required an efficient and reliable method to update their medicine inventory in bulk, moving beyond manual, item-by-item entry. The existing system lacked a mechanism for high-volume data ingestion, leading to potential data staleness and operational inefficiencies for pharmacies. A solution was needed to allow authenticated users to upload structured inventory data, ensuring data integrity, providing clear feedback, and supporting internationalization.

## Decision

A full-stack framework for localized bulk medicine inventory upload was implemented, supporting CSV file uploads of up to 500 line items.

**Implementation Details:**
-   **Backend (`apps/api`):**
    -   A robust runtime payload parser was created, providing detailed error line summaries for invalid data.
    -   Route context sequences were guarded early to minimize resource consumption by pre-validating requests.
    -   Sequential validation checks were replaced with an atomic catch system leveraging standard PostgreSQL constraints to decisively protect against concurrent double-submits and ensure data integrity.
-   **Database (`supabase/migrations`):**
    -   A dedicated database schema was introduced to track pharmacy inventory batches.
    -   A `UNIQUE` identifier check was directly applied to the schema structure, ensuring multi-thread race conditions fail safely at the database constraint layer.
-   **Frontend (`apps/web`):**
    -   A responsive drag-and-drop file uploader component was added, integrated within the `next-intl` dynamic multi-language directory layout (`[locale]/(dashboard)`).
    -   File evaluation was handled via local `FileReader` text streams to safely process and submit payloads.
    -   A detailed execution log was implemented, displaying successes, parsed rows, and targeted individual row error descriptions to the user.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Manual Entry Only** | Inefficient for bulk data, high potential for human error, poor user experience for pharmacies with large inventories, and not scalable for platform growth. |
| **Server-Side File Processing (Synchronous)** | Could lead to long request times, timeouts, and poor user experience for large files. Resource-intensive on the server for parsing and validation before a response could be sent, potentially blocking other operations. |
| **Third-Party Inventory Management Integration** | Increased dependency on external services, potential data privacy concerns, higher cost, and less control over specific features and integration with SahiDawa's unique data model and verification processes. |

## Consequences

**Positive:**
-   Empowered pharmacy owners with an efficient, high-volume method for managing and updating medicine inventory.
-   Significantly reduced manual data entry errors and improved data accuracy through robust validation at multiple layers (frontend, backend, database).
-   Enhanced user experience with a localized, intuitive drag-and-drop interface and detailed, actionable error feedback.
-   Improved platform scalability for inventory updates by offloading initial parsing to the client and ensuring efficient backend processing.
-   Strong data integrity guarantees through database-level unique constraints, protecting against race conditions and duplicate entries.

**Trade-offs:**
-   Increased complexity in the codebase across frontend, backend, and database layers, requiring careful maintenance.
-   Higher initial development effort compared to simpler, less robust solutions.
-   Dependency on users providing data in a specific CSV format, requiring clear documentation and user education.

## Related Issues & PRs

-   PR #2151: feat(pharmacy): implement localized bulk medicine inventory upload framework
-   Issue #1494