# ADR — feat: implement automated sensitive data redaction in logger and remove manual header sanitization in webhooks

> **Date:** 2026-07-20 | **PR:** #3755 | **Status:** Accepted

## Context

SahiDawa processes sensitive data, including API keys, authorization tokens, and user credentials, across its webhook endpoints and API routes. Previously, sanitizing this data before logging relied on manual redaction at the call site (e.g., explicitly setting `authorization: undefined` when logging request headers). This manual approach was error-prone, duplicated boilerplate code, and introduced a high risk of accidental credential exposure in application logs if a developer forgot to sanitize a log statement.

## Decision

We implemented a centralized, automated sensitive data redaction mechanism directly within the Winston logging pipeline and removed manual sanitization from the route handlers. 

The implementation details include:
1. **Custom Winston Format:** Created a `redactSensitiveData` format that recursively traverses log metadata objects.
2. **Case-Insensitive Redaction:** Defined a static set of sensitive keys (`authorization`, `cookie`, `set-cookie`, `x-api-key`, `password`, `token`, `secret`) matched case-insensitively and replaced their values with `"[REDACTED]"`.
3. **Circular Reference Protection:** Utilized a `WeakSet` to track visited objects during recursion, replacing circular references with `"[CIRCULAR]"` to prevent stack overflow crashes.
4. **Winston Symbol Preservation:** Ensured internal Winston symbols (such as `LEVEL`, `MESSAGE`, and `SPLAT`) are copied to the redacted object to prevent breaking downstream log formatting and transports.
5. **Code Cleanup:** Removed manual header sanitization from webhook routes (`apps/api/src/routes/webhooks.ts`), delegating all sanitization responsibility to the logger.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Using third-party redaction libraries (e.g., `fast-redact`)** | Added unnecessary external dependencies and supply-chain risk. A custom, lightweight recursive function tailored to Winston's symbol-based metadata structure was cleaner and highly performant for our scale. |
| **Maintaining manual sanitization at the controller level** | Rejected due to high cognitive load on developers and the persistent risk of human error leading to security compliance violations. |

## Consequences

**Positive:**
- **Enhanced Security:** Guarantees that sensitive keys are never written to log files or external log aggregators, even if developers log raw request headers or payloads.
- **Cleaner Codebase:** Removed repetitive sanitization boilerplate from route handlers, improving readability and maintainability.
- **Robustness:** Safely handles deeply nested objects and circular references without throwing runtime exceptions.

**Trade-offs:**
- **Performance Overhead:** Recursive object cloning and traversal introduces a minor CPU overhead on every log statement containing metadata.
- **Static Key List:** The list of sensitive keys is hardcoded in `logger.ts`, requiring manual updates if new sensitive fields are introduced to the application schema.

## Related Issues & PRs

- PR #3755: feat: implement automated sensitive data redaction in logger and remove manual header sanitization in webhooks
- Issue #3672