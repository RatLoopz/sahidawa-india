# PR #3297 — feat: Implemented idempotent alert queue for CDSCO alert agent#3111

> **Merged:** 2026-07-07 | **Author:** @hrx01-dev | **Area:** ML/AI | **Impact Score:** 8 | **Closes:** #3111

## What Changed

We introduced a local, SQLite-backed persistent queue to the CDSCO alert agent to handle drug alert ingestion idempotently. Instead of immediately sending extracted alerts to our remote API, the agent now hashes each alert's metadata to generate a unique SHA-256 key, queues it locally in a `pending` state, and processes the queue with built-in retry logic and remote deduplication. This ensures that network failures, API downtime, or agent crashes do not result in lost alerts or duplicate records.

## The Problem Being Solved

Before this PR, the CDSCO alert agent processed PDFs and immediately attempted to push the extracted alerts to the remote API via `ingest_alerts()`. If our main API was down, or if the agent encountered a network timeout mid-run, any alerts extracted during that run were lost. 

Furthermore, the previous deduplication logic (`deduplicate_alerts`) was run in-memory during the scraping process. If the agent crashed halfway through a large PDF batch, restarting it would cause it to re-parse the same PDFs and attempt to re-ingest the same alerts, leading to duplicate entries in our main database or unnecessary API load. We needed a reliable, offline-first queuing mechanism that guarantees at-least-once delivery with strict idempotency.

## Files Modified

- `apps/ml/agent/cdsco_alert_agent.py`

## Implementation Details

### 1. Local SQLite Queue Schema
We added a local SQLite database named `alert_queue.db` located in the same directory as the agent script (`QUEUE_DB_PATH`). The database is initialized via `init_db()` with the following schema:

```sql
CREATE TABLE IF NOT EXISTS pending_alerts (
    idempotency_key TEXT PRIMARY KEY,
    pdf_url TEXT,
    alert_data TEXT,
    status TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### 2. Idempotency Key Generation
To uniquely identify an alert before it is ever sent over the network, we implemented `generate_idempotency_key()`. It concatenates the source PDF URL and the drug's extracted `batch_number` (defaulting to `'unknown'` if missing) and hashes the string using SHA-256:

$$\text{key} = \text{SHA256}(\text{pdf\_url} + \text{"\_"} + \text{batch\_number})$$

### 3. Enqueuing and Processing Flow
The agent's execution flow has been restructured into a robust, fault-tolerant cycle:

```
[Startup] -> init_db() -> process_pending_queue()
                                 |
                                 v
[Scrape PDFs] -> Extract Alerts -> enqueue_alerts() (INSERT OR IGNORE)
                                 |
                                 v
[Post-Scrape] -> process_pending_queue() -> Deduplicate -> Ingest -> Mark 'processed'
```

- **`enqueue_alerts(pdf_url, alerts)`**: Serializes the alert dictionary to JSON and writes it to the local SQLite database using `INSERT OR IGNORE`. If an alert with the same idempotency key already exists (even from a previous interrupted run), the write is safely ignored.
- **`process_pending_queue()`**: 
  1. Queries all rows from `pending_alerts` where `status = 'pending'`.
  2. Maps these rows into a dictionary of `{idempotency_key: alert_data}`.
  3. Calls `deduplicate_alerts_with_keys()` to check which alerts already exist on the remote server.
  4. Updates the status of any already-ingested alerts to `'processed'` in bulk.
  5. Attempts to ingest the remaining new alerts via `ingest_alerts()`.
  6. If `ingest_alerts()` succeeds, it marks those keys as `'processed'`. If it fails (returns `False`), the alerts remain `'pending'` to be retried on the next run.

### 4. Remote Deduplication
We replaced `deduplicate_alerts` with `deduplicate_alerts_with_keys(pending_alerts_map)`. This function queries the remote `ALERTS_API_URL` using the specific `batch_number` of each pending alert. If the remote API returns an existing record, the alert's key is added to `skipped_keys` so it can be marked as `'processed'` locally without triggering another ingestion request.

## Technical Decisions

- **SQLite for Local State**: We chose SQLite because it is a zero-configuration, file-based database engine bundled with the Python standard library. This avoids adding external service dependencies (like Redis or PostgreSQL) to our lightweight ML/AI agent environment.
- **SHA-256 Idempotency Keys**: Combining the source `pdf_url` and the drug's `batch_number` provides a highly collision-resistant identifier. This ensures that if the same batch number appears in two different monthly PDF reports, they are treated as distinct alerts, while safeguarding against duplicate processing of the same PDF.
- **Two-Phase Queue Processing**: Running `process_pending_queue()` both at startup (before scraping) and at shutdown (after scraping) ensures that any backlogged alerts from previous failed runs are cleared immediately when the agent wakes up, while new alerts are processed as soon as scraping finishes.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or extend this idempotent queuing pattern in another SahiDawa agent, follow these steps:

1. **Initialize the Database**:
   Define a local path for your SQLite database using `os.path.join(os.path.dirname(__file__), 'your_queue.db')`. Create a setup function to run `CREATE TABLE IF NOT EXISTS` with a `PRIMARY KEY` constraint on your deduplication key.

2. **Generate a Deterministic Key**:
   Use Python's `hashlib.sha256` to hash the unique natural keys of your data payload (e.g., source URL, batch number, date).
   ```python
   raw_str = f"{source_url}_{unique_identifier}"
   idempotency_key = hashlib.sha256(raw_str.encode('utf-8')).hexdigest()
   ```

3. **Write with Conflict Resolution**:
   Use `INSERT OR IGNORE` to write records to the database. This prevents database constraint errors when encountering duplicate scraped items.

4. **Implement Safe Status Transitions**:
   Ensure that status updates to `'processed'` only occur *after* receiving a successful HTTP response (e.g., `2xx` status code) from the ingestion API. Wrap your network calls in `try-except` blocks to catch connection errors and return `False` to keep the queue items in a `'pending'` state.

5. **Deduplicate Against Remote State**:
   Before sending payloads over the network, query the remote API by your unique identifier. If the remote system already has the record, mark your local queue item as `'processed'` immediately to avoid redundant API traffic.

## Impact on System Architecture

- **Resilience**: The ML/AI ingestion pipeline is now resilient to network partitions and API downtime. The agent can run completely offline, scraping and queuing alerts locally, and sync them to the main SahiDawa platform once connectivity is restored.
- **API Load Reduction**: By performing targeted remote batch checks and maintaining a local state of processed alerts, we significantly reduce the number of redundant write requests hitting our main API.
- **Decoupling**: Scraping and ingestion are now decoupled. The scraping phase only cares about parsing PDFs and writing to the local SQLite queue, while the ingestion phase focuses entirely on syncing the queue with the remote API.

## Testing & Verification

- **Idempotency Verification**: Verified that running the agent multiple times on the same PDF does not insert duplicate records into `alert_queue.db` due to the `PRIMARY KEY` constraint and `INSERT OR IGNORE` logic.
- **Failure Recovery**: Simulated API downtime by temporarily pointing `INGEST_API_URL` to an invalid port. Verified that:
  1. Alerts were successfully written to `alert_queue.db` with status `'pending'`.
  2. The agent logged the ingestion failure but did not crash.
  3. Upon restoring the correct API URL and running the agent again, `process_pending_queue()` successfully picked up the pending alerts, ingested them, and updated their status to `'processed'`.
- **Deduplication**: Verified that alerts with batch numbers already present in the remote database were correctly identified by `deduplicate_alerts_with_keys` and marked as `'processed'` locally without being re-sent to the ingest endpoint.