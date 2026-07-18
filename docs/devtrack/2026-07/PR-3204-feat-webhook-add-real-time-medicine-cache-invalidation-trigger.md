# PR #3204 — feat(webhook): add real-time medicine cache invalidation trigger

> **Merged:** 2026-07-04 | **Author:** @jamunatg2006-sys | **Area:** Backend | **Impact Score:** 9 | **Closes:** #3200

## What Changed

We implemented a real-time cache invalidation webhook handler at `/api/webhooks/supabase/medicines` within our backend API. This endpoint listens for database events (INSERT, UPDATE, DELETE) dispatched by Supabase on the `medicines` table. Upon receiving a valid event, the handler identifies and purges stale Redis cache keys associated with the modified medicine's batch number, brand name, and generic name.

## The Problem Being Solved

SahiDawa relies heavily on Redis to cache medicine details and batch records to ensure high performance and low latency for rural health workers using our platform. Previously, these cached entries had a Time-To-Live (TTL) of up to 24 hours. 

This created a critical safety risk: if a medicine was recalled, flagged as counterfeit, or had its batch details updated in our Supabase database, our system would continue to serve stale, potentially dangerous data to users for up to a day. We needed a secure, instantaneous, event-driven mechanism to invalidate specific cache keys the moment any medicine record is modified in the database.

## Files Modified

- `apps/api/src/routes/webhooks.ts`

## Implementation Details

The webhook handler is integrated into our Express router and executes the following sequence:

1. **Rate Limiting & Security Verification**: 
   The route is protected by the `webhookLimiter` middleware. It extracts the `Authorization` header and compares it against the `SUPABASE_WEBHOOK_SECRET` environment variable using `safeCompare` (a timing-safe string comparison utility) to prevent timing attacks. If the token is invalid or missing, it logs a warning with the request IP and headers, then returns a `401 Unauthorized` response.

2. **Redis Connection Guard**:
   The handler checks if `redisClient.isOpen` is true. If Redis is offline, it logs a warning and returns a `200 OK` response with `{ invalidated: 0, message: "Redis unavailable" }` to prevent unhandled exceptions and avoid blocking Supabase's webhook retry queue.

3. **Payload Parsing**:
   It extracts the active record from the Supabase payload (`payload.record` for INSERT/UPDATE or `payload.old_record` for DELETE) to retrieve `batch_number`, `brand_name`, and `generic_name`.

4. **Cache Key Identification**:
   - **Batch Lookups**: If a `batch_number` is present, we perform a cursor-based scan using `redisClient.scan` matching the pattern `drug:batch:${batchNumber}*` with a count of 100. This gathers all matching keys (such as specific batch verification results) across pagination cycles.
   - **Voice Search Cache**: If `brand_name` or `generic_name` are present, we normalize them by converting them to lowercase and replacing spaces with underscores (e.g., `medicine:voice:paracetamol_500mg`). These normalized strings are used to target exact voice search cache keys.

5. **Atomic Deletion**:
   All identified keys are collected into an array, deduplicated using a `Set`, and deleted atomically using `redisClient.del(uniqueKeys)`. The system then logs the number of deleted keys and returns a `200 OK` response containing the list of invalidated keys.

## Technical Decisions

- **Cursor-Based Scanning (`SCAN` over `KEYS`)**: We chose `redisClient.scan` instead of the simpler `KEYS` command. The `KEYS` command blocks the single-threaded Redis event loop, which could degrade production API performance. Using `SCAN` with `COUNT: 100` allows us to incrementally find matching batch keys safely.
- **Timing-Safe Token Comparison**: Standard string comparison (`===`) returns early as soon as a character mismatch is found, exposing the system to timing attacks. Using `safeCompare` ensures that the comparison takes a constant amount of time regardless of how many characters match, securing our webhook endpoint.
- **Graceful Degradation on Redis Failure**: If Redis is temporarily down, we return a `200 OK` instead of a `500 Internal Server Error`. This prevents Supabase from repeatedly retrying the webhook and causing a retry storm, acknowledging that cache invalidation is a best-effort performance optimization and the database remains the source of truth.

## How To Re-Implement (Contributor Reference)

To re-implement or extend this webhook handler, follow these steps:

1. **Define the Route**: Add a new POST route to `apps/api/src/routes/webhooks.ts` under the path `/supabase/medicines`.
2. **Apply Middleware**: Ensure `webhookLimiter` is passed as the first middleware.
3. **Implement Security Check**:
   ```typescript
   const secret = process.env.SUPABASE_WEBHOOK_SECRET;
   const authHeader = req.headers["authorization"];
   const isValid = typeof secret === "string" && typeof authHeader === "string" && safeCompare(authHeader, `Bearer ${secret}`);
   if (!isValid) {
       res.status(401).json({ error: "Unauthorized" });
       return;
   }
   ```
4. **Check Redis State**: Verify `redisClient.isOpen` before running any Redis commands.
5. **Extract and Normalize Fields**:
   - Extract `batch_number`, `brand_name`, and `generic_name` from `req.body.record || req.body.old_record || {}`.
   - Normalize names for voice keys: `const normalized = name.toLowerCase().replace(/\s+/g, "_")`.
6. **Scan and Collect Keys**:
   - Use a `do...while` loop with `redisClient.scan` to collect keys matching `drug:batch:${batchNumber}*`.
   - Push normalized voice keys (`medicine:voice:${normalized}`) directly to the deletion array.
7. **Execute Deletion**:
   - Deduplicate the array: `const uniqueKeys = Array.from(new Set(keysToDelete))`.
   - If `uniqueKeys.length > 0`, call `await redisClient.del(uniqueKeys)`.
8. **Log and Respond**: Use the system `logger` to record the outcome and return a JSON payload with the count of `invalidated` keys.

## Impact on System Architecture

This change shifts our caching strategy from a passive, TTL-based expiration model to an active, event-driven invalidation model. It guarantees strong eventual consistency between our Supabase PostgreSQL database and our Redis cache. This architecture ensures that critical updates—such as marking a medicine batch as counterfeit or updating dosage instructions—are reflected across all client applications instantly, significantly improving patient safety in rural clinics.

## Testing & Verification

We verified this implementation by simulating Supabase database webhook payloads:

- **Active Cache Invalidation**: When a payload containing an active batch number and brand name is sent, the system successfully scans Redis, identifies the keys, deletes them, and logs:
  ```text
  info: Medicine cache invalidated — deleted 2 key(s)
  ```
- **No Matching Cache**: When a webhook is received for a medicine that is not currently cached, the system completes the scan safely without error and logs:
  ```text
  info: Medicine webhook fired — no cache keys found to invalidate
  ```
- **Unauthorized Access**: Requests with missing or incorrect `Authorization` headers are rejected immediately with a `401 Unauthorized` status, and a warning is logged containing the sender's IP.