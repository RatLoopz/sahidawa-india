# PR #3313 — Sec : Improved SSRF Protection using DNS Resolution for IP Filtering#3307

> **Merged:** 2026-07-07 | **Author:** @hrx01-dev | **Area:** Backend | **Impact Score:** 9 | **Closes:** #3307

## What Changed

We transitioned our image URL validation in the reports submission route from a simple static hostname regex check to an asynchronous DNS-resolving verification process. By integrating Node's native `dns/promises` module, we now resolve the hostname of any submitted image URL to its underlying IP address and validate it against our blocked private IP patterns. This prevents attackers from bypassing our filters using DNS rebinding or custom domains pointing to internal network addresses.

## The Problem Being Solved

Previously, our system validated image URLs in report submissions using only static regex checks on the raw hostname (e.g., blocking `localhost` or `127.0.0.1`). This left SahiDawa vulnerable to Server-Side Request Forgery (SSRF) via DNS Rebinding. 

An attacker could register a malicious domain (e.g., `attacker.com`) that initially resolves to a public IP to bypass static checks, but subsequently resolves to an internal IP (like `127.0.0.1` or AWS metadata endpoint `169.254.169.254`) when the backend attempts to fetch or process the image. This could expose internal microservices, databases, or cloud metadata endpoints.

## Files Modified

- `apps/api/src/routes/reports.ts`
- `apps/api/tests/reports.test.ts`

## Implementation Details

### DNS Resolution Integration
We imported the promise-based DNS API from Node.js:
```typescript
import dns from "dns/promises";
```

### Asynchronous Validation Function
We refactored `isPublicImageUrl` to be an asynchronous function returning a `Promise<boolean>`. The function executes the validation in two stages:
1. **Static Regex Check:** We extract the protocol and hostname using the `URL` constructor. We run a static regex check against `BLOCKED_IMAGE_URL_PATTERNS` to catch obvious local hostnames quickly without incurring the overhead of a DNS lookup.
2. **DNS Lookup & IP Validation:** If the static check passes, we perform `await dns.lookup(normalized)` to retrieve the actual IP address (`address`). We then run this resolved IP address against `BLOCKED_IMAGE_URL_PATTERNS` (which covers IPv4 private ranges, loopback, link-local, and IPv6 equivalents).

### Async Schema Parsing
Because `isPublicImageUrl` is now asynchronous, the Zod schema validation in the POST `/api/reports` route handler was updated to use `await createReportSchema.safeParseAsync(req.body)` instead of the synchronous `safeParse`.

## Technical Decisions

- **Why `dns/promises` over third-party libraries?** We chose Node's built-in `dns/promises` module to avoid adding external dependencies, keeping our backend lightweight and secure.
- **Why two-stage validation (static then DNS)?** We perform a static regex check first to short-circuit and avoid unnecessary DNS lookup overhead for obviously blocked hostnames (like `localhost` or raw private IPs).
- **Why `safeParseAsync`?** Zod schemas that contain asynchronous refinement rules (like our updated image URL validation) must be parsed using `safeParseAsync` to correctly await the resolution of the promise.

## How To Re-Implement (Contributor Reference)

If you need to implement this DNS-resolving SSRF protection pattern in another service or route, follow these steps:

1. **Import DNS Promises:**
   ```typescript
   import dns from "dns/promises";
   ```
2. **Define Blocked IP Patterns:** Ensure you have a robust list of regexes covering private, loopback, and link-local addresses:
   ```typescript
   const BLOCKED_IMAGE_URL_PATTERNS = [
       /^localhost$/i,
       /^127\./,
       /^10\./,
       /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
       /^192\.168\./,
       /^169\.254\./,
       /^::1$/,
       /^fc00::/i,
       /^fe80::/i,
       /^::ffff:/i,
   ];
   ```
3. **Implement the Async Validator:**
   ```typescript
   async function isPublicImageUrl(rawUrl: string): Promise<boolean> {
       try {
           const { protocol, hostname } = new URL(rawUrl);
           if (protocol !== "https:" && protocol !== "http:") return false;
           const normalized = hostname.replace(/^\[|\]$/g, "");

           if (BLOCKED_IMAGE_URL_PATTERNS.some((p) => p.test(normalized))) {
               return false;
           }

           const { address } = await dns.lookup(normalized);

           if (BLOCKED_IMAGE_URL_PATTERNS.some((p) => p.test(address))) {
               return false;
           }

           return true;
       } catch {
           return false;
       }
   }
   ```
4. **Use Async Parsing in Route Handlers:** Ensure any controller parsing the schema uses `await schema.safeParseAsync(req.body)` to prevent unhandled promise rejections or bypassed validations.

## Impact on System Architecture

This change significantly hardens our backend security posture, specifically protecting our internal network, cloud metadata services, and local loopback interfaces from unauthorized access via user-submitted report images. It establishes a secure pattern for handling external URLs that can be reused across other modules of SahiDawa (e.g., pharmacy verification, external link sharing).

## Testing & Verification

### Unit Testing
In `apps/api/tests/reports.test.ts`, we globally mocked `dns/promises` to resolve to a safe public IP (`8.8.8.8`) for standard tests:
```typescript
jest.mock("dns/promises", () => ({
    lookup: jest.fn().mockResolvedValue({ address: "8.8.8.8", family: 4 }),
}));
```

### SSRF/DNS Rebinding Test
We added a dedicated test case `"blocks SSRF attempts with DNS rebinding/resolution to private IPs"`. It overrides the mock to return a link-local AWS metadata IP (`169.254.169.254`) and asserts that the API returns a `400 Bad Request` with the specific validation error message:
`"Image URL must use http(s) and must not point to a private, loopback, or link-local address"`