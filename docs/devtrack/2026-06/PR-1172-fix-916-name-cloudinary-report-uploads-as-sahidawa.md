# PR #1172 — fix(#916): name Cloudinary report uploads as sahidawa/reports/{batch_number}_{timestamp}

> **Merged:** 2026-06-03 | **Author:** @aryan-nmaurya | **Area:** Frontend | **Impact Score:** 8 | **Closes:** #916

## What Changed

Our system's `/api/upload` route now generates a deterministic `public_id` for Cloudinary report uploads, following the pattern `sahidawa/reports/{batch_number}_{timestamp}`. This route accepts an optional `batch_number` from the upload request, sanitizes it, and defaults to "report" if none is supplied. A new regression test suite, `apps/web/tests/upload-route.test.ts`, was added to verify this new naming convention and the correct signing of Cloudinary requests.

## The Problem Being Solved

Previously, when report images were uploaded to Cloudinary via our server-signed `/api/upload` route, they were correctly placed in the `sahidawa/reports` folder, but Cloudinary assigned a random, auto-generated `public_id` to each image. This made it challenging to programmatically identify, retrieve, or manage specific report images based on their associated batch number or upload timestamp, as their Cloudinary `public_id` was unpredictable. Issue #916 specifically requested a deterministic naming convention to improve organization and traceability of these critical health report images.

## Files Modified

- `apps/web/app/api/upload/route.ts`
- `apps/web/tests/upload-route.test.ts`

## Implementation Details

The core of this change resides within the `POST` handler of `apps/web/app/api/upload/route.ts`.

1.  **`public_id` Generation:**
    *   Before constructing the Cloudinary signature, we now determine the `public_id`.
    *   The `rawBatchNumber` is extracted from the incoming `formData` using `formData.get("batch_number")`. It is typed as `string | null` and defaults to an empty string if not present.
    *   A critical sanitization step is applied: `rawBatchNumber.replace(/[^A-Za-z0-9._-]/g, "")`. This regular expression strips any characters that are not alphanumeric, periods, underscores, or hyphens. This prevents potential path traversal vulnerabilities or the injection of invalid characters that could disrupt Cloudinary's file path interpretation.
    *   If the `batchNumber` (after sanitization) is empty, it falls back to the string `"report"`.
    *   The final `publicId` is then constructed by concatenating the sanitized `batchNumber` with the existing `timestamp` (which is `Math.round(new Date().getTime() / 1000).toString()`) using an underscore: `` `${batchNumber}_${timestamp}` ``.

2.  **Cloudinary Signature Update:**
    *   Cloudinary's server-side signing mechanism requires all parameters to be included in the signature string and sorted alphabetically. We updated the `paramsToSign` string to include the new `public_id`.
    *   The updated `paramsToSign` string is now: `` `folder=${folder}&public_id=${publicId}&signature_algorithm=sha256&timestamp=${timestamp}${apiSecret}` ``. Note the alphabetical order: `folder`, `public_id`, `signature_algorithm`, `timestamp`.
    *   The `signature` is then computed using `crypto.createHash("sha256").update(paramsToSign).digest("hex")`.

3.  **`FormData` for Cloudinary:**
    *   Finally, the generated `publicId` is appended to the `cloudinaryFormData` object that is sent to Cloudinary's upload API: `cloudinaryFormData.append("public_id", publicId)`. This ensures Cloudinary uses our specified `public_id` instead of generating its own.

A new test file, `apps/web/tests/upload-route.test.ts`, was introduced to provide robust testing for this functionality. This test suite:
*   Mocks `global.fetch` to intercept and inspect the `FormData` payload sent to Cloudinary.
*   Verifies that the `folder` parameter is correctly set to `"sahidawa/reports"`.
*   Confirms that the `public_id` is generated in the expected `${batch_number}_${timestamp}` format when a `batch_number` is provided.
*   Tests the fallback mechanism, ensuring the `public_id` becomes `report_${timestamp}` when no `batch_number` is supplied.
*   Validates that the Cloudinary `signature` is correctly computed over the alphabetically sorted parameters, including the new `public_id`, using a mock `API_SECRET`.

## Technical Decisions

