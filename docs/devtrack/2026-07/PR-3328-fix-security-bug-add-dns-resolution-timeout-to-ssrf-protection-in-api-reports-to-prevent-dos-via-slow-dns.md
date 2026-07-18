# PR #3328 — fix:  [Security/Bug] Add DNS resolution timeout to SSRF protection in /api/reports to prevent DoS via slow DNS

> **Merged:** 2026-07-08 | **Author:** @Kirtan-pc | **Area:** Backend | **Impact Score:** 9 | **Closes:** #3323

## What Changed

We introduced a configurable DNS resolution timeout to our Server-Side Request Forgery (SSRF) protection layer in the `/api/reports` endpoint. By wrapping `dns.promises.lookup` with a `Promise.race` timeout mechanism, we prevent slow or hanging DNS lookups from blocking Node.js worker threads. Additionally, we refactored the image validation schema to execute asynchronously using Zod's async parsing capabilities.

## The Problem Being Solved

SahiDawa allows users to submit reports of counterfeit or substandard medicines, which can include image URLs for verification. To prevent SSRF attacks (where an attacker submits a URL pointing to internal services like loopback or link-local addresses), our system resolves the domain name of the image URL to inspect its IP address. 

However, the standard `dns.lookup()` function relies on the operating system's resolver via `libuv`'s thread pool. If an attacker submits a URL pointing to a slow, malicious, or non-responsive DNS server, the lookup could hang indefinitely. This exhausts the Node.js event loop's thread pool, leading to an application-level Denial of Service (DoS) where legitimate users cannot submit reports or access the platform.

## Files Modified

- `apps/api/src/routes/reports.ts`
- `apps/api/tests/reports.test.ts`

## Implementation Details

### DNS Timeout Integration
We imported the native `dns` module and extracted `DNS_LOOKUP_TIMEOUT_MS` from environment variables, defaulting to `3000` ms:
```typescript
const DNS_TIMEOUT_MS = parseInt(process.env.DNS_LOOKUP_TIMEOUT_MS ?? "3000", 10);
```

### Asynchronous Verification
We refactored `isPublicImageUrl(rawUrl: string)` to return `Promise<boolean>`. Inside, we race the DNS resolution against a `setTimeout` promise that rejects with a `"DNS lookup timeout"` error after the configured duration:
```typescript
const dnsResult = (await Promise.race([
    (dns.promises.lookup as any)(normalized),
    new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DNS lookup timeout")), DNS_TIMEOUT_MS)
    ),
])) as { address: string };
```

### Fail-Closed Security
Any caught error (including DNS timeouts, resolution failures, or invalid domains) in `isPublicImageUrl` returns `false`, blocking the URL.

### Zod Schema Refactoring
The `safeImageUrl` Zod schema was updated to use an async refinement:
```typescript
const safeImageUrl = z
    .string()
    .url()
    .refine(async (v) => await isPublicImageUrl(v), {
        message:
            "Image URL must use http(s) and must not point to a private, loopback, or link-local address",
    });
```

### Route Handler Update
In the POST handler for `/api/reports`, we switched from synchronous parsing to `await createReportSchema.safeParseAsync(req.body as unknown)` to handle the async validation chain.

## Technical Decisions

- **Promise.race vs. Third-party Libraries:** We chose to implement a lightweight `Promise.race` wrapper around Node's native `dns.promises.lookup` instead of pulling in external DNS resolution libraries. This keeps our dependency footprint small and leverages Node's built-in APIs.
- **Fail-Closed Security Posture:** If a DNS query times out or fails, we treat it as unsafe and return `false`. While this might occasionally block a legitimate image hosted on an extremely slow DNS server, it guarantees that SahiDawa's backend remains resilient against DoS attacks.
- **Async Zod Parsing:** We transitioned the route validation to `safeParseAsync` to seamlessly integrate the network-bound DNS check into our existing request validation pipeline without blocking the main event loop thread.

## How To Re-Implement (Contributor Reference)

1. **Define a Timeout Constant:** Source `DNS_LOOKUP_TIMEOUT_MS` from environment variables with a safe fallback (e.g., `3000` ms).
2. **Extract and Normalize Hostname:** In the URL validation utility, extract the hostname and run it against static blocked patterns (e.g., loopback, private IP ranges).
3. **Race the DNS Lookup:** Wrap the DNS lookup in a `Promise.race` block:
   ```typescript
   const dnsResult = await Promise.race([
       dns.promises.lookup(hostname),
       new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), DNS_TIMEOUT_MS))
   ]);
   ```
4. **Enforce Fail-Closed Policy:** Catch any errors thrown by the race (either timeout or resolution failure) and return `false`.
5. **Convert Zod Schema to Async:** Convert the Zod schema validating the URL to use an async `.refine()` block that awaits this validation function.
6. **Update Route Handlers:** Update the Express route handler to use `schema.safeParseAsync(req.body)` instead of synchronous parsing, and handle the validation result accordingly.

## Impact on System Architecture

This change hardens our backend against resource exhaustion attacks, ensuring high availability for rural health workers who rely on SahiDawa under sub-optimal network conditions. By moving to async validation, we lay the groundwork for other network-bound validations (such as checking image metadata or remote virus scanning) within our request parsing pipeline.

## Testing & Verification

- **Hanging DNS Mock Test:** We added a unit test in `apps/api/tests/reports.test.ts` that mocks `dns.promises.lookup` to return a promise that never resolves (simulating a hanging DNS server).
- **Fast CI Execution:** We set `process.env.DNS_LOOKUP_TIMEOUT_MS` to `"50"` in the test environment to ensure the test suite runs quickly and does not introduce latency in our CI/CD pipeline.
- **Assertion:** The test asserts that the endpoint correctly returns a `400 Bad Request` with the error message `"Invalid report payload"` when a slow DNS resolution is triggered.