# PR #3629 — Sec/enhanced rate limitingto use keys alongside ip#3605

> **Merged:** 2026-07-16 | **Author:** @hrx01-dev | **Area:** Backend | **Impact Score:** 25 | **Closes:** #3605

## What Changed

We introduced a target-based rate limiting mechanism to complement our existing IP-based rate limiting. We implemented a new factory function `createKeyLimiter` in `apps/api/src/middleware/rateLimit.ts` and used it to instantiate `authTargetLimiter`. This middleware is now integrated into critical authentication and verification endpoints in `apps/api/src/routes/abha.ts` and `apps/api/src/routes/notifications.ts` to limit requests based on specific target identifiers (like ABHA addresses or phone numbers) rather than just the client's IP address.

## The Problem Being Solved

Previously, our rate limiting relied primarily on IP addresses. This left our system vulnerable to Botnet-driven proxy rotation attacks. In these attacks, malicious actors rotate through thousands of distinct IP addresses to bypass IP-based limits, allowing them to perform OTP bombing or brute-force attacks against a single target (e.g., a specific user's phone number or ABHA address). By targeting a single identity across multiple IPs, attackers could spam users with SMS/OTP notifications, inflating our Twilio/SMS gateway costs and degrading user trust.

## Files Modified

- `apps/api/src/middleware/rateLimit.ts`
- `apps/api/src/routes/abha.ts`
- `apps/api/src/routes/notifications.ts`

## Implementation Details

### 1. Key-Based Rate Limiter Factory
In `apps/api/src/middleware/rateLimit.ts`, we defined the `KeyLimiterOptions` interface and the `createKeyLimiter` factory function:
```typescript
export interface KeyLimiterOptions extends LimiterOptions {
    keyGenerator: (req: Request, res: Response) => string | Promise<string>;
}

export const createKeyLimiter = (options: KeyLimiterOptions) => {
    return rateLimit({
        skip: () => process.env.NODE_ENV === "test",
        windowMs: options.windowMs,
        max: options.max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: options.keyGenerator,
        store: buildStore(options.prefix || "general_key"),
        handler: (_req, res) => {
            res.status(429).json({
                error: options.message,
            });
        },
    });
};
```
This factory extends the default configuration to explicitly accept a `keyGenerator` property and uses our Redis-backed store (`buildStore`) to persist counters across distributed instances.

### 2. Target-Based Limiter Definition
We instantiated `authTargetLimiter` to target specific user identifiers:
```typescript
export const authTargetLimiter = createKeyLimiter({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5, // Max 5 requests per 10 minutes per target
    message: "Too many requests for this target. Please try again later.",
    prefix: "auth_target",
    keyGenerator: (req: Request) => {
        if (req.body?.abhaAddress) return `abha:${req.body.abhaAddress}`;
        if (req.body?.phone_number) return `phone:${req.body.phone_number}`;
        return req.ip || "unknown";
    },
});
```

### 3. Route Integration
We applied `authTargetLimiter` to the following routes:
- **ABHA Linking (`apps/api/src/routes/abha.ts`)**: Applied to `POST /link` and `POST /verify-otp`.
- **Notifications (`apps/api/src/routes/notifications.ts`)**: Applied to `POST /register` and `POST /verify-otp`.

## Technical Decisions

- **Layered Middleware Chain**: We chose to chain the target-based limiter *after* the IP-based limiter (e.g., `authLimiter, authTargetLimiter`). This ensures that high-volume generic attacks from a single IP are blocked early by the cheaper IP-based filter before we parse request bodies or hit Redis with key-specific lookups.
- **Redis-Backed Store**: We reuse our existing `buildStore` factory to ensure that target-based rate limit counters are synchronized across all API instances in our distributed environment, preventing attackers from bypassing limits by hitting different server instances.
- **Fallback to IP**: If a request does not contain `abhaAddress` or `phone_number`, the key generator falls back to `req.ip`. This ensures the middleware remains robust and doesn't crash or allow un-throttled requests if the payload is malformed or unexpected.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar key-based rate limiter on another route:

1. **Import the Limiter**: Import `authTargetLimiter` (or create a custom one using `createKeyLimiter`) in your route file.
2. **Apply to Route**: Add the limiter to your Express route definition. Ensure it is placed after body-parsing middleware (like `express.json()`) so that `req.body` is populated.
   ```typescript
   router.post("/your-route", authLimiter, authTargetLimiter, async (req, res) => { ... });
   ```
3. **Gotchas**: 
   - **Test Environment**: The limiter is skipped when `process.env.NODE_ENV === "test"` to prevent integration tests from failing due to rate limits.
   - **Payload Validation**: Ensure your route validates the presence of the target key (e.g., using Zod) so that the rate limiter has a reliable key to hash in Redis.

## Impact on System Architecture

- **Security Hardening**: Significantly reduces the risk of distributed OTP bombing attacks and brute-force attempts on user accounts.
- **Cost Control**: Protects SahiDawa's SMS gateway (Twilio/Msg91) from financial exhaustion caused by automated bots requesting OTPs for a single phone number across rotated proxy IPs.
- **Extensibility**: Establishes a clean, reusable pattern (`createKeyLimiter`) for any future route that requires rate limiting based on application-level keys rather than network-level IPs.

## Testing & Verification

- **Manual Verification**: Tested by sending multiple requests to `/api/v1/abha/link` and `/api/v1/notifications/verify-otp` using different IP addresses (simulated via proxies) but targeting the same `phone_number` or `abhaAddress`.
- **Expected Behavior**: After 5 requests within 10 minutes, the system correctly returns a `429 Too Many Requests` status code with the message `"Too many requests for this target. Please try again later."`.
- **Automated Tests**: Verified that integration tests still pass because the limiters are skipped when `NODE_ENV === "test"`.