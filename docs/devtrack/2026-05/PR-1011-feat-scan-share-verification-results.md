# PR #1011 — feat(scan): share verification results

> **Merged:** 2026-05-31 | **Author:** @saurabhhhcodes | **Area:** Frontend | **Impact Score:** 15 | **Closes:** #797

## What Changed

This pull request introduces the capability for users to share the results of a medicine verification scan directly from the SahiDawa web application. We have implemented a "Share" button on the scan result screens (Verified Safe, Counterfeit Alert, Unverified) which, when clicked, leverages the Web Share API on compatible devices or falls back to copying the verification details to the user's clipboard on other platforms. The shared content is dynamically generated based on the verification outcome and is fully localized.

## The Problem Being Solved

Prior to this change, users had no direct way to share the outcome of a medicine verification scan. If a user encountered a counterfeit medicine or wanted to inform others about a verified safe product, they would have to manually copy the details, which was cumbersome and prone to errors. This feature addresses the need for easy dissemination of critical health information, especially concerning potentially harmful counterfeit drugs, by providing a streamlined sharing mechanism.

## Files Modified

- `apps/web/app/[locale]/scan/page.tsx`
- `apps/web/lib/verificationShare.ts`
- `apps/web/messages/en.json`
- `apps/web/tests/verification-share.test.ts`

## Implementation Details

The core of this feature is implemented in `apps/web/app/[locale]/scan/page.tsx`, which is the main component for displaying scan results.

1.  **Localization Integration**: We integrated `useTranslations` from `next-intl` to fetch localized strings for the share functionality. A new `share` object was added to `apps/web/messages/en.json` containing keys for the share button label, success/failure messages, and various components of the share text (e.g., "real status", "suspicious status", "batch label").
2.  **`copyTextToClipboard` Utility**: A new asynchronous function, `copyTextToClipboard(text: string)`, was added directly to `apps/web/app/[locale]/scan/page.tsx`. This function attempts to use `navigator.clipboard.writeText` first. If the Clipboard API is unavailable (e.g., in some older browsers or non-secure contexts), it falls back to creating a temporary `textarea` element, populating it with the text, selecting it, and executing `document.execCommand("copy")`. This ensures broad compatibility for clipboard operations.
3.  **Share Button Integration**: The `ResultActions` component, which is rendered within `VerifiedSafeResult`, `CounterfeitAlertResult`, and `UnverifiedResult`, now accepts a `shareLabel` prop. This prop is populated with the localized string `tScan("share.button")` from `ScanPage`, ensuring the button text is appropriate for the user's locale.
4.  **`handleShare` Logic**: The `handleShare` asynchronous function in `ScanPage` orchestrates the sharing process:
    - It constructs a `shareCopy` object by mapping localized strings from `tScan("share")` to the `VerificationShareCopy` type defined in `apps/web/lib/verificationShare.ts`.
    - It calls `buildVerificationShareText` (from the new `apps/web/lib/verificationShare.ts` utility) to generate the actual text content for sharing. This function takes the `verifyResult`, `batchNumber`, `brandName`, and the `shareCopy` object as input, allowing it to dynamically create a message tailored to the verification outcome (verified, counterfeit, unverified) and including relevant medicine details.
    - It then attempts to use the Web Share API (`navigator.share`). The `shareData` object includes a localized `title` (`tScan("share.title")`) and the generated `shareText`. We explicitly removed `url: window.location.href` from `shareData` for `navigator.share` to allow the platform to determine the best URL, or to omit it if not relevant to the shared text.
    - If `navigator.share` is not available or fails (e.g., due to user cancellation or an unsupported environment), it falls back to `copyTextToClipboard(shareText)`.
    - Success or failure toasts (`toast.success` or `toast.error`) are displayed using localized messages (`tScan("share.shared_success")`, `tScan("share.copy_success")`, `tScan("share.failure")`).
5.  **`verificationShare.ts` Utility**: A new file, `apps/web/lib/verificationShare.ts`, was introduced to encapsulate the logic for building the share text.
    - It defines `VerificationShareCopy` and `VerificationShareInput` types for clear interface definitions.
    - It includes helper functions `getMedicineName` and `getBatchNumber` to safely retrieve medicine details, falling back to provided values or localized "unknown" strings if data is missing.
    - The `buildVerificationShareText` function (partially shown in the diff, but its full implementation is inferred from usage and tests) is responsible for assembling the final share string based on the `VerifyResult` status (verified, counterfeit, unverified) and the provided localized `copy`. For verified results, it includes medicine name, batch, manufacturer, and a "verified by SahiDawa" message. For counterfeit, it includes a warning and advice to avoid. For unverified, it states the status and advises self-verification.

## Technical Decisions