1.  **Deterministic `public_id`:** The primary decision was to implement a deterministic `public_id` using the `{batch_number}_{timestamp}` pattern. This directly addresses the requirement from issue #916 for predictable and searchable identifiers, significantly improving the manageability and traceability of uploaded report images.
2.  **Server-Side `public_id` Generation:** We chose to generate the `public_id` on the server within the `/api/upload` route rather than on the client. This ensures consistency across all uploads, prevents client-side tampering with the `public_id`, and allows for robust server-side sanitization and fallback logic, which are critical for security and data integrity.
3.  **Batch Number Sanitization:** The use of the regular expression `/[^A-Za-z0-9._-]/g` for sanitizing the `batch_number` was a deliberate security decision. It restricts the `batch_number` to a safe set of characters, preventing malicious input from injecting extra folder segments or invalid characters into the `public_id`, which could lead to unexpected file paths or vulnerabilities in Cloudinary storage.
4.  **Alphabetical Parameter Sorting for Signature:** Cloudinary's server-side authentication requires that the parameters used to generate the signature string (`paramsToSign`) are sorted alphabetically. This is a non-negotiable requirement for the signature to be valid. We explicitly ensured `public_id` was inserted into the correct alphabetical position within `paramsToSign`.
5.  **Dedicated Test Suite:** Creating a new, dedicated test file `apps/web/tests/upload-route.test.ts` for this specific Cloudinary upload logic was chosen to maintain clear separation of concerns in our testing strategy. This makes it easier to understand, test, and maintain this critical part of our system, following existing patterns for route testing.
6.  **Scope Management:** Explicitly defining that wiring the `batch_number` into the report wizard UI is "out of scope" for this PR was a pragmatic decision. It allowed us to focus on delivering the essential backend capability for deterministic naming, preventing scope creep and enabling a quicker resolution of the immediate problem, while still preparing the API for future UI integration.

## How To Re-Implement (Contributor Reference)

To re-implement or extend this feature, a contributor would follow these steps:

1.  **Identify the Server-Side Upload Endpoint:** Locate the API route responsible for handling file uploads and interacting with Cloudinary (e.g., `apps/web/app/api/upload/route.ts`). This route should be responsible for generating the Cloudinary signature.
2.  **Extract Dynamic Identifiers:** From the incoming request (e.g., `NextRequest` in a Next.js API route), retrieve any dynamic data that should be part of the `public_id`. For instance, if using `FormData`, access `formData.get("your_identifier_field")`.
3.  **Sanitize Input:** Implement robust sanitization for any user-provided identifiers. Use a regular expression like `/[^A-Za-z0-9._-]/g` to strip potentially harmful or invalid characters.
    ```typescript
    const rawIdentifier = (formData.get("batch_number") as string | null) ?? "";
    const sanitizedIdentifier = rawIdentifier.replace(/[^A-Za-z0-9._-]/g, "") || "default_prefix";
    ```
4.  **Generate Timestamp:** Obtain a Unix timestamp in seconds, as Cloudinary typically uses this for signatures.
    ```typescript
    const timestamp = Math.round(new Date().getTime() / 1000).toString();
    ```
5.  **Construct `public_id`:** Combine the sanitized identifier and timestamp into the desired `public_id` format.
    ```typescript
    const publicId = `${sanitizedIdentifier}_${timestamp}`;
    ```
6.  **Update `paramsToSign` String:** When creating the string of parameters for Cloudinary's server-side signature, ensure the `public_id` parameter is included. **Crucially, all parameters must be sorted alphabetically.**
    ```typescript
    const folder = "sahidawa/reports";
    const apiSecret = process.env.CLOUDINARY_API_SECRET; // Ensure this is securely loaded
    const paramsToSign = `folder=${folder}&public_id=${publicId}&signature_algorithm=sha256&timestamp=${timestamp}${apiSecret}`;
    ```
7.  **Compute Signature:** Use Node.js's `crypto` module to compute the SHA256 hash of `paramsToSign`.
    ```typescript
    const signature = crypto.createHash("sha256").update(paramsToSign).digest("hex");
    ```
8.  **Append to Cloudinary `FormData`:** Add the `public_id` to the `FormData` object that will be sent to Cloudinary's upload API.
    ```typescript
    const cloudinaryFormData = new FormData();
    cloudinaryFormData.append("file", fileBlob); // The actual file
    cloudinaryFormData.append("api_key", apiKey);
    cloudinaryFormData.append("timestamp", timestamp);
    cloudinaryFormData.append("signature_algorithm", "sha256");
    cloudinaryFormData.append("signature", signature);
    cloudinaryFormData.append("folder", folder);
    cloudinaryFormData.append("public_id", publicId); // The new addition
    ```
