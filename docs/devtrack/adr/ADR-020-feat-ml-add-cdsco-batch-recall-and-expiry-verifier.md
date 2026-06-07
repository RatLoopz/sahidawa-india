# ADR — feat(ml): add CDSCO batch recall and expiry verifier endpoint

> **Date:** 2026-06-02 | **PR:** #1108 | **Status:** Accepted

## Context

India faced a significant crisis of 12–25% fake or substandard medicines, directly impacting 1.4 billion people. Citizens lacked any reliable method to verify medicine batches before consumption. The existing SahiDawa scanner UI had no functional backend verification engine, relying on an unavailable Node API without a fallback, rendering the feature unusable. A robust, citizen-facing verification mechanism was critical to the platform's core mission and Phase 3 roadmap.

## Decision

A new `POST /verify/batch` endpoint was implemented within the existing `apps/ml` FastAPI microservice. This endpoint accepts a `batch_number` and cross-references it against CDSCO seed data stored in `data/seeds/medicines.csv`. It returns a comprehensive `BatchVerifyResponse` including the medicine's brand, generic name, manufacturer, composition, expiry date, CDSCO approval status, and a `is_counterfeit_alert` flag. The response status is one of `valid`, `recalled` (for counterfeit alerts or banned status), `expired`, or `not_found`.

The `apps/web` frontend was updated to directly call this new ML service endpoint at `NEXT_PUBLIC_ML_URL/verify/batch`. The ML service response is mapped to the existing `VerifyResult` type, ensuring no breaking changes to the UI components. A fallback mechanism was implemented to revert to the Node API if the ML service is unavailable. The new `verify` router was registered as a required component in `apps/ml/main.py`.

## Alternatives Considered

| Alternative                                                | Why Rejected                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Implement verification in existing Node API**            | The existing Node API was described as "unavailable" and lacked a functional verification engine. Moving this critical feature to a new, dedicated ML microservice aligned with the Phase 3 roadmap for ML integration and provided a fresh, robust implementation path.                                                                                     |
| **Create a separate, dedicated verification microservice** | While a dedicated service could offer clearer separation of concerns, the current scope of verification logic was deemed suitable for inclusion within the `apps/ml` microservice, which was already part of the "medicine verification" roadmap. This avoided the overhead of deploying and managing an additional microservice for initial implementation. |
| **Client-side verification by downloading CDSCO data**     | Downloading the entire `medicines.csv` to the client for local verification would introduce significant security risks (data exposure), increase initial load times due to large data size, and complicate data updates for real-time recalls or new approvals. It would also be less performant for large datasets and less reliable for dynamic checks.    |

## Consequences

**Positive:**

- Provided a complete, end-to-end functional medicine verification feature for SahiDawa.
- Directly addressed the critical problem of fake/substandard medicines, enhancing citizen trust and safety.
- Aligned with the Phase 3 roadmap for the ML microservice and the core mission of CDSCO verification.
- Replaced a non-functional frontend dependency with a robust, actively maintained backend service.
- Established a clear, structured API for medicine batch verification.

**Trade-offs:**

- Introduced a new direct dependency from the `apps/web` frontend to the `apps/ml` microservice, increasing inter-service coupling.
- Reliance on a static `data/seeds/medicines.csv` file implies a need for a robust and automated mechanism for updating this seed data to ensure accuracy and currency of verification results.
- Expanded the scope of the `apps/ml` service to include data lookup and business logic that is not strictly machine learning, potentially blurring its primary focus.

## Related Issues & PRs

- PR #1108: feat(ml): add CDSCO batch recall and expiry verifier endpoint
- Issue #1098