1.  **Web Share API First, Clipboard Fallback**: We prioritized the Web Share API (`navigator.share`) because it provides a native, platform-integrated sharing experience, allowing users to choose their preferred app (e.g., WhatsApp, email, social media). This offers a superior user experience compared to a simple clipboard copy. However, recognizing that the Web Share API might not be available on all browsers or desktop environments, we implemented a robust clipboard fallback using `navigator.clipboard.writeText` and a `textarea` workaround. This ensures the sharing functionality is broadly accessible.
2.  **Dedicated Share Text Utility (`verificationShare.ts`)**: We decided to extract the logic for constructing the share text into a separate utility file (`apps/web/lib/verificationShare.ts`). This promotes separation of concerns, making `scan/page.tsx` cleaner and more focused on UI and state management. It also makes the share text generation logic easily testable in isolation, as demonstrated by `verification-share.test.ts`.
3.  **Localization with `next-intl`**: Leveraging `next-intl` for all share-related strings was a critical decision. This ensures that the SahiDawa platform remains accessible and user-friendly for our diverse user base across different regions of India, where multiple languages are spoken. It aligns with our existing localization strategy and simplifies future language additions.
4.  **Comprehensive Share Content**: The `buildVerificationShareText` function was designed to generate detailed and informative share messages for all verification outcomes (verified, counterfeit, unverified). This is crucial for conveying the full context of the scan result, especially for counterfeit or unverified medicines, where clear instructions (e.g., "avoid and report") are vital.
5.  **No URL in `navigator.share` `shareData`**: We opted to remove `url: window.location.href` from the `shareData` object when using `navigator.share`. This was a conscious decision to allow the native share sheet to determine if a URL is appropriate or to omit it, preventing redundant or potentially confusing links if the primary shared content is the text itself. For the clipboard fallback, the text is copied directly without an appended URL, as the user can then manually paste it wherever they wish.

## How To Re-Implement (Contributor Reference)

To re-implement this sharing feature from scratch, a contributor would follow these steps:

1.  **Define Share Text Structure**:
    - Create a new utility file, e.g., `apps/web/lib/verificationShare.ts`.
    - Define a type `VerificationShareCopy` to hold all localized strings needed for building the share message (e.g., `realStatus`, `suspiciousStatus`, `batchLabel`, `avoidAndReport`).
    - Define a type `VerificationShareInput` to encapsulate all necessary data for building the share text (e.g., `result: VerifyResult | null`, `batchNumber?: string`, `brandName?: string`, `copy: VerificationShareCopy`).
    - Implement helper functions like `getMedicineName` and `getBatchNumber` within this file to safely extract medicine details from `VerifiedMedicine` objects, providing fallbacks for missing data and using localized "unknown" strings.
    - Implement the main function, `buildVerificationShareText(input: VerificationShareInput)`, which takes the verification result and localized copy, and constructs a comprehensive string based on whether the medicine is verified, counterfeit, or unverified. This function should handle different result types and include relevant details like brand name, batch number, and manufacturer.

2.  **Add Localization Strings**:
    - Open `apps/web/messages/en.json` (and other locale files as needed).
    - Add a new top-level key, e.g., `"Scan"`, and within it, a `"share"` object.
    - Populate the `"share"` object with keys corresponding to `VerificationShareCopy` (e.g., `"title"`, `"button"`, `"real_status"`, `"suspicious_status"`, `"warning_prefix"`, `"verified_by"`, `"batch_label"`, `"manufacturer_label"`, `"avoid_and_report"`, `"verify_yourself"`, `"unknown_medicine"`, `"unknown_batch"`, `"unknown_manufacturer"`, `"shared_success"`, `"copy_success"`, `"failure"`).

3.  **Integrate into Scan Page Component (`apps/web/app/[locale]/scan/page.tsx`)**:
    - Import `useTranslations` from `next-intl` and `buildVerificationShareText`, `VerificationShareCopy` from `lib/verificationShare.ts`.
    - Inside the `ScanPage` functional component, initialize `const tScan = useTranslations("Scan");`.
    - Create a `shareCopy` object by mapping the `tScan("share")` values to the `VerificationShareCopy` type.
    - Implement the `copyTextToClipboard(text: string)` asynchronous function for clipboard fallback, including both `navigator.clipboard.writeText` and the `textarea` workaround.
    - Create an asynchronous `handleShare` function:
        - Call `buildVerificationShareText` with `verifyResult`, `batchInput || parsedBatch`, `parsedBrand`, and the `shareCopy` object to get the `shareText`.
        - Construct a `shareData` object with `title: tScan("share.title")` and `text: shareText`.
        - Use a `try...catch` block:
            - Inside `try`, check `if (navigator.share) { await navigator.share(shareData); toast.success(tScan("share.shared_success")); }`.
            - In the `else` block, call `const copied = await copyTextToClipboard(shareText); if (!copied) throw new Error("Clipboard copy failed"); toast.success(tScan("share.copy_success"));`.
            - In the `catch` block, handle `AbortError` (user cancellation) silently, otherwise `toast.error(tScan("share.failure"));`.
    - Modify `ResultActions` component to accept a `shareLabel` prop.
    - Pass `shareLabel={tScan("share.button")}` and `onShare={handleShare}` to the `ResultActions` component from `VerifiedSafeResult`, `CounterfeitAlertResult`, and `UnverifiedResult`.

