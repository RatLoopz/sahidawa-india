# PR #3755 — feat: implement automated sensitive data redaction in logger and remove manual header sanitization in webhooks

> **Merged:** 2026-07-20 | **Author:** @TanCodeX | **Area:** Backend | **Impact Score:** 15 | **Closes:** #3672

## What Changed

We introduced a centralized, automated sensitive data redaction mechanism within our Winston logging pipeline in `apps/api/src/utils/logger.ts`. This system automatically scans and sanitizes sensitive metadata (such as tokens, passwords, and cookies) recursively across all logged objects. Consequently, we removed manual, error-prone header sanitization logic from our webhook routes in `apps/api/src/routes/webhooks.ts`, relying instead on the logger to automatically secure the data.

## The Problem Being Solved

Before this PR, protecting sensitive user and system data (like API keys, session cookies, and authorization headers) relied on manual sanitization at the log call-site. For example, developers had to manually strip headers using patterns like `{ ...req.headers, authorization: undefined }`. 

This manual approach had several critical flaws:
1. **Developer Error:** It is easy to forget to sanitize headers or payloads when writing new routes or logging statements, risking accidental exposure of credentials or PII in production logs.
2. **Maintenance Overhead:** As new sensitive fields were introduced, we had to find and update every manual sanitization point across the codebase.
3. **Logger Instability:** Logging complex nested objects or circular references could cause the logger to crash or enter infinite loops, threatening service availability.

## Files Modified

- `apps/api/src/routes/webhooks.ts`
- `apps/api/src/utils/logger.ts`

## Implementation Details

### Centralized Redaction Engine
We implemented a recursive redaction utility inside `apps/api/src/utils/logger.ts` to process log metadata before it is written to any transport.

1. **Sensitive Keys Definition:**
   We defined a static `Set` of lowercase sensitive keys to ensure $O(1)$ lookup times:
   ```typescript
   const SENSITIVE_KEYS = new Set([
       "authorization",
       "cookie",
       "set-cookie",
       "x-api-key",
       "password",
       "token",
       "secret",
   ]);
   ```

2. **Recursive Redaction Function (`redactObj`):**
   This function recursively traverses logged metadata objects:
   - **Base Cases:** Returns null or non-object primitives immediately.
   - **Circular Reference Prevention:** Uses a `WeakSet` to track visited objects. If an object has already been processed, it returns `"[CIRCULAR]"` to prevent infinite recursion and stack overflows.
   - **Array Handling:** Maps over arrays recursively.
   - **Key Redaction:** Iterates over object keys. If a key (lowercased to ensure case-insensitivity) exists in `SENSITIVE_KEYS`, its value is replaced with `"[REDACTED]"`. Otherwise, the value is recursively processed.
   - **Winston Symbol Preservation:** Winston relies on internal Symbol keys (such as `Symbol(level)`, `Symbol(message)`, and `Symbol(splat)`) to pass metadata through the transport pipeline. We explicitly retrieve these symbols using `Object.getOwnPropertySymbols(obj)` and copy them to the redacted object to prevent breaking Winston's downstream formatting.

3. **Winston Format Integration:**
   We wrapped the recursive utility in a custom Winston format and registered it in our logger configuration:
   ```typescript
   const redactSensitiveData = winston.format((info) => {
       return redactObj(info);
   });
   ```
   This format is placed in the `winston.createLogger` pipeline right after `injectRequestId()` and before the final output formatting (JSON or colorized console).

### Webhook Route Simplification
In `apps/api/src/routes/webhooks.ts`, we simplified the unauthorized webhook log statements for both the `health-schemes` and `medicines` endpoints. Instead of manually stripping the authorization header:
```typescript
headers: { ...req.headers, authorization: undefined }
```
We now safely pass the raw headers directly:
```typescript
headers: req.headers
```
The centralized logger automatically intercepts and redacts the `authorization` header.

## Technical Decisions

- **Centralized Middleware vs. Local Sanitization:** We chose centralized formatting to enforce a "secure by default" architecture. Developers no longer need to remember to sanitize headers; the system handles it globally.
- **WeakSet for Circular References:** We used a `WeakSet` instead of a standard `Set` or array to track visited objects. This prevents memory leaks because `WeakSet` holds weak references to its keys, allowing them to be garbage-collected if there are no other references.
- **Symbol Preservation:** Simply cloning the object with standard keys would strip Winston's internal symbols, breaking console colorization and JSON formatting. Explicitly copying symbols via `Object.getOwnPropertySymbols` was necessary to maintain compatibility with Winston's internal architecture.
- **Case-Insensitive Matching:** HTTP headers are case-insensitive (e.g., `Authorization` vs `authorization`). Lowercasing keys before checking against `SENSITIVE_KEYS` guarantees we catch all variations.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or extend this redaction system, follow these steps:

1. **Define the Target Keys:** Add any new sensitive keys (e.g., `private-key`, `otp`) to the `SENSITIVE_KEYS` Set in `apps/api/src/utils/logger.ts` in lowercase.
2. **Implement the Recursive Redactor:**
   - Ensure you handle null and non-object primitives first.
   - Initialize a `WeakSet` to track visited objects.
   - If an object is in the `WeakSet`, return `"[CIRCULAR]"`.
   - If it is an array, map over it recursively.
   - For objects, check if the lowercased key matches the sensitive set. If so, set the value to `"[REDACTED]"`.
   - **Crucial Step:** Copy Winston's internal symbols to the new object:
     ```typescript
     const symbols = Object.getOwnPropertySymbols(obj);
     for (const sym of symbols) {
         redacted[sym] = obj[sym];
     }
     ```
3. **Register the Format:** Add the custom format to the `winston.createLogger` format chain. Ensure it runs *before* the final JSON or console formatting.
4. **Remove Manual Sanitization:** Clean up any manual header-stripping code in route handlers to keep the codebase clean and dry.

## Impact on System Architecture

- **Security Compliance:** Significantly reduces the risk of exposing sensitive credentials, API keys, and session tokens to external log aggregators or console outputs.
- **Developer Velocity:** Developers can safely log request payloads or headers during debugging without worrying about security compliance or manual sanitization.
- **System Resilience:** Prevents logger crashes due to circular references in complex objects, ensuring high availability of our backend services.

## Testing & Verification

The implementation was verified using a scratch test script (`scratch/test_logger.ts`) covering the following scenarios:
- **Flat Sensitive Fields:** Verified that `{ authorization: "Bearer xyz", password: "123" }` is successfully converted to `{ authorization: "[REDACTED]", password: "[REDACTED]" }`.
- **Nested Sensitive Fields:** Verified that nested headers like `{ headers: { Cookie: "...", "X-API-KEY": "..." } }` are recursively sanitized.
- **Circular References:** Verified that objects referencing themselves are safely replaced with `"[CIRCULAR]"` without throwing stack overflow errors.
- **Metadata Integrity:** Verified that non-sensitive fields and Winston internal metadata (Symbols) remain unchanged.