# PR #3872 — fix(web): preserve local expiry-date boundaries

> **Merged:** 2026-07-24 | **Author:** @Shreya-nipunge | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #3869

## What Changed

This PR introduces a fix to preserve local expiry-date boundaries when parsing date-only (`YYYY-MM-DD`) expiry values on the My Medicines page. The existing `parseLocalDate` utility from the expiry tracker is reused for consistent date handling. A new `parseExpiryDate` function is added to detect date-only expiry values and parse them as local dates instead of UTC. The existing behavior for full ISO datetime values remains unchanged.

## The Problem Being Solved

Before this PR, date-only expiry values were being parsed as UTC dates, which caused issues with preserving local calendar-day boundaries. This led to incorrect calculations of days remaining until expiry, particularly when the expiry date was on the same day as the current date in the user's local timezone.

## Files Modified

- `apps/web/app/[locale]/my-medicines/page.tsx`

## Implementation Details

The `parseExpiryDate` function checks if the expiry date string matches the `DATE_ONLY_PATTERN` regex (`^\d{4}-\d{2}-\d{2}$`). If it does, the function uses the `parseLocalDate` utility to parse the date as a local date. Otherwise, it falls back to parsing the date as a UTC date using the `Date` constructor. The `getDaysUntilExpiry` function is updated to use the `parseExpiryDate` function to calculate the days remaining until expiry. When the expiry date is a date-only value, the function sets the current date to midnight (00:00:00) to ensure accurate calculations.

## Technical Decisions

The `parseLocalDate` utility was chosen for consistent date handling because it already existed in the expiry tracker and provided the necessary functionality for parsing local dates. The `DATE_ONLY_PATTERN` regex was used to detect date-only expiry values, as it is a simple and efficient way to check for the `YYYY-MM-DD` format. The decision to reuse existing utilities and keep the implementation simple was made to minimize the introduction of new bugs and make the code easier to maintain.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, follow these steps:
1. Import the `parseLocalDate` utility from the expiry tracker.
2. Create a new `parseExpiryDate` function that checks if the expiry date string matches the `DATE_ONLY_PATTERN` regex.
3. If the expiry date string matches the pattern, use the `parseLocalDate` utility to parse the date as a local date. Otherwise, parse the date as a UTC date using the `Date` constructor.
4. Update the `getDaysUntilExpiry` function to use the `parseExpiryDate` function to calculate the days remaining until expiry.
5. When the expiry date is a date-only value, set the current date to midnight (00:00:00) to ensure accurate calculations.

## Impact on System Architecture

This change improves the accuracy of expiry date calculations and preserves local calendar-day boundaries, which is essential for the My Medicines page. It also promotes code reuse by utilizing the existing `parseLocalDate` utility, making the system more maintainable and efficient. This fix unlocks future development by providing a solid foundation for date-related calculations and ensuring that the system behaves correctly across different timezones.

## Testing & Verification

This change was tested by verifying the fix using different timezones (Asia/Kolkata, UTC, and America/New_York). The tests checked that date-only expiry values remain valid throughout the local expiry day, and the days remaining is `0` on the expiry date and `-1` after local midnight. The code was also validated using `npx eslint`, `npx prettier --check`, and `git diff --check` to ensure that it meets the coding standards and does not introduce any formatting issues.