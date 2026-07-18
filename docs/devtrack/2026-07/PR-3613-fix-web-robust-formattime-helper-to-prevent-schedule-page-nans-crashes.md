# PR #3613 — fix(web): robust formatTime helper to prevent schedule page NaNs/crashes

> **Merged:** 2026-07-15 | **Author:** @shauryavardhan1307 | **Area:** Frontend | **Impact Score:** 17 | **Closes:** #3610

## What Changed

We introduced a centralized `formatTime` utility function in `@/lib/medicineDateUtils` to standardize time formatting across the application, replacing duplicate implementations in `schedule/page.tsx` and `schedule/[id]/page.tsx`. This function now robustly handles various input formats, including `HH:mm`, `HH:mm:ss`, and ISO date-time strings, and provides a fallback for invalid or missing inputs.

## The Problem Being Solved

Before this change, the schedule page would sometimes display NaN (Not a Number) values or crash due to inconsistent time formatting. The existing `formatTime` functions in `schedule/page.tsx` and `schedule/[id]/page.tsx` were not robust enough to handle different input formats, leading to errors when encountering unexpected time strings. This change addresses these issues by introducing a more comprehensive and centralized time formatting solution.

## Files Modified

- `apps/web/app/[locale]/schedule/[id]/page.tsx`
- `apps/web/app/[locale]/schedule/page.tsx`
- `apps/web/lib/medicineDateUtils.ts`
- `apps/web/tests/medicineDateUtils.test.ts`

## Implementation Details

The new `formatTime` function in `@/lib/medicineDateUtils` uses regular expressions to extract hours and minutes from input strings. It supports `HH:mm`, `HH:mm:ss`, and ISO date-time formats, and falls back to parsing the input as a generic Date object if the regex pattern does not match. If the input is null, undefined, or empty, the function returns a default value of `--:--`. The implementation also includes comprehensive Jest tests in `apps/web/tests/medicineDateUtils.test.ts` to ensure the function behaves correctly for various input scenarios.

## Technical Decisions

We chose to use regular expressions for pattern matching due to their flexibility and efficiency in handling different input formats. The `formatTime` function's fallback mechanism, which attempts to parse the input as a Date object if the regex pattern does not match, provides a robust way to handle unexpected input formats. We also decided to use Jest for testing, as it is a widely adopted and well-maintained testing framework that integrates well with our existing development workflow.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, follow these steps:
1. Create a new utility function `formatTime` in `@/lib/medicineDateUtils`.
2. Use regular expressions to extract hours and minutes from input strings, supporting `HH:mm`, `HH:mm:ss`, and ISO date-time formats.
3. Implement a fallback mechanism to parse the input as a Date object if the regex pattern does not match.
4. Return a default value of `--:--` for null, undefined, or empty inputs.
5. Write comprehensive Jest tests to cover various input scenarios and edge cases.

## Impact on System Architecture

This change improves the overall robustness and consistency of time formatting across the SahiDawa application. By centralizing time formatting logic in a single utility function, we reduce the likelihood of errors and inconsistencies caused by duplicate implementations. This change also unlocks opportunities for future development, as the standardized `formatTime` function can be easily reused in other parts of the application.

## Testing & Verification

We tested the `formatTime` function using Jest, covering various input scenarios, including:
- Valid `HH:mm` and `HH:mm:ss` time strings
- ISO date-time strings
- Null, undefined, and empty inputs
- Invalid or non-parseable input strings
The tests ensure that the function behaves correctly and returns expected output for different input formats and edge cases.