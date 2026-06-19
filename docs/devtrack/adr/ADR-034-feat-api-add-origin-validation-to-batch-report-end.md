# ADR — feat(api): add origin validation to batch report endpoint Closes #1937

> **Date:** 2024-07-20 | **PR:** #1937 | **Status:** Accepted

## Context

The SahiDawa API included an existing origin validation mechanism, `isAllowedOrigin()`, applied to the `/api/verify` endpoint to restrict access to known client applications. However, the `POST /api/verify/batch/report` endpoint, which handles the submission of batch verification reports, lacked this critical security control. This inconsistency presented a potential vulnerability, allowing requests from any origin to submit reports, bypassing the intended security posture.

## Decision

The `isAllowedOrigin()` function and its associated `ALLOWED_ORIGINS` configuration were extracted from `apps/api/src/routes/verify.ts` into a new, shared utility module located at `apps/api/src/utils/originCheck.ts`. This centralized utility was then imported and applied as an early check within the `POST /api/verify/batch/report` handler in `apps/api/src/routes/batch.ts`. Requests originating from unapproved sources are now rejected with a `403 Forbidden` status and an "Access denied: unrecognized origin" error message.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Duplicate the `isAllowedOrigin` logic in `batch.ts` | Created code duplication, increased maintenance overhead, and risked inconsistencies if the validation logic or allowed origins changed. |
| Implement origin validation as a dedicated Express middleware | While a valid pattern for reusable logic, it was considered overly broad for the immediate scope of two specific endpoints and could have required more significant refactoring to integrate compared to a simple utility import. |

## Consequences

**Positive:**
- Enhanced security for the `POST /api/verify/batch/report` endpoint by restricting access to approved origins, mitigating potential abuse.
- Improved code maintainability and reduced duplication by centralizing the `isAllowedOrigin` logic and `ALLOWED_ORIGINS` configuration into a shared utility.
- Ensured consistency in the security posture across critical verification and reporting endpoints.

**Trade-offs:**
- Introduced a new utility file (`originCheck.ts`), slightly increasing the project's file count and module dependencies.
- Requires careful management of the `ALLOWED_ORIGINS` environment variable to ensure all legitimate client applications can access the API. Incorrect configuration could lead to legitimate requests being denied.

## Related Issues & PRs

- PR #1937: feat(api): add origin validation to batch report endpoint Closes #1937
- Issue #1937