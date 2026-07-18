# PR #1566 — fix: expand extractMedicineName skip regex with common pharmaceutical terms

> **Merged:** 2026-06-09 | **Author:** @vipul674 | **Area:** Frontend | **Impact Score:** 6 | **Closes:** #1563

## What Changed

We expanded the `skip` regular expression within the `extractMedicineName()` utility function in `apps/web/src/utils/medicineParser.ts`. This enhancement prevents lines starting with common pharmaceutical dosage forms and terms like `TABLETS`, `CAPSULES`, `SYRUP`, `INJECTION`, and `OINTMENT` from being incorrectly identified as medicine names. Corresponding unit tests were added to `apps/web/tests/medicineParser.test.ts` to validate the new skipping behavior.

## The Problem Being Solved

Before this change, our `extractMedicineName()` utility, which is crucial for parsing medicine names from unstructured text inputs (e.g., OCR output from prescriptions), often misidentified lines starting with pharmaceutical dosage forms as the actual medicine name. For example, if a prescription line read "TABLETS IP" followed by "PARACETAMOL 500MG", our system might incorrectly extract "TABLETS IP" instead of "PARACETAMOL". This led to inaccurate medicine identification, creating noisy data and potentially impacting the reliability of our platform's health record management and drug verification processes for rural health workers. The existing `skip` regex was not comprehensive enough to filter out these common descriptive terms.

## Files Modified

- `apps/web/src/utils/medicineParser.ts`
- `apps/web/tests/medicineParser.test.ts`

## Implementation Details

The core of this change resides within the `extractMedicineName` function in `apps/web/src/utils/medicineParser.ts`. This function is designed to process a multi-line `text` input, typically representing a segment of a prescription, and return the most likely medicine name.

The function operates by first splitting the input `text` into individual `lines`, trimming whitespace from each, and filtering out any empty lines. It then iterates through these processed lines. The crucial component for this PR is the `skip` regular expression, which is used to identify and ignore lines that contain common non-medicine-name terms.

This pull request specifically modified the `skip` regex from its previous state:
`/^(exp(?:iry)?|batch|b\.?\s*no|mfg|date|composition|tablet|capsule|mg|mrp|rs|inr|use|manufacture|store|keep|dosage)/i`
to the expanded version:
`/^(exp(?:iry)?|batch|b\.?\s*no|mfg|date|composition|tablet(?:s)?|capsule(?:s)?|strip(?:s)?|drops?|syrup|injection|suspension|solution|ointment|cream|gel|powder|granules?|spray|inhaler|mg|mrp|rs|inr|use|manufacture|store|keep|dosage)/i`

The key additions to this regex are the inclusion of various pharmaceutical dosage forms and descriptive terms, specifically: `tablet(?:s)?`, `capsule(?:s)?`, `strip(?:s)?`, `drops?`, `syrup`, `injection`, `suspension`, `solution`, `ointment`, `cream`, `gel`, `powder`, `granules?`, `spray`, and `inhaler`. The `(?:s)?` and `s?` non-capturing groups are used to efficiently match both singular and plural forms of these terms (e.g., "tablet" and "tablets", "drop" and "drops"). The `/i` flag ensures that the matching is case-insensitive.

During the iteration over `lines`, if `skip.test(line)` evaluates to `true`, the `continue` statement is executed, causing the loop to skip to the next line. The first `line` encountered that does *not* match this expanded `skip` regex is then returned as the extracted medicine name. If no such line is found after processing all input, the function returns `null`.

To validate this change, a new `it` block was added to the `describe("extractMedicineName", ...)` suite in `apps/web/tests/medicineParser.test.ts`. This block contains multiple `expect` assertions, each testing a specific scenario where a newly added skip term appears on the first line, followed by the actual medicine name on the second line. For example, `expect(extractMedicineName("TABLETS IP\nPARACETAMOL 500MG")).toBe("PARACETAMOL");` confirms that "TABLETS IP" is correctly skipped and "PARACETAMOL" is extracted.

## Technical Decisions

We opted to expand the existing regular expression within `extractMedicineName()` rather than introducing a more complex parsing mechanism or an external natural language processing (NLP) library. This decision was based on several factors:
1.  **Simplicity and Efficiency:** Regular expressions provide a highly efficient and concise way to perform pattern matching at the beginning of strings, which perfectly addresses the problem of filtering out specific leading terms.
2.  **Maintainability:** Modifying an existing, well-understood regex is generally simpler and less prone to introducing side effects than integrating new, potentially heavy dependencies or rewriting core logic.
3.  **Targeted Solution:** The problem was specific: certain common pharmaceutical terms were being misidentified. A targeted regex enhancement was the most direct and least intrusive solution.
4.  **Existing Pattern:** The `medicineParser.ts` already uses a regex-based skipping mechanism, so extending it maintains consistency with the established code pattern.
The use of non-capturing groups like `(?:s)?` for plural forms was a deliberate choice to keep the regex compact and readable while ensuring comprehensive coverage of singular and plural variations. Alternatives, such as maintaining a separate list of skip keywords and iterating through them, were considered but deemed less performant and less elegant than a single, optimized regex for this specific use case.

## How To Re-Implement (Contributor Reference)

Should a contributor need to re-implement this functionality, the process would involve:

