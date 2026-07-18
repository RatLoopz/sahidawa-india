# PR #3318 — Ref : Migrated CDSCO Alert Agent Idempotency Queue to Redis/Postgres#3306

> **Merged:** 2026-07-07 | **Author:** @hrx01-dev | **Area:** ML/AI | **Impact Score:** 8 | **Closes:** #3306

## What Changed

We migrated the CDSCO (Central Drugs Standard Control Organisation) Alert Agent's idempotency and pending queue from a local SQLite database to a centralized Redis instance. This refactor completely removes the `sqlite3` dependency, local database file creation (`alert_queue.db`), and local state tracking. The agent now utilizes a Redis Hash (`cdsco_pending_alerts`) to store, deduplicate, and track pending drug alerts before ingesting them into our core system.

## The Problem Being Solved

Previously, the CDSCO Alert Agent relied on a local SQLite database file (`alert_queue.db`) to track pending alerts and enforce idempotency. This local file-based state management was highly problematic for our cloud-native deployment:
1. **Ephemeral Storage:** In containerized environments (such as Kubernetes pods or serverless runners), local disk storage is ephemeral. Restarting a container would wipe out the SQLite file, causing the agent to lose track of processed alerts and potentially ingest duplicate drug alerts.
2. **Horizontal Scaling Limitations:** A local SQLite file prevented us from running multiple instances of the agent in parallel, as they could not share state or coordinate deduplication.
3. **Deployment Complexity:** Maintaining local write access and persistent volume claims (PVCs) for a lightweight scraping agent added unnecessary infrastructure overhead.

## Files Modified

- `apps/ml/agent/cdsco_alert_agent.py`

## Implementation Details

### 1. Redis Client Initialization
We replaced the local SQLite connection logic with a Redis client initialized via the `redis` Python package. The client connects using the `REDIS_URL` environment variable (defaulting to `redis://localhost:6379/0` for local development) and is configured to decode responses automatically:
```python
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
PENDING_ALERTS_KEY = "cdsco_pending_alerts"
```

### 2. Idempotency Key Generation
The idempotency key generation logic remains intact to ensure backward compatibility. It computes a SHA-256 hash of the PDF URL and the alert's batch number:
```python
def generate_idempotency_key(pdf_url: str, alert: dict) -> str:
    batch_number = alert.get('batch_number', 'unknown')
    raw_str = f"{pdf_url}|{batch_number}"
    return hashlib.sha256(raw_str.encode('utf-8')).hexdigest()
```

### 3. Enqueuing Alerts
Instead of executing an `INSERT OR IGNORE` SQL statement, `enqueue_alerts` now constructs a dictionary mapping idempotency keys to JSON-serialized alert payloads. It writes these to the Redis Hash using `hset`:
```python
def enqueue_alerts(pdf_url: str, alerts: list):
    mapping = {}
    for alert in alerts:
        key = generate_idempotency_key(pdf_url, alert)
        mapping[key] = json.dumps(alert)
    if mapping:
        redis_client.hset(PENDING_ALERTS_KEY, mapping=mapping)
```

### 4. Queue Processing and Deduplication
In `process_pending_queue`, we fetch all pending alerts from the Redis Hash using `hgetall`. 
- **Deduplication:** We pass the pending alerts to `deduplicate_alerts_with_keys()`.
- **Handling Duplicates:** Any alerts identified as duplicates (returned in `skipped_keys`) are immediately removed from the Redis Hash using `hdel`.
- **Ingestion Success:** If the ingestion API call succeeds, the successfully ingested keys are removed from the Redis Hash using `hdel`.
- **Ingestion Failure:** If the ingestion API call fails, the keys are left in the Redis Hash, ensuring they will be retried during the next execution run.

## Technical Decisions

- **Redis Hash (`HSET` / `HGETALL` / `HDEL`) over Lists or Sets:** We chose a Redis Hash because it allows us to store key-value pairs (idempotency key to JSON payload) and perform $O(1)$ lookups, insertions, and deletions. This maps perfectly to the previous SQLite table structure where the idempotency key served as the primary key.
- **Stateless Agent Architecture:** Removing SQLite makes the ML agent completely stateless. This aligns with modern 12-factor app principles, making deployments, scaling, and disaster recovery seamless.
- **Postgres/Redis Naming:** While the issue and PR title mention "Redis/Postgres", we opted for Redis for the active idempotency queue to guarantee high-throughput, low-latency operations, keeping the agent's footprint minimal.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or extend this queue mechanism in another agent:

1. **Dependencies:** Ensure the `redis` Python library is installed and configured in the environment.
2. **Connection Setup:** Always use `decode_responses=True` when initializing `redis.Redis.from_url` to avoid dealing with raw bytes in your application logic.
3. **Writing to the Queue:**
   - Generate a unique, deterministic hash for your payload (e.g., SHA-256 of natural keys).
   - Serialize the payload to a JSON string.
   - Use `redis_client.hset(hash_name, mapping={key: serialized_payload})` to upsert.
4. **Reading and Processing:**
   - Retrieve all items using `redis_client.hgetall(hash_name)`.
   - Parse the JSON strings back into Python dictionaries.
5. **Clearing State:**
   - Once processed or discarded, remove keys from the hash using `redis_client.hdel(hash_name, *keys)`. Do not leave processed keys in the hash indefinitely to prevent memory leaks in Redis.

## Impact on System Architecture

- **Stateless ML Pipelines:** The CDSCO Alert Agent can now be run as an ephemeral cron job or serverless function (e.g., AWS Lambda, Google Cloud Run) without requiring persistent storage volumes.
- **Horizontal Scalability:** Multiple instances of the scraping agent can now run concurrently. Since they share the same Redis instance, they will coordinate seamlessly through the shared `cdsco_pending_alerts` hash, preventing duplicate processing of the same PDF alerts.
- **Improved Reliability:** If an agent container crashes mid-processing, the pending alerts remain safely stored in Redis and will be picked up by the next container spin-up.

## Testing & Verification

- **Local Integration Testing:** Verified that the agent successfully connects to a local Redis instance (`redis://localhost:6379/0`) when `REDIS_URL` is not provided.
- **Idempotency Verification:** Tested that duplicate alerts (same PDF URL and batch number) generate the same key and are correctly deduplicated, resulting in their removal from the Redis hash without triggering duplicate API calls to the ingestion endpoint.
- **Error Handling:** Verified that if the ingestion API is down, the alerts remain safely stored in the Redis Hash and are not deleted, ensuring zero data loss.