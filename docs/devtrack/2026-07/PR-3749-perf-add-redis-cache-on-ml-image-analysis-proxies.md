# PR #3749 — perf : Add Redis Cache on ML Image Analysis Proxies

> **Merged:** 2026-07-20 | **Author:** @hrx01-dev | **Area:** Backend | **Impact Score:** 13 | **Closes:** #3680

## What Changed

We introduced a Redis caching layer to our ML image analysis (OCR) proxy route in `apps/api/src/routes/scan.ts`. When an image is uploaded for OCR extraction, our system now generates a SHA-256 hash of the raw image buffer to check for a cached response in Redis before forwarding the request to the ML container. Additionally, we updated the `lint:circular` script in `package.json` to run via `npx` to ensure consistent execution across different developer environments.

## The Problem Being Solved

SahiDawa is designed for rural health environments where network connectivity can be highly unstable. Users frequently experience dropped connections, leading to repeated uploads of the exact same medicine packaging image. 

Before this PR, every single upload triggered a full network request to our ML container, which then ran computationally expensive OCR models. This architecture had several critical flaws:
1. **High Latency:** Processing the same image repeatedly wasted valuable seconds for users on slow networks.
2. **Resource Waste:** Our ML containers were subjected to redundant CPU/GPU load processing identical images.
3. **Cost & Scalability Bottlenecks:** Unnecessary container invocations increased infrastructure costs and reduced the overall throughput of our verification pipeline.

## Files Modified

- `apps/api/src/routes/scan.ts`
- `package.json`

## Implementation Details

### 1. Image Hashing and Cache Key Generation
In `apps/api/src/routes/scan.ts`, inside the `/extract` POST route, we read the uploaded file into a buffer and generate a unique SHA-256 hash:
```typescript
const fileBuffer = await fs.promises.readFile(tempFilePath);
const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
const cacheKey = `ocr_extract:${fileHash}`;
```
This hash acts as a highly collision-resistant fingerprint for the image.

### 2. Resilient Cache Lookup
Before making any external network requests, we check if our Redis client is active and query the cache:
```typescript
let data: { text?: string; confidence?: number; filename?: string } | null = null;

try {
    if (redisClient.isOpen) {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            data = JSON.parse(cached);
            logger.info(`OCR Cache HIT for image hash ${fileHash}`);
        }
    }
} catch (cacheErr) {
    logger.error(`Redis cache check error: ${cacheErr}`);
}
```
If a cache hit occurs, we completely bypass the ML service call, saving network bandwidth and compute cycles.

### 3. Fallback and Cache Population
If the cache is empty (`!data`), we proceed with the original multi-part form data fetch to the ML container. Once the ML container returns a successful response, we attempt to cache the result:
```typescript
try {
    if (redisClient.isOpen) {
        // Cache the ML response for 24 hours (86400 seconds)
        await redisClient.set(cacheKey, JSON.stringify(data), { EX: 86400 });
        logger.info(`OCR Cache SET for image hash ${fileHash}`);
    }
} catch (cacheErr) {
    logger.error(`Redis cache set error: ${cacheErr}`);
}
```

### 4. Tooling Update
In `package.json`, we modified the circular dependency check script:
- **Old:** `madge --circular apps/api/src apps/web packages/shared/src packages/types/src packages/validators/src`
- **New:** `npx madge --circular apps/api/src apps/web packages/shared/src packages/types/src packages/validators/src`
This ensures that developers do not need `madge` installed globally on their local machines for the linting step to succeed.

## Technical Decisions

### Why SHA-256?
We chose SHA-256 because it offers an exceptionally low probability of hash collisions. In a medicine verification platform, a collision (where two different medicine labels produce the same hash) could result in serving incorrect OCR data to a user, posing a severe patient safety risk. SHA-256 guarantees that distinct images will map to distinct cache keys.

### Why a 24-Hour TTL (`EX: 86400`)?
We configured the Redis keys to expire after exactly 24 hours. This duration is long enough to intercept retry storms and high-frequency duplicate uploads common in rural clinics during daily shifts. At the same time, it prevents our Redis memory footprint from growing indefinitely with stale image data.

### Graceful Degradation & Fault Tolerance
We wrapped all Redis operations (`get`, `set`) in `try/catch` blocks and guarded them with `redisClient.isOpen` checks. If our Redis cluster goes offline or experiences a network partition, the system logs the error and seamlessly falls back to calling the ML container directly. This ensures that medicine verification remains functional even if our caching infrastructure fails.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar caching proxy pattern on another ML endpoint (such as drug classification or leaf-image analysis), follow these steps:

1. **Read the File Buffer:** Ensure you have access to the raw file buffer before sending it over the network.
2. **Generate the Hash:** Use Node's native `crypto` module to generate a SHA-256 hash.
   ```typescript
   import crypto from "crypto";
   const hash = crypto.createHash("sha256").update(buffer).digest("hex");
   ```
3. **Check Redis Status:** Always check `redisClient.isOpen` before executing commands to prevent unhandled promise rejections if the client is disconnected.
4. **Wrap in Try/Catch:** Ensure all Redis interactions are wrapped in `try/catch` blocks to guarantee graceful degradation.
5. **Set an Explicit TTL:** Always provide an expiration configuration (e.g., `{ EX: 86400 }`) when saving keys to prevent memory leaks.
6. **Log Cache Events:** Use `logger.info` or `logger.error` to track cache hits, misses, and connection issues for production observability.

## Impact on System Architecture

- **Reduced ML Load:** This change significantly decreases the load on our GPU-enabled ML containers, allowing us to scale our backend more cost-effectively.
- **Improved User Experience:** For duplicate scans, response times drop from several seconds (ML inference time + network transit) to milliseconds (Redis lookup), providing a highly responsive experience for health workers.
- **Resiliency:** By decoupling the API route from the ML container for previously analyzed images, we can still serve verification results for cached medicines even if the ML container is temporarily down or scaling up.

## Testing & Verification

- **Cache Hit Verification:** Verified that uploading the same image file consecutively triggers an `OCR Cache HIT` log and returns the response instantly.
- **Cache Miss & Set Verification:** Verified that a new image triggers an `OCR Cache SET` log and successfully populates Redis with a 24-hour TTL.
- **Resiliency Testing:** Simulated a Redis outage by stopping the local Redis service. Verified that the API gracefully fell back to calling the ML container directly without throwing 500 errors to the client.