1.  **Locate the `extractMedicineName` function:** Navigate to `apps/web/src/utils/medicineParser.ts` and identify the `export function extractMedicineName(text: string): string | null` definition.
2.  **Identify the `skip` regex:** Within this function, find the line where the `skip` constant is defined, which holds the regular expression used for filtering lines.
3.  **Compile a list of pharmaceutical terms to skip:** Brainstorm or research common dosage forms and descriptive terms that should never be considered a medicine name if they appear at the beginning of a line. Examples include "tablet", "capsule", "syrup", "injection", "ointment", "cream", "gel", "powder", "granules", "spray", "inhaler", and "strip".
4.  **Formulate regex patterns for each term, including plurals:**
    *   For terms that can be plural, use `(?:s)?` or `s?` to match both singular and plural forms (e.g., `tablet(?:s)?` for "tablet" or "tablets", `drops?` for "drop" or "drops", `granules?` for "granule" or "granules").
    *   For terms that are typically singular or where plural is less common in this context, add them directly (e.g., `syrup`, `injection`).
5.  **Integrate new patterns into the `skip` regex:** Combine these new patterns with the existing terms in the `skip` regex using the `|` (OR) operator. Ensure the entire regex is enclosed in `^(...)/i` to match at the beginning of a line and be case-insensitive. The resulting regex should resemble:
    ```typescript
    const skip = /^(exp(?:iry)?|batch|b\.?\s*no|mfg|date|composition|tablet(?:s)?|capsule(?:s)?|strip(?:s)?|drops?|syrup|injection|suspension|solution|ointment|cream|gel|powder|granules?|spray|inhaler|mg|mrp|rs|inr|use|manufacture|store|keep|dosage)/i;
    ```
6.  **Add comprehensive unit tests:** Open `apps/web/tests/medicineParser.test.ts`. Within the `describe("extractMedicineName", ...)` block, add a new `it` block or extend an existing one. For each newly added skip term, write a test case that provides a multi-line string where the first line starts with the skip term and the second line contains the expected medicine name. Use `expect(extractMedicineName("SKIP TERM\nMEDICINE NAME")).toBe("MEDICINE NAME");` to assert the correct behavior.
7.  **Execute tests:** Run `npm test -- tests/medicineParser.test.ts` to confirm that all existing and newly added tests pass, ensuring no regressions and validating the new functionality.

## Impact on System Architecture

This change represents a targeted refinement to a core utility function within our frontend's data parsing layer. The `extractMedicineName` function is a foundational component for accurately interpreting unstructured text inputs, such as those generated by OCR from prescription images or entered manually by users. By improving the precision of medicine name extraction, we directly enhance the quality and reliability of the data flowing into the SahiDawa platform. This has a positive ripple effect across various system functionalities, including:
*   **Patient Record Accuracy:** Ensures that medicine names stored in patient health records are correct, reducing potential errors in treatment history.
*   **Inventory Management:** Improves the accuracy of medicine identification for stock tracking and dispensing.
*   **Drug Interaction Checks:** Provides cleaner input for any future drug-to-drug interaction or dosage verification modules.
*   **User Experience:** Reduces the need for manual corrections by rural health workers, streamlining their workflow and increasing trust in the platform.
While this PR does not introduce new architectural patterns or major system components, it significantly strengthens a critical data processing capability, making the SahiDawa platform more robust and reliable in its core mission of medicine verification and health data management.

## Testing & Verification

The changes introduced in this pull request were thoroughly tested using our existing unit test framework. The command `npm test -- tests/medicineParser.test.ts` was executed, and all 12 tests within the `medicineParser.test.ts` suite passed successfully.

Specifically, a new test suite was added to `apps/web/tests/medicineParser.test.ts` to cover the expanded `skip` regex. This suite includes 12 distinct assertions, each designed to verify that `extractMedicineName` correctly handles lines starting with the newly added pharmaceutical terms. For example:
*   `expect(extractMedicineName("TABLETS IP\nPARACETAMOL 500MG")).toBe("PARACETAMOL");`
*   `expect(extractMedicineName("CAPSULES\nAMOXICILLIN 250MG")).toBe("AMOXICILLIN");`
*   `expect(extractMedicineName("SYRUP\nAMBROXOL")).toBe("AMBROXOL");`
*   `expect(extractMedicineName("INJECTION\nDEXAMETHASONE")).toBe("DEXAMETHASONE");`
*   `expect(extractMedicineName("OINTMENT\nBETAMETHASONE")).toBe("BETAMETHASONE");`

These tests confirm that the function now correctly skips these descriptive lines and extracts the subsequent actual medicine name.

**Edge cases considered during testing and implementation:**
*   **Plural forms:** The regex patterns `(?:s)?` and `s?` were explicitly used to ensure both singular ("tablet", "drop") and plural ("tablets", "drops") forms of the pharmaceutical terms are correctly skipped.
*   **Case insensitivity:** The `/i` flag on the `skip` regex ensures that terms are matched regardless of their capitalization (e.g., "TABLETS", "Tablets", "tablets" are all skipped).
*   **Leading/trailing whitespace:** The `line.trim()` operation applied to each line before regex testing ensures that leading or trailing whitespace does not interfere with the matching logic.
*   **Empty lines:** The `filter(Boolean)` step removes empty lines, preventing them from being processed by the regex and ensuring they don't cause unexpected behavior.
*   **Input with no extractable medicine name:** The function's existing behavior of returning `null` if all lines are skipped or the input is empty remains unchanged, providing robust error handling.