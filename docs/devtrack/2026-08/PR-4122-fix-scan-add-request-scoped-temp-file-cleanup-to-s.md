# PR #4122 — fix(scan): add request-scoped temp file cleanup to /submit endpoint

> **Merged:** 2026-08-06 | **Author:** @Shreya-nipunge | **Area:** Backend | **Impact Score:** 9 | **Closes:** #4112

## What Changed

We extracted the inline temporary file cleanup logic from the `/extract` endpoint into a shared, reusable helper function `cleanupTempFiles` and integrated it into our offline scan submission endpoint (`POST /api/v1/scan/submit`). This ensures that any uploaded medicine images or voice recordings stored in `temp-uploads/` are immediately deleted once the HTTP response finishes or the client connection closes, preventing disk space leaks.

## The Problem Being Solved

Our offline scan submission endpoint (`POST /api/v1/scan/submit`) allows rural health workers to upload medicine images and voice recordings. These files are processed via `multer` and temporarily stored in `temp-uploads/`. 

Previously, unlike the `/extract` endpoint, `/submit` did not clean up these temporary files upon request completion. Instead, they remained on the server's disk until a scheduled cron job ran. In high-traffic environments or on storage-constrained edge servers, this delayed cleanup risked running out of disk space, leading to server crashes and failed uploads. We needed a reliable, request-scoped cleanup mechanism that triggers immediately after a response is sent or when a client prematurely disconnects.

## Files Modified

- `apps/api/src/routes/scan.ts`
- `apps/api/tests/scanSubmitCleanup.test.ts`

## Implementation Details

### Shared Cleanup Helper
We implemented a shared helper function `cleanupTempFiles` in `apps/api/src/routes/scan.ts`:
```typescript
function cleanupTempFiles(filePaths: string[]): () => void {
    let cleaned = false;
    return () => {
        if (cleaned) return;
        cleaned = true;
        for (const filePath of filePaths) {
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    logger.info(`Cleaned up temp file: ${filePath}`);
                } catch (err) {
                    logger.error(`Failed to delete temp file ${filePath}:`, err);
                }
            }
        }
    };
}
```
This function uses a closure-scoped `cleaned` boolean flag to guarantee idempotent execution, preventing multiple deletion attempts on the same files.

### Endpoint Integration
1. **`/api/v1/scan/extract`**: We refactored this endpoint to use the new `cleanupTempFiles` helper. We replaced the old `res.on` listeners with `res.once` to optimize event listener cleanup:
   ```typescript
   const cleanup = cleanupTempFiles(tempFilePath ? [tempFilePath] : []);
   res.once("finish", cleanup);
   res.once("close", cleanup);
   ```
2. **`/api/v1/scan/submit`**: We added identical request-scoped cleanup logic. We extract all uploaded files from `req.files` (both `image` and `voice` fields), resolve their absolute paths in `UPLOAD_DIR`, and register the cleanup callback:
   ```typescript
   const uploadedFiles: Express.Multer.File[] = [
       ...((req.files as any)?.image ?? []),
       ...((req.files as any)?.voice ?? []),
   ];
   const tempFilePaths = uploadedFiles
       .filter((f): f is Express.Multer.File => !!f?.filename)
       .map((f) => path.join(UPLOAD_DIR, path.basename(f.filename)));

   const cleanup = cleanupTempFiles(tempFilePaths);
   res.once("finish", cleanup);
   res.once("close", cleanup);
   ```

## Technical Decisions

- **Using `res.once` instead of `res.on`**: By using `res.once`, we ensure that the event listener is automatically deregistered after the first event (`finish` or `close`) fires. This prevents memory leaks from dangling listeners.
- **Idempotency Guard (`cleaned` flag)**: Because both `"finish"` (normal response completion) and `"close"` (client disconnect) events are listened to, the cleanup function could be called twice. The `cleaned` boolean acts as an idempotent guard, ensuring disk I/O operations (`fs.unlinkSync`) are executed exactly once per request.
- **Synchronous File Deletion (`fs.unlinkSync`)**: While asynchronous operations are generally preferred in Node.js, synchronous unlinking inside a request-scoped cleanup callback executed after the response has already been sent (or closed) avoids race conditions and ensures deterministic disk cleanup before the process handles subsequent heavy I/O tasks.

## How To Re-Implement (Contributor Reference)

If you need to implement request-scoped file cleanup for a new endpoint handling file uploads:

1. **Import Dependencies**: Ensure `fs`, `path`, and your logger are imported.
2. **Define the Cleanup Helper**: Use the `cleanupTempFiles` closure pattern to return an idempotent cleanup function.
3. **Collect Uploaded Files**: Immediately at the beginning of your route handler (after `multer` middleware has run), collect all file paths from `req.file` or `req.files`.
4. **Instantiate Cleanup**: Pass the absolute paths of the files to `cleanupTempFiles`.
5. **Register Listeners**: Register the returned function to both `res.once("finish", cleanup)` and `res.once("close", cleanup)`. This must be done *before* any validation or business logic runs, ensuring files are cleaned up even if the request fails validation (400) or throws an unhandled exception (500).

## Impact on System Architecture

- **Resource Management**: This change enforces a strict, request-scoped memory and storage footprint. It prevents disk exhaustion on low-cost cloud instances or local deployments in rural clinics.
- **Unified Patterns**: We have unified file cleanup patterns across different endpoints, reducing code duplication and technical debt.

## Testing & Verification

We added a comprehensive integration test suite in `apps/api/tests/scanSubmitCleanup.test.ts` using `supertest` and `jest`. The tests mock Redis, BullMQ, and Supabase to isolate the file system behavior.

We verified the following scenarios using `jest.spyOn(fs, "unlinkSync")`:
- **Successful Submission (200 OK)**: Verifies that both image and voice files are successfully unlinked after a completed request.
- **Validation Failure (400 Bad Request)**: Verifies that files are cleaned up even if validation fails (e.g., missing `clientUpdatedAt`).
- **Processing Exception (500 Internal Server Error)**: Verifies that files are cleaned up if the database or downstream services throw an error.
- **Image-only / Voice-only Uploads**: Verifies that the cleanup helper handles partial uploads gracefully without throwing errors.