9.  **Add Comprehensive Tests:** Create or update a test file (e.g., `apps/web/tests/upload-route.test.ts`) to verify the new behavior.
    *   Mock `global.fetch` to capture the `FormData` sent to Cloudinary.
    *   Assert that the `folder` and `public_id` are correctly set.
    *   Test fallback logic for missing identifiers.
    *   Crucially, verify that the `signature` is correctly computed, including the new `public_id` parameter in the alphabetically sorted string.

**Gotchas:**
*   **Alphabetical Sorting:** Misordering parameters in `paramsToSign` is the most common cause of Cloudinary signature validation failures. Double-check the alphabetical order.
*   **Timestamp Consistency:** Ensure the `timestamp` used in `paramsToSign` is identical to the `timestamp` appended to `cloudinaryFormData`.
*   **Sanitization:** Never trust client-provided `public_id` components without server-side sanitization.

## Impact on System Architecture

This change significantly enhances the traceability and manageability of uploaded report images within our Cloudinary storage. By establishing a clear, predictable naming convention (`sahidawa/reports/{batch_number}_{timestamp}`), we lay a foundational layer for several future capabilities:

*   **Improved Data Linking:** The deterministic `public_id` allows for direct, reliable linking of images to specific database records (e.g., a `MedicineIncidentReport` entry) using the `batch_number` and `timestamp` as keys, simplifying data retrieval and display.
*   **Enhanced Search and Organization:** Future features can leverage the predictable `public_id` for more efficient searching, filtering, and organization of report media within Cloudinary, potentially through Cloudinary's own API or custom indexing.
*   **Decoupled Development:** While the report wizard UI currently doesn't collect a `batch_number`, the `/api/upload` route is now fully capable of handling it. This decouples frontend UI development from backend API readiness, allowing the UI feature to be implemented later without requiring further backend changes to the core upload logic.
*   **Security and Consistency:** Reinforcing server-side control over `public_id` generation and sanitization maintains a high level of security and ensures consistent naming conventions across all report uploads, regardless of the client application.

## Testing & Verification

This change was thoroughly tested and verified through a combination of automated tests and static analysis:

*   **Unit/Integration Tests:** A new, dedicated test suite was created at `apps/web/tests/upload-route.test.ts`. This suite specifically targets the `POST` handler of `apps/web/app/api/upload/route.ts`.
    *   It utilizes `jest.fn()` to mock `global.fetch`, allowing us to intercept and inspect the `FormData` payload that our system sends to the actual Cloudinary API.
    *   Tests confirm that the `folder` parameter in the Cloudinary request is correctly set to `"sahidawa/reports"`.
    *   It verifies that the `public_id` is generated in the expected `BATCH123_{timestamp}` format when a `batch_number` is provided in the request.
    *   The fallback mechanism is tested, ensuring that when no `batch_number` is supplied, the `public_id` correctly defaults to `report_{timestamp}`.
    *   Crucially, the tests assert that the Cloudinary `signature` is correctly computed over the alphabetically sorted parameters, including the newly added `public_id`, using a mock `API_SECRET`. This ensures the integrity and authenticity of our Cloudinary upload requests.
    *   The test suite passes with `npx jest`.

*   **Static Analysis:**
    *   `npx tsc --noEmit` was executed to ensure that no TypeScript compilation errors were introduced by the changes. The codebase remained clean.
    *   `npx prettier --check` was run on both modified files to confirm adherence to our established code formatting standards. The files passed without issues.

**Edge Cases Considered:**
*   **Missing `batch_number`:** Handled by the explicit fallback to `"report"` as the prefix for the `public_id`.
*   **Invalid Characters in `batch_number`:** Addressed by the robust sanitization regex `[^A-Za-z0-9._-]`, which strips any characters that could potentially lead to path injection or invalid Cloudinary identifiers.
*   **Signature Mismatch:** The dedicated tests explicitly verify the signature computation, ensuring that the alphabetical sorting of parameters and the inclusion of `public_id` are correct, preventing signature validation failures by Cloudinary.