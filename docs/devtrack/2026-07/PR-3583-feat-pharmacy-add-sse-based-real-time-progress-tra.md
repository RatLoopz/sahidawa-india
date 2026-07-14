# PR #3583 — feat(pharmacy): Add SSE-based real-time progress tracking for CSV bulk upload#3580

> **Merged:** 2026-07-14 | **Author:** @hrx01-dev | **Area:** Backend | **Impact Score:** 14 | **Closes:** #3580

## What Changed

We transitioned our bulk CSV inventory upload endpoint from a blocking, single-response JSON API to a real-time Server-Sent Events (SSE) stream. We added an incremental progress callback to our PapaParse-based CSV parser that fires after each 500-row batch is successfully written to Supabase. We also implemented connection lifecycle tracking (`req.on("close")`) to prevent server crashes while ensuring background processing completes safely if a user closes their browser tab.

## The Problem Being Solved

Previously, uploading large inventory CSV files (thousands of rows) was a black-box operation. Users had to wait indefinitely for a single HTTP JSON response with no feedback on whether the upload was progressing, stalled, or failed. This led to poor user experience in rural pharmacies with unstable internet connections, often causing users to refresh the page or re-submit the file, resulting in duplicate database records. 

Additionally, if a user closed the tab mid-upload, the connection would terminate abruptly. If the server attempted to write a response back to a closed socket, Node.js would throw unhandled write errors, potentially crashing the API container.

## Files Modified

- `apps/api/src/routes/pharmacies.ts`
- `apps/api/tests/pharmacies.test.ts`
- `apps/web/app/[locale]/(dashboard)/pharmacy/inventory/bulk-upload/page.tsx`

## Implementation Details

### Backend SSE Setup & Stream Lifecycle
In `apps/api/src/routes/pharmacies.ts`, we modified the bulk upload route handler to establish an SSE connection:
```typescript
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");
res.flushHeaders();
```
We track client disconnection using a local boolean flag:
```typescript
let clientDisconnected = false;
req.on("close", () => {
    clientDisconnected = true;
});
```

### Incremental Parsing & Callbacks
We updated the `parseCsvIncremental` helper function to accept an optional `onProgress` callback:
```typescript
async function parseCsvIncremental(
    fileInput: string | NodeJS.ReadableStream,
    pharmacyId: string,
    onProgress?: (stats: {
        successfulInserts: number;
        totalRows: number;
        failedRows: number;
    }) => void
)
```
Inside the PapaParse step-by-step stream, rows are accumulated into batches of 500. When a batch is successfully inserted into Supabase via `supabase.from("pharmacy_inventory").insert(batch)`, the `onProgress` callback is triggered with the current `successfulInserts`, `totalRows` (non-empty rows), and `failedRows` counts.

To prevent unhandled promise rejections within the parser's step context, we wrapped the Supabase insert call in `Promise.resolve()`:
```typescript
Promise.resolve(supabase.from("pharmacy_inventory").insert(batch))
```

### Connection Resilience
If `clientDisconnected` is true, we bypass all `res.write` and `res.end` calls. Crucially, we do *not* abort the parsing or database insertion; the backend continues to process the CSV to ensure data integrity, but safely ignores the closed socket.

If processing completes successfully, we write a final event payload containing `{ done: true, totalRows, successCount, failedCount, errors }` and close the stream with `res.end()`.

### Frontend Stream Consumption
In `page.tsx`, we introduced a `progressStats` state:
```typescript
const [progressStats, setProgressStats] = useState<{
    processed: number;
    total: number;
    errors: number;
} | null>(null);
```
When an upload begins, we initialize this state. We read the response body stream chunk-by-chunk, parsing the SSE data payloads (prefixed with `data: `) and updating the UI with a progress bar. When the `done` flag is received, we clear the progress bar and render the final success/failure summary cards.

### Test Suite Updates
In `apps/api/tests/pharmacies.test.ts`, we refactored the assertions to parse the raw text response. We split the response text by `\n\n`, locate the line starting with `data: ` that contains `"done":true`, extract the JSON payload, and run our assertions against this parsed object:
```typescript
const lines = response.text.split("\n\n");
const doneLine = lines.find((l) => l.startsWith("data: ") && l.includes('"done":true'));
const body = doneLine ? JSON.parse(doneLine.substring(6)) : {};
```

## Technical Decisions

- **Why Server-Sent Events (SSE) over WebSockets?** SSE is a lightweight, unidirectional protocol built over standard HTTP. Since the bulk upload progress only requires server-to-client updates, WebSockets would introduce unnecessary overhead (handshakes, connection state management, and firewall issues in rural networks). SSE fits this unidirectional streaming model perfectly.
- **Why continue processing on disconnect?** If a user closes their browser or loses connection, aborting mid-upload would leave the database in a partially uploaded state. By continuing the database writes in the background, we guarantee transactional consistency and data integrity, while avoiding Node.js socket write crashes.
- **Why 500-row batching?** Batching inserts in chunks of 500 balances database write performance with real-time feedback frequency. It prevents memory exhaustion on the API container while ensuring the UI progress bar updates smoothly.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar real-time streaming endpoint for another bulk operation, follow these steps:

1. **Define the Progress Callback:** Modify your processing helper to accept an optional callback that returns progress statistics (e.g., processed count, total count, error count).
2. **Set SSE Headers:** In your Express route handler, set the headers for `text/event-stream`, disable caching, keep the connection alive, and call `res.flushHeaders()`.
3. **Handle Client Disconnects:** Declare a `clientDisconnected` boolean. Listen to the `req.on("close")` event and set the flag to `true` when triggered.
4. **Stream Events Safely:** Inside your processing loop, check the `clientDisconnected` flag before calling `res.write()`. Format your messages using the SSE standard: `data: ${JSON.stringify(payload)}\n\n`.
5. **Send the Terminal Event:** Once processing is complete, send a final payload containing `done: true` along with the final statistics, and call `res.end()`.
6. **Consume on the Frontend:** Use the Fetch API to request the endpoint. Read the response body as a stream using `response.body.getReader()`, decode the chunks, split them by `\n\n`, strip the `data: ` prefix, and update your React state.

## Impact on System Architecture

- **Reduced Server Memory Footprint:** By streaming progress and processing in chunks of 500, we avoid holding massive JSON response objects in memory before sending them to the client.
- **Improved Resilience:** The API is now immune to crashes caused by writing to closed sockets when users navigate away during long-running uploads.
- **Reusable Pattern:** This establishes a standard pattern for other long-running tasks in SahiDawa, such as medicine verification batch processing or report generation.

## Testing & Verification

We updated the integration test suite in `apps/api/tests/pharmacies.test.ts` to verify BOM stripping, robust CSV parsing, empty record handling, and validation failures. 

The tests mock the SSE stream by splitting the raw text response on double-newlines (`\n\n`) and parsing the final `done` event payload.

### Edge Cases Handled:
- **Empty or missing rows:** Returns an error event and terminates.
- **Client disconnects mid-stream:** Continues database writes, skips socket writes.
- **Malformed CSV records:** Captured as validation failures and streamed back.