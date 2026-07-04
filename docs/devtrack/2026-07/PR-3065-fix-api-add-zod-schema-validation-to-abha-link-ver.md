# PR #3065 — fix(api): add Zod schema validation to ABHA link/verify-otp/upload-verification routes

> **Merged:** 2026-07-04 | **Author:** @aayushiii18 | **Area:** Backend | **Impact Score:** 9 | **Closes:** #3050

## What Changed

We introduced strict runtime validation using Zod schemas for the ABHA (Ayushman Bharat Health Account) integration routes: `/link`, `/verify-otp`, and `/upload-verification`. By replacing loose manual truthiness checks with Zod's `safeParse()`, we ensure that incoming payloads are validated for correct types, lengths, and formats before they reach our database or downstream services.

## The Problem Being Solved

Previously, our ABHA endpoints only checked for the presence of fields (e.g., `if (!abhaAddress)`). This allowed malformed data (such as numbers, arrays, or objects) to pass through. For instance, a non-numeric OTP or a non-date string like `"banana"` for `scannedAt` would be accepted. 

This unvalidated data was either written directly to the `abha_records` table in Supabase or sent to the Ayushman Bharat Digital Mission (ABDM) sandbox. Because the ABDM service RSA-encrypts payloads, malformed inputs resulted in cryptic downstream errors rather than clean, immediate HTTP 400 Bad Request responses.

## Files Modified

- `apps/api/src/routes/abha.ts`
- `apps/api/tests/abha.routes.test.ts`

## Implementation Details

### Schemas Defined
We defined three Zod schemas near the top of `apps/api/src/routes/abha.ts`:
- **`linkSchema`**: Validates `abhaAddress` as a trimmed string between 1 and 256 characters.
- **`verifyOtpSchema`**: Validates `txnId` as a trimmed non-empty string, and `otp` as a string matching the regex `/^\d{4,8}$/` (4 to 8 digits).
- **`uploadVerificationSchema`**: Validates `medicineId` and `verificationResult` as trimmed non-empty strings, and `scannedAt` as a valid ISO 8601 datetime string using `z.string().datetime()`.

### Route Integration
In each route handler, we replaced manual checks with `schema.safeParse(req.body)`:
- **`POST /link`**: Parses the body with `linkSchema`. If validation fails, it returns a `400` with the validation issues. If it succeeds, it passes `parsed.data.abhaAddress` to `generateOTP()`.
- **`POST /verify-otp`**: Parses the body with `verifyOtpSchema`. If validation fails, it returns a `400`. If it succeeds, it passes `parsed.data.txnId` and `parsed.data.otp` to `verifyOTP()`.
- **`POST /upload-verification`**: Parses the body with `uploadVerificationSchema`. If validation fails, it returns a `400`. If it succeeds, it passes `parsed.data` directly to `uploadVerification()`.

## Technical Decisions

- **Why Zod**: We chose Zod to maintain consistency with the validation patterns used across other API routes (such as `registerPharmacySchema` and `eligibilitySchema`).
- **No strict regex for ABHA Address**: We deliberately avoided imposing a strict regex (like `name@abdm`) on `abhaAddress`. The ABDM sandbox already validates formats and returns specific error messages. Hardcoding a regex in our API risks rejecting valid formats if ABDM updates its address specifications.
- **OTP Length Constraints**: We constrained the OTP to a 4-8 digit numeric string. This covers standard OTP conventions used by ABDM and prevents arbitrary-length strings from hitting the downstream service.
- **Datetime Validation**: We upgraded `scannedAt` to `z.string().datetime()` to guarantee that only valid ISO timestamps are written to the database, preventing corrupt records in `abha_records`.

## How To Re-Implement (Contributor Reference)

If you need to implement similar validation on other routes, follow these steps:

1. **Import Zod**:
   ```typescript
   import { z } from "zod";
   ```

2. **Define the Schema**:
   Define your schema at the top of the route file. Ensure you use `.trim()`, `.min(1)`, and specific format validators like `.datetime()` where applicable:
   ```typescript
   const myRouteSchema = z.object({
       someId: z.string().trim().min(1),
       timestamp: z.string().datetime(),
   });
   ```

3. **Parse and Validate**:
   Inside the route handler, call `safeParse` on the request body:
   ```typescript
   const parsed = myRouteSchema.safeParse(req.body);
   if (!parsed.success) {
       res.status(400).json({
           error: "Invalid payload",
           issues: parsed.error.issues,
       });
       return;
   }
   ```

4. **Use Validated Data**:
   Always use `parsed.data` instead of `req.body` to ensure you are working with the validated and typed object.

## Impact on System Architecture

- **Fail-Fast Boundary**: Invalid payloads are rejected at the HTTP boundary, saving processing power, database writes, and external API calls.
- **Data Integrity**: Ensures that the `abha_records` table remains clean and consistent.
- **Security Hardening**: Mitigates potential injection or malformed payload attacks on sensitive digital health ID endpoints.

## Testing & Verification

We created a comprehensive test suite in `apps/api/tests/abha.routes.test.ts`.

- **Mocking**: We mocked Supabase client calls, authentication middleware (`requireAuth`), and the `abha.service.ts` methods.
- **Edge Cases Tested**:
  - Missing or non-string `abhaAddress` (returns `400`).
  - Malformed OTP (non-numeric or incorrect length) (returns `400`).
  - Missing `txnId` (returns `400`).
  - Invalid `scannedAt` date string (e.g., `"banana"`) (returns `400`).
  - Valid payloads for all three routes (returns `200`).

All 14 tests (6 pre-existing in `abha.service.test.ts` and 8 new in `abha.routes.test.ts`) passed successfully.