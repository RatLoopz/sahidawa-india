# PR #3053 — refactor: unify bulk upload constants

> **Merged:** 2026-07-06 | **Author:** @sureshsuriya | **Area:** Backend | **Impact Score:** 26 | **Closes:** #2700

## What Changed

We unified and centralized our bulk upload configuration constants by introducing `MAX_BULK_UPLOAD_FILE_SIZE_BYTES` (set to 1MB) in our shared package (`@sahidawa/shared`). We integrated this constant into our backend API's Multer middleware configuration to enforce file size limits at the network boundary. Additionally, we updated our frontend bulk-upload page to validate file sizes on both drag-and-drop and file-picker interactions before initiating network requests.

## The Problem Being Solved

Previously, bulk upload limits (specifically file size limits) were either hardcoded, inconsistent, or completely unvalidated on the client side. This presented several issues:
1. **Bandwidth Waste:** Without client-side validation, users could attempt to upload massive CSV files, only to have them rejected by the server after wasting valuable bandwidth—a critical issue for rural pharmacies operating on metered or slow internet connections.
2. **Validation Drift:** Without a centralized constant, changes to upload limits required modifying multiple files across the frontend and backend, increasing the risk of drift (e.g., the frontend allowing a 5MB file but the backend rejecting anything over 1MB).
3. **Security Vulnerabilities:** Lacking a strict file-size limit on our backend upload middleware left our server vulnerable to memory exhaustion or Denial of Service (DoS) attacks via oversized payloads.

## Files Modified

- `apps/api/src/routes/pharmacies.ts`
- `apps/web/app/[locale]/(dashboard)/pharmacy/inventory/bulk-upload/page.tsx`
- `packages/shared/src/limits.ts`

## Implementation Details

### 1. Shared Constants Definition
In `packages/shared/src/limits.ts`, we defined and exported the maximum file size limit in bytes:
```typescript
/** Max file size (in bytes) for bulk upload files. */
export const MAX_BULK_UPLOAD_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
```
This sits alongside our existing `MAX_BULK_UPLOAD_ITEMS` constant (set to 500 rows).

### 2. Backend Middleware Enforcement
In `apps/api/src/routes/pharmacies.ts`, we imported `MAX_BULK_UPLOAD_FILE_SIZE_BYTES` from `@sahidawa/shared`. We updated our `multer` configuration to enforce this limit at the middleware layer:
```typescript
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BULK_UPLOAD_FILE_SIZE_BYTES },
});
```
This ensures that any incoming multipart/form-data request exceeding 1MB is automatically intercepted and rejected by Multer before it reaches our route handlers.

### 3. Frontend Validation
In `apps/web/app/[locale]/(dashboard)/pharmacy/inventory/bulk-upload/page.tsx`, we imported `MAX_BULK_UPLOAD_FILE_SIZE_BYTES` and added validation checks to both file ingestion paths:
- **Drag and Drop (`onDrop`):** We added a check against `droppedFile.size`. If the file exceeds the limit, we call `setApiError` with a user-friendly message converting bytes to megabytes and abort the upload process.
- **File Picker (`handleFileChange`):** We added the identical size check on `selectedFile` to block oversized uploads initiated via the standard file explorer.

## Technical Decisions

- **Monorepo Shared Package:** We chose to place the constant in `@sahidawa/shared` (specifically `packages/shared/src/limits.ts`) because SahiDawa is structured as a monorepo. This allows both the Next.js frontend (`apps/web`) and the Express backend (`apps/api`) to import the exact same value, preventing validation drift.
- **Multer Limits Middleware:** Configuring Multer's built-in `limits.fileSize` is highly efficient. It intercepts oversized files early in the request lifecycle, preventing the server from fully buffering or processing payloads that violate our limits.
- **Early Client-Side Rejection:** Validating the file size in the browser before sending the HTTP request saves bandwidth for rural pharmacies, which often operate on slow or metered internet connections.

## How To Re-Implement (Contributor Reference)

If you need to implement or modify bulk upload limits in another upload flow, follow these steps:

1. **Define the Constant:** Open `packages/shared/src/limits.ts` and define your limit (e.g., `MAX_BULK_UPLOAD_FILE_SIZE_BYTES`). Ensure it is exported.
2. **Configure Backend Multer:**
   - Import the constant in your router file.
   - Pass it to the `multer` initialization options under `limits: { fileSize: YOUR_CONSTANT }`.
   - Ensure your error handling middleware catches Multer errors (specifically `LIMIT_FILE_SIZE`) to return a clean `413 Payload Too Large` response.
3. **Implement Frontend Checks:**
   - Import the constant in your React component.
   - In your file input change handler and drag-and-drop handler, retrieve the `File` object.
   - Perform the validation check:
     ```typescript
     if (file.size > MAX_BULK_UPLOAD_FILE_SIZE_BYTES) {
         setApiError(`File exceeds the maximum limit of ${MAX_BULK_UPLOAD_FILE_SIZE_BYTES / (1024 * 1024)}MB.`);
         return;
     }
     ```
4. **Gotchas:**
   - Remember that `file.size` in the browser is in bytes, and Multer's `fileSize` limit is also in bytes. Keep the units consistent.
   - Always clear previous error states (`setApiError(null)`) when a valid file is subsequently selected.

## Impact on System Architecture

This refactor strengthens our system's boundary defense. By enforcing strict file size limits at both the UI layer and the API gateway/middleware layer, we protect our backend from Denial of Service (DoS) vectors involving massive file uploads. 

It establishes a clean pattern for shared configuration across our monorepo, ensuring that any future adjustments to system limits (e.g., increasing the upload limit to 2MB) only require a single-line change in `@sahidawa/shared`.

## Testing & Verification

- **Automated Tests:** We ran the full test suite. The API tests passed (41 suites, 388 tests). We ran linter checks on the web workspace (`npm run lint --workspace=apps/web`) and verified successful builds for both `apps/api` and `apps/web`.
- **Manual Verification:** 
  - Attempted to upload a 1.5MB CSV file via drag-and-drop: The UI successfully blocked the upload and displayed: `"File exceeds the maximum limit of 1MB."`
  - Attempted to upload a 1.5MB CSV file via the file picker: The UI blocked the upload with the same message.
  - Attempted to bypass the frontend and POST a 2MB file directly to `/api/pharmacies/upload`: The backend Multer middleware intercepted the request and rejected it.