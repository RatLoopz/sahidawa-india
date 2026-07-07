# PR #3261 — Ref : Moved Gzipped JSON Map to Static Asset File#3080

> **Merged:** 2026-07-07 | **Author:** @hrx01-dev | **Area:** Backend | **Impact Score:** 9 | **Closes:** #3080

## What Changed

This PR refactors how our offline fallback brand-to-generic medicine mapping is stored and loaded in the backend. We removed the hardcoded Base64-encoded, gzipped JSON string (`GZIPPED_BRAND_MAP_B64`) from the `apps/api/src/routes/interactions.ts` route file and moved it to a dedicated static asset file at `apps/api/assets/brandMap.json.gz`. Additionally, we transitioned the loading mechanism from synchronous, blocking in-memory decoding to an asynchronous, non-blocking file read with eager background initialization during server startup.

## The Problem Being Solved

Previously, the brand-to-generic mapping was hardcoded as a massive Base64 string (`GZIPPED_BRAND_MAP_B64`) directly inside `apps/api/src/routes/interactions.ts`. This polluted the codebase, inflated the bundle size of the route handler, and made updating the mapping difficult. 

Furthermore, the synchronous decompression (`zlib.gunzipSync`) and parsing occurred on-demand during the first request that required offline fallback. This blocked the Node.js event loop and introduced latency spikes for the initial user query. As SahiDawa is designed to support rural health environments with intermittent connectivity, our offline fallback paths must be highly optimized and free of unnecessary cold-start delays.

## Files Modified

- `apps/api/assets/brandMap.json.gz`
- `apps/api/src/routes/interactions.ts`

## Implementation Details

### 1. Static Asset Extraction
We decoded the hardcoded Base64 string into its raw binary format and saved it as a compressed Gzip file at `apps/api/assets/brandMap.json.gz`.

### 2. Asynchronous and Lazy Loading
In `apps/api/src/routes/interactions.ts`, we replaced the synchronous `lazyBrandMap` cache with a promise-based cache:

```typescript
let lazyBrandMapPromise: Promise<Record<string, string>> | null = null;
```

We refactored `getLocalBrandMap()` to return a `Promise<Record<string, string>>`. If `lazyBrandMapPromise` is not yet initialized, it kicks off an asynchronous IIFE:

- It resolves the absolute path to the asset using `path.join(__dirname, "../../assets/brandMap.json.gz")`.
- It reads the file asynchronously using `fs.readFile` from the `fs/promises` module.
- It decompresses the resulting buffer using Node's native `zlib.gunzipSync` and parses the UTF-8 string into a JSON object.
- If the file read or decompression fails, it logs the error via our system logger and gracefully falls back to an empty object `{}` to prevent route crashes.

```typescript
function getLocalBrandMap(): Promise<Record<string, string>> {
    if (!lazyBrandMapPromise) {
        lazyBrandMapPromise = (async () => {
            try {
                const filePath = path.join(__dirname, "../../assets/brandMap.json.gz");
                const buffer = await fs.readFile(filePath);
                const decompressed = zlib.gunzipSync(buffer).toString("utf-8");
                return JSON.parse(decompressed);
            } catch (err) {
                logger.error("Failed to load local brand map", err);
                return {};
            }
        })();
    }
    return lazyBrandMapPromise;
}
```

### 3. Eager Background Initialization
To eliminate cold-start latency on the first API request, we added a module-level call:

```typescript
void getLocalBrandMap();
```

This triggers the file read and decompression in the background immediately when the route module is imported during server startup.

### 4. Downstream Async Propagation
Because `getLocalBrandMap()` is now asynchronous, we updated all dependent functions to return promises and await the resolved map:
- `getLocalInteractionsForGenerics(genericNames: string[])` was updated to be `async` and await `getLocalBrandMap()`.
- `loadInteractionsForGenerics(genericNames: string[])` was updated to await the asynchronous `getLocalInteractionsForGenerics` call.
- `resolveMedicinesToGenerics(...)` was updated to await `getLocalBrandMap()` inside its offline fallback block.

## Technical Decisions

- **Promise Caching over Value Caching:** By caching the promise (`lazyBrandMapPromise`) instead of the resolved object, we prevent race conditions. If multiple requests arrive concurrently while the file is still being read from disk, they will all await the same single promise rather than triggering duplicate disk I/O operations.
- **Asynchronous File I/O with Synchronous Decompression:** We used `fs.promises.readFile` to avoid blocking the event loop during disk I/O. While `zlib.gunzipSync` is synchronous, the payload is small enough that CPU-bound decompression of the buffer in memory is negligible once the I/O is resolved.
- **Eager Module-Level Execution:** Calling `void getLocalBrandMap();` at the module level starts the disk I/O immediately when the route file is imported during server bootstrap, effectively eliminating cold-start latency for the first API request.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or modify this static asset loading pattern in another route:

1. **Store the Asset:** Place your compressed data (e.g., `.gz` format) inside the `apps/api/assets/` directory.
2. **Import File System Utilities:** Use `import { promises as fs } from "fs";` and `import path from "path";` to handle platform-agnostic path resolution and non-blocking I/O.
3. **Define a Promise Cache:** Create a module-scoped variable to hold the promise of your parsed data:
   ```typescript
   let lazyDataPromise: Promise<YourDataType> | null = null;
   ```
4. **Implement the Loader:** Write a loader function that checks if the promise exists. If not, initialize it with an async block that reads, decompresses, and parses the asset. Always include a `try-catch` block that logs errors and returns a safe fallback value (like `{}` or `[]`).
5. **Trigger Eager Loading:** Call the loader function at the module level using the `void` operator to start loading during server boot.
6. **Await the Data:** Ensure any route handlers or helper functions that consume this data are marked `async` and use `await getLoaderFunction()` to retrieve the parsed asset.

## Impact on System Architecture

- **Separation of Concerns:** Route files are now strictly responsible for request handling and business logic, while static data is isolated in the `assets/` directory.
- **Bundle Optimization:** Removing the hardcoded Base64 string reduces the source code footprint of our route handlers, making the codebase easier to maintain and audit.
- **Performance:** Offloading disk I/O to the background during server startup ensures that our offline fallback paths respond instantly when database connections fail or when the system is configured to run in offline mode (`dbConfig.isSupabaseOffline`).

## Testing & Verification

Not documented in this PR