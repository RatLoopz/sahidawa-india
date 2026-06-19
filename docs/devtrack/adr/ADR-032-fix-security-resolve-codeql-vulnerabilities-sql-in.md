# ADR — fix(security): resolve CodeQL vulnerabilities (SQL Injection, Log Inj…

> **Date:** 2026-06-12 | **PR:** #1746 | **Status:** Accepted

## Context

The SahiDawa platform was identified to have critical security vulnerabilities through CodeQL scans, specifically SQL Injection, Log Injection, and Unvalidated Input. These vulnerabilities were present in API endpoints and cache management services that process user-supplied data, posing a significant risk to data integrity, confidentiality, and system availability. The existing implementation lacked robust input validation and sanitization, making the system susceptible to malicious input.

## Decision

To mitigate the identified security risks, a multi-faceted approach was implemented:
1.  **Input Validation with Zod:** The `/cache/invalidate` API endpoint was refactored to incorporate `zod` for robust, schema-based input validation. This ensures that `drugIds` and `batchNumbers` arrays conform to expected types and formats before processing.
2.  **Input Sanitization:** User-provided `batchNumber` values are now explicitly sanitized by removing newline and carriage return characters (`.replace(/[\r\n]/g, "")`) before being used in Redis cache keys or log messages. This prevents Log Injection and ensures safe key generation.
3.  **SQL Injection Prevention:** The `warmCache` function's database queries were refactored to use separate `.in()` clauses for `generic_name` and `brand_name` instead of constructing a combined `.or()` condition via string concatenation. This leverages Supabase's client library's safe parameterization, effectively preventing SQL injection vulnerabilities that could arise from dynamic query construction.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Manual input validation | Prone to human error, less maintainable, and lacks the declarative power and type safety of a dedicated schema validation library like `zod`. |
| Using `joi` or `express-validator` for input validation | While viable, `zod` was chosen for its strong TypeScript integration, inference capabilities, and growing community adoption, offering a more modern and type-safe approach. |
| Manual escaping for SQL queries | Highly error-prone and less secure than relying on the database client's built-in parameterization or ORM features. Increases the risk of introducing new injection vectors. |

## Consequences

**Positive:**
- Significantly enhanced the platform's security posture against common web vulnerabilities including SQL Injection, Log Injection, and Unvalidated Input.
- Improved code robustness and maintainability through the adoption of explicit, type-safe validation schemas using `zod`.
- Reduced the risk of data breaches, unauthorized access, and system instability caused by malicious inputs.

**Trade-offs:**
- Introduction of a new dependency (`zod`) and associated learning curve for developers unfamiliar with it.
- Increased boilerplate code for defining validation schemas for API endpoints.

## Related Issues & PRs

- PR #1746: fix(security): resolve CodeQL vulnerabilities (SQL Injection, Log Inj…
- Issue #123