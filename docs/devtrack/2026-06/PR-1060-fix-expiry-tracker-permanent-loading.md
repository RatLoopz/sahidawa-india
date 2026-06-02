# PR #1060 — Fix Expiry Tracker permanent loading state and localStorage parsing exceptions

> **Author:** @shuvam776 | **Area:** frontend/ui | **Impact Score:** 20 | **Closes:** #1060

## What Changed

This pull request resolves the perpetual "Loading tracker data..." state on the medicine Expiry Tracker page (`/en/expiry-tracker`). We refactored `useEffect` and `saveToLocalStorage` to wrap all `localStorage` reads, writes, and `JSON.parse` operations inside a robust `try-catch-finally` block, ensuring storage failures or parsing exceptions never block the page loading sequence.

## The Problem Being Solved

Under certain browser states (such as private browsing where `localStorage` is blocked, nested iframes, or when the `sahidawa_expiry_tracker` key contains corrupted/non-JSON data), `localStorage.getItem` or `JSON.parse` would throw unhandled runtime exceptions inside the `useEffect` hook. This prevented `setIsLoaded(true)` from being executed, leaving the interface frozen in an endless loading spinner.

## Files Modified

- `apps/web/app/[locale]/expiry-tracker/page.tsx`

## Implementation Details

1. **`useEffect`:** Added a robust `try-catch-finally` block around the initial load. `setIsLoaded(true)` is placed in the `finally` block to guarantee the loading indicator is resolved even if storage throws an exception.
2. **`saveToLocalStorage`:** Wrapped `localStorage.setItem` in a `try-catch` block to handle save errors gracefully without crashing the active form flow.

## Testing & Verification

- **Storage Block Handling:** Tested with simulated restricted storage access; loading resolved correctly to the empty state without freezing.
- **Corrupted Data Resilience:** Verified that parsing invalid JSON strings handles the failure gracefully and defaults to an empty list instead of hanging.
