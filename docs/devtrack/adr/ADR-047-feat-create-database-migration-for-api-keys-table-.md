# ADR — Feat : Create database migration for api_keys table#3099

> **Date:** 2026-07-06 | **PR:** #3099 | **Status:** Accepted

## Context

The SahiDawa platform required a secure, scalable, and user-bound mechanism to authenticate external API requests. The previous implementation relied on a loose, non-user-bound `caller_name` identifier and a simple boolean `is_active` flag. This model lacked strong cryptographic salting, fine-grained user association, and automatic expiration. To support multi-tenant, user-specific API access securely, the system needed to transition to a per-user API key model with PBKDF2 hashing, salt storage, Row Level Security (RLS) in Supabase, and time-based expiration.

## Decision

We refactored the API key storage and authentication architecture by implementing the following changes:

1. **Database Schema Overhaul**: Dropped the legacy API key structure and created a new `public.api_keys` table linked directly to Supabase's `auth.users` table via a foreign key with cascade delete.
2. **Cryptographic Security**: Added `key_hash` and `key_salt` columns to support PBKDF2 hashing in the Express backend, ensuring API keys are never stored in plaintext.
3. **Row Level Security (RLS)**: Enabled RLS on the `api_keys` table, restricting key management operations (SELECT, INSERT, UPDATE, DELETE) to the authenticated owner (`auth.uid() = user_id`).
4. **Middleware Refactoring**: Updated the `apiKeyAuth.ts` middleware to validate keys using `user_id` instead of `caller_name`, and enforced expiration checks via `expires_at` instead of a boolean `is_active` flag.
5. **Performance Optimization**: Created a database index on `user_id` (`idx_api_keys_user_id`) to optimize lookup times during authentication.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Stateless JWT-based API Keys** | While stateless, JWTs cannot be easily revoked before their expiration time without maintaining a distributed blacklist. Database-backed hashed API keys allow instant revocation and better management. |
| **Plaintext or Unsalted SHA-256 Hashing** | Storing keys in plaintext poses an unacceptable security risk in the event of a database compromise. Unsalted hashing is vulnerable to rainbow table and precomputation attacks. |

## Consequences

**Positive:**
- **Enhanced Security**: API keys are cryptographically secured using PBKDF2 with unique salts, protecting them against database leaks and brute-force attacks.
- **Strict Data Isolation**: Row Level Security ensures users can only view and manage their own API keys.
- **Automated Lifecycle**: The transition to `expires_at` enables automatic key expiration without requiring manual cron jobs to toggle active flags.

**Trade-offs:**
- **Authentication Latency**: Verifying PBKDF2 hashes on every API request introduces a minor computational overhead on the Express backend compared to simpler hashing algorithms.
- **Database Dependency**: Every API request requires a database lookup to fetch the hash and salt, though this is mitigated by the index on `user_id`.

## Related Issues & PRs

- PR #3099: Feat : Create database migration for api_keys table#3099
- Issue #3099