4.  **Add Unit Tests**:
    - Create a new test file, `apps/web/tests/verification-share.test.ts`.
    - Mock `next-intl`'s `useTranslations` to control localized strings in tests.
    - Write tests for `buildVerificationShareText` covering all possible `VerifyResult` states (verified, counterfeit, unverified) and edge cases like missing `brandName` or `batchNumber`, ensuring the generated text is correct and localized.

## Impact on System Architecture

This change primarily impacts the frontend user experience and the `apps/web` module.

1.  **Enhanced User Experience**: It significantly improves the usability of the scan feature by providing a direct and intuitive way to share verification results, which is crucial for a health platform like SahiDawa.
2.  **Localization Expansion**: It extends our existing localization efforts to cover dynamic content generation, reinforcing our commitment to a multilingual user base.
3.  **Modular Share Logic**: The introduction of `apps/web/lib/verificationShare.ts` establishes a pattern for encapsulating complex text generation logic into dedicated utility modules. This promotes a cleaner architecture and makes it easier to reuse or modify sharing logic in the future for other parts of the application.
4.  **Platform Feature Adoption**: By adopting the Web Share API, we are leveraging modern browser capabilities, which can lead to more engaging and integrated user interactions. The robust fallback mechanism ensures that this feature is not limited to specific environments, maintaining broad accessibility.
5.  **No Backend Impact**: This feature is entirely client-side, meaning there is no direct impact on our backend APIs or database schema. The verification data is already available on the frontend, and the sharing mechanism simply formats and dispatches this information.

## Testing & Verification

The feature was thoroughly tested and verified through a combination of unit tests and manual validation:

1.  **Unit Tests (`apps/web/tests/verification-share.test.ts`)**:
    - We added comprehensive unit tests specifically for the `buildVerificationShareText` function. These tests cover various scenarios:
        - **Verified Medicine**: Ensuring the correct message is generated for a verified product, including brand name, batch number, manufacturer, and the "real status" message.
        - **Counterfeit Medicine**: Verifying that the output includes the "suspicious status", "warning prefix", and "avoid and report" messages.
        - **Unverified Medicine**: Checking that the message correctly states the unverified status and includes the "verify yourself" instruction.
        - **Missing Data**: Tests were included to ensure graceful handling when `brandName` or `batchNumber` are missing from the input, falling back to localized "unknown medicine" or "unknown batch" strings.
    - The `next-intl` `useTranslations` hook was mocked to ensure tests are isolated from actual translation file loading and can assert on specific localized string usage.

2.  **Manual Validation (as per PR description)**:
    - `npm test -- verification-share.test.ts -w web`: Confirmed that the new unit tests pass in isolation.
    - `npm test -w web`: Verified that all web application tests, including the new ones, pass.
    - `eslint apps/web/app/'[locale]'/scan/page.tsx apps/web/lib/verificationShare.ts apps/web/tests/verification-share.test.ts`: Ensured code quality and adherence to linting rules. Warnings for pre-existing unused imports were noted but not introduced by this PR.
    - `npm run build -w web`: Confirmed that the web application builds successfully with the new changes.
    - `npx prettier --check apps/web/app/'[locale]'/scan/page.tsx apps/web/lib/verificationShare.ts apps/web/tests/verification-share.test.ts apps/web/messages/en.json`: Ensured code formatting consistency.
    - `git diff --check`: Verified no whitespace or other trivial issues were introduced.

**Edge Cases**:

- **Web Share API Availability**: The implementation explicitly handles the absence of `navigator.share` by falling back to `copyTextToClipboard`, ensuring functionality across a wider range of devices and browsers.
- **Clipboard API Availability/Permissions**: The `copyTextToClipboard` function includes a `textarea` fallback for environments where `navigator.clipboard.writeText` might not be available or permissions are denied, making the clipboard copy robust.
- **User Cancellation**: The `handleShare` function catches `AbortError` from `navigator.share`, which typically indicates the user dismissed the share sheet, preventing an erroneous "Failed to share result" toast in such cases.
- **Missing Medicine Details**: The `buildVerificationShareText` utility and its helper functions (`getMedicineName`, `getBatchNumber`) are designed to handle cases where `brand_name`, `batch_number`, or other details might be `null` or `undefined`, using localized fallback strings.
