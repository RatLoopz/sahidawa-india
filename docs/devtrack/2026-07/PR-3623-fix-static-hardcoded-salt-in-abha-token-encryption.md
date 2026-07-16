# PR #3623 — fix: Static Hardcoded Salt in ABHA Token Encryption Weakens Protectionof Sensitive Health Data

> **Merged:** 2026-07-16 | **Author:** @Kirtan-pc | **Area:** Backend | **Impact Score:** 9 | **Closes:** #3619

## What Changed

This PR resolves a critical security vulnerability in our Ayushman Bharat Health Account (ABHA) token storage mechanism by introducing dynamic, per-record cryptographic salts. We eliminated a hardcoded static salt string and replaced it with a unique, randomly generated 16-byte salt for every encryption operation. Additionally, we refactored the codebase to consolidate duplicate encryption logic into a single, reusable helper function and updated our database schema to persist the unique salts.

## The Problem Being Solved

Previously, our system used a static, hardcoded string literal (`"salt"`) as the salt parameter for the `crypto.scryptSync` key derivation function when encrypting ABHA tokens. Using a static salt meant that if our primary encryption secret (`ABDM_SANDBOX_CLIENT_SECRET`) were ever leaked or compromised, an attacker could decrypt every single ABHA token in our database simultaneously. Because the salt and key derivation parameters were identical across all records, the encryption lacked cryptographic uniqueness per row. This weakened our protection of sensitive rural health data and violated standard security compliance guidelines for integrating with the Ayushman Bharat Digital Mission (ABDM) sandbox.

## Files Modified

- `apps/api/src/services/abha.service.ts`
- `supabase/migrations/20260714000000_add_encryption_salt_to_abha_links.sql`

## Implementation Details

### 1. Database Schema Update
We created a new SQL migration file (`supabase/migrations/20260714000000_add_encryption_salt_to_abha_links.sql`) to alter the `abha_links` table:
```sql
ALTER TABLE abha_links
    ADD COLUMN encryption_salt TEXT NOT NULL DEFAULT 'migrated';

COMMENT ON COLUMN abha_links.encryption_salt IS 'Per-record random salt used in scrypt key derivation for AES-256-CBC token encryption. Each link gets a unique salt.';
```
The default value of `'migrated'` ensures that existing records do not break during the migration and can be identified for subsequent rotation or backward-compatible decryption.

### 2. Consolidated Encryption Helper
In `apps/api/src/services/abha.service.ts`, we extracted the duplicate encryption routines into a centralized `encryptToken` helper function:
```typescript
function encryptToken(token: string): { encryptedToken: string; iv: string; salt: string } {
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(getRequiredEnv("ABDM_SANDBOX_CLIENT_SECRET"), salt, 32);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encryptedToken = cipher.update(token, "utf8", "hex");
    encryptedToken += cipher.final("hex");
    return { encryptedToken, iv: iv.toString("hex"), salt: salt.toString("hex") };
}
```
This function utilizes Node.js's native `crypto.randomBytes(16)` to generate cryptographically secure pseudo-random initialization vectors (IVs) and salts on every call.

### 3. Flow Integration
We updated both token-generation entry points to utilize the new helper and persist the salt:
- **OTP Verification Flow (`verifyOTP`)**: Replaced the inline encryption block with a call to `encryptToken(token)` and mapped the returned `salt` to the `encryption_salt` column in the Supabase upsert payload.
- **PKCE / OAuth Code Exchange Flow (`exchangeAuthCode`)**: Replaced the duplicate inline encryption block with `encryptToken(token)` and updated the database upsert payload to store the unique `encryption_salt`.

## Technical Decisions

- **Node.js Native `crypto` Module**: We chose to stick with the native `crypto` module to avoid introducing external dependencies, ensuring high performance and relying on battle-tested cryptographic primitives.
- **AES-256-CBC with `scryptSync`**: We retained the AES-256-CBC cipher and `scrypt` key derivation function to maintain structural consistency with our existing decryption pipelines while significantly hardening them with dynamic salts.
- **Database Default Value**: Setting the default value of the new column to `'migrated'` prevents migration failures on production databases containing legacy records, allowing us to handle legacy decryption gracefully (by falling back to the static `"salt"` if the database value is `'migrated'`).

## How To Re-Implement (Contributor Reference)

If you need to implement a similar encryption standard for another sensitive data table in our system, follow these steps:

1. **Create a Migration**: Add both `encryption_iv` and `encryption_salt` columns as `TEXT` to your target table.
2. **Generate Random Parameters**: Use `crypto.randomBytes(16)` to generate unique IVs and salts for every write operation. Do not reuse them across records.
3. **Derive the Key**: Use `crypto.scryptSync(secret, salt, 32)` to derive a unique key for each record.
4. **Encrypt**: Use `crypto.createCipheriv("aes-256-cbc", key, iv)` to encrypt the sensitive payload.
5. **Store**: Persist the hex-encoded ciphertext, the hex-encoded IV, and the hex-encoded salt in the database.
6. **Decrypt (Reverse Flow)**: To decrypt, retrieve the salt and IV from the database, run `crypto.scryptSync` with the retrieved salt to reconstruct the key, and initialize `crypto.createDecipheriv` with that key and IV.

## Impact on System Architecture

This change significantly hardens our backend security posture. By ensuring that every ABHA token is encrypted with a unique key derived from a unique salt, we prevent bulk decryption attacks. Even if one record's salt and IV are exposed, other records remain secure. This aligns SahiDawa with modern cryptographic standards required for handling sensitive Indian digital health data (ABDM).

## Testing & Verification

Not documented in this PR