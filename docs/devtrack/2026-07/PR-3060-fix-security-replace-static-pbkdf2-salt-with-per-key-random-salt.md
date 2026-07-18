# PR #3060 — fix(security): replace static PBKDF2 salt with per-key random salt

> **Merged:** 2026-07-04 | **Author:** @panditshubham766-dotcom | **Area:** Backend | **Impact Score:** 17 | **Closes:** #3002

## What Changed

We replaced our static, hardcoded PBKDF2 cryptographic salt with a unique, per-key random salt stored in our database. To support this, we introduced a new `key_salt` column to the `api_keys` table and updated our API key format to a structured `id.secret` format. The authentication middleware now extracts the key ID, retrieves the corresponding salt from the database, hashes the incoming secret, and performs a constant-time comparison to validate the key.

## The Problem Being Solved

Previously, our API key verification mechanism relied on a single, static salt (`"sahidawa-api-key-v1"`) hardcoded directly in our middleware. This presented several critical security vulnerabilities:

1. **Precomputation and Rainbow Table Attacks:** If our database were ever compromised, an attacker could precompute hashes for common or weak API keys using our static salt, significantly lowering the computational cost of cracking the keys.
2. **Database Lookup Information Leakage:** Because we queried the database directly using the computed hash (`.eq("key_hash", keyHash)`), we were forced to hash the incoming key before retrieving any record. This made it impossible to use unique salts per key, as we would not know which salt to use until after we found the record.
3. **Timing Attacks:** The previous implementation did not use a constant-time comparison algorithm to verify hashes, potentially allowing an attacker to reconstruct valid hashes byte-by-byte by measuring the response times of our API key verification endpoint.

## Files Modified

- `apps/api/src/middleware/apiKeyAuth.ts`
- `supabase/migrations/20260704000000_add_key_salt_to_api_keys.sql`

## Implementation Details

### 1. Database Schema Migration
We created a new migration file `supabase/migrations/20260704000000_add_key_salt_to_api_keys.sql` to add a `key_salt` column to the `public.api_keys` table:
```sql
ALTER TABLE public.api_keys
    ADD COLUMN IF NOT EXISTS key_salt TEXT;

COMMENT ON COLUMN public.api_keys.key_salt IS
    'Unique per-row cryptographic salt (hex-encoded, 32 random bytes) used to hash the raw API key secret via PBKDF2. Replaces the previous hardcoded static salt.';
```

### 2. API Key Format Restructuring
We transitioned from a monolithic API key string to a composite format: `id.secret`. 
- **`id`**: The unique identifier of the API key row in our database.
- **`secret`**: The raw, high-entropy secret token.

### 3. Middleware Authentication Flow (`apiKeyAuth.ts`)
We refactored the `requireApiKey` middleware to execute the following sequence:

1. **Parsing:** The incoming API key is split by the `.` delimiter into `keyId` and `secret`. If the key does not conform to this format, we immediately return a `401 Unauthorized` response.
2. **Database Retrieval:** We query Supabase for the record matching the extracted `keyId`. We select the `id`, `caller_name`, `scopes`, `is_active`, `key_hash`, and the newly added `key_salt`.
3. **Validation Checks:** We verify that the record exists, is active, and contains a valid `key_salt`.
4. **Asynchronous Hashing:** We hash the incoming raw `secret` using Node's asynchronous PBKDF2 implementation (`pbkdf2Async`) with the retrieved `key_salt`, 100,000 iterations, a key length of 64 bytes, and the `sha512` digest algorithm.
5. **Constant-Time Comparison:** To prevent timing attacks, we convert both the computed hash and the stored hash into Node `Buffer` objects and compare them using `crypto.timingSafeEqual()`.

```typescript
const computedBuffer = Buffer.from(computedHash, "hex");
const storedBuffer = Buffer.from(storedHash, "hex");

const isValid =
    computedBuffer.length === storedBuffer.length &&
    crypto.timingSafeEqual(computedBuffer, storedBuffer);
```

## Technical Decisions

### The `id.secret` API Key Format
We chose this format to solve the "chicken-and-egg" problem of salting. To hash a secret with a unique salt, we must first retrieve that salt from the database. By exposing the database primary key (`id`) in the API key itself, we can perform an $O(1)$ lookup to fetch the salt and the stored hash, and then perform the cryptographic verification in-memory.

### Asynchronous PBKDF2 (`pbkdf2Async`)
We retained the asynchronous version of PBKDF2. Running PBKDF2 with 100,000 iterations is computationally expensive and can block Node's single-threaded event loop for 200–500ms if run synchronously. By offloading this work to the libuv thread pool, our system remains responsive to other concurrent requests, mitigating CPU-based Denial of Service (DoS) vectors.

### Constant-Time Buffers Comparison
Standard string comparisons (`===`) in JavaScript return early as soon as a mismatch is found. This allows attackers to determine how many characters of their input match the target hash by measuring response times. Using `crypto.timingSafeEqual` ensures that the comparison takes the exact same amount of time regardless of where a mismatch occurs or if the hashes match perfectly.

## How To Re-Implement (Contributor Reference)

If you need to implement or modify this authentication flow, follow these steps:

1. **Database Setup:** Ensure your target database table has a `key_salt` column (type `TEXT` or `VARCHAR`) and a `key_hash` column.
2. **Key Generation (for new keys):**
   - Generate a cryptographically secure random salt (e.g., 32 bytes using `crypto.randomBytes(32).toString('hex')`).
   - Generate a raw secret (e.g., 32 bytes of random data).
   - Hash the raw secret using PBKDF2 with the generated salt, 100,000 iterations, 64-byte length, and `sha512`.
   - Store the salt in `key_salt` and the resulting hash in `key_hash`.
   - Return the API key to the user in the format: `[database_id].[raw_secret]`.
3. **Middleware Verification:**
   - Extract the API key from the request headers (e.g., `x-api-key` or `Authorization`).
   - Split the key by `.` to isolate the `id` and the `secret`.
   - Query the database using the `id`.
   - If found, run:
     ```typescript
     const computedHashBuffer = await pbkdf2Async(secret, storedSalt, 100000, 64, "sha512");
     ```
   - Compare the computed buffer and the stored buffer using `crypto.timingSafeEqual`. Ensure you verify that both buffers have identical lengths before calling `timingSafeEqual` to prevent runtime errors.

## Impact on System Architecture

- **Backward Compatibility Break:** Because existing API keys were hashed using the old static salt and their raw secrets were never stored, **all existing API keys are invalidated by this change**. Users and external integrations must regenerate their API keys.
- **Database Query Pattern Shift:** We transitioned from querying by a computed hash to querying by a primary key (`id`). This is highly efficient as it leverages the primary key index, reducing database lookup latency.
- **Enhanced Security Posture:** This change elevates our API security to industry-standard practices, protecting our rural health partners and medicine verification endpoints from credential harvesting and precomputation attacks.

## Testing & Verification

- **Format Validation:** Verified that requests with malformed keys (e.g., missing dots, multiple dots, or empty values) are rejected immediately with a `401 Unauthorized` status and do not trigger database queries.
- **Cryptographic Correctness:** Confirmed that keys generated with unique salts are successfully verified, while keys hashed with mismatched salts or incorrect secrets are rejected.
- **Timing Attack Mitigation:** Verified that the verification path executes constant-time comparisons using `crypto.timingSafeEqual` for all database-matched keys.