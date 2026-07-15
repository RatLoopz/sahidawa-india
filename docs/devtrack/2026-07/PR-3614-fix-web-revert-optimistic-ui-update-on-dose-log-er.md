# PR #3614 — fix(web): revert optimistic UI update on dose log error and display toast warning

> **Merged:** 2026-07-15 | **Author:** @shauryavardhan1307 | **Area:** Frontend | **Impact Score:** 11 | **Closes:** #3611

## What Changed

We updated the `DoseButton` component in `apps/web/app/[locale]/schedule/page.tsx` to revert optimistic UI updates when logging a dose fails due to API errors. Additionally, we display a toast warning to the user when such an error occurs. This change ensures that the UI remains consistent with the actual state of the dose log, even in the presence of errors.

## The Problem Being Solved

Before this PR, when a user attempted to log a dose, the UI would optimistically update to reflect the new dose status, even if the API request to log the dose failed. This could lead to inconsistencies between the UI and the actual state of the dose log, causing confusion for the user. Furthermore, there was no clear indication to the user that an error had occurred, making it difficult for them to understand what had gone wrong.

## Files Modified

- `apps/web/app/[locale]/schedule/page.tsx`
- `apps/web/messages/en.json`
- `apps/web/tests/schedule-dose-logging.test.tsx`

## Implementation Details

The implementation involves several key changes:
1. **Error Handling**: In `DoseButton`, we catch any errors that occur when logging a dose and revert the optimistic UI update by calling `onStatusChange` with the previous dose status.
2. **Toast Notifications**: We use the `toast` library from `sonner` to display a warning toast to the user when an error occurs while logging a dose.
3. **API Mocking**: In the new test file `schedule-dose-logging.test.tsx`, we mock the `logDose` API to simulate both successful and failed dose logging scenarios, ensuring that our component behaves correctly under different conditions.
4. **Translation Updates**: We added new translation keys in `en.json` under the `"schedule"` namespace to support the display of dose-related messages, including error messages and success notifications.

## Technical Decisions

We chose to use the `sonner` library for toast notifications because it provides a simple and customizable way to display notifications to the user. For API mocking, we used Jest's mocking capabilities to simulate the behavior of the `logDose` API, allowing us to test our component's error handling and success scenarios in isolation.

## How To Re-Implement (Contributor Reference)

To re-implement this feature:
1. Update `DoseButton` to catch and handle errors from the `logDose` API call.
2. Integrate the `sonner` library for displaying toast notifications.
3. Create mock implementations for the `logDose` API in your tests.
4. Add necessary translation keys for dose-related messages.

## Impact on System Architecture

This change improves the overall user experience by ensuring that the UI accurately reflects the state of the dose log, even in the presence of errors. It also sets a precedent for handling API errors in a user-friendly manner, which can be applied to other parts of the SahiDawa system.

## Testing & Verification

We added comprehensive unit tests in `schedule-dose-logging.test.tsx` to verify the correct behavior of the `DoseButton` component under various scenarios, including successful dose logging, failed dose logging due to API errors, and the display of toast notifications. These tests ensure that our implementation is robust and functions as expected.