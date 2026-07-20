# PR #3769 — feat(web): serve stale cached GET responses during CSRF refresh

> **Merged:** 2026-07-20 | **Author:** @Avinash-sdbegin | **Area:** Frontend | **Impact Score:** 7 | **Closes:** #3648

## What Changed

This PR introduces a new feature to our system where stale cached GET responses are served during CSRF token refresh. When a cached GET request receives a 403 CSRF error response, the Service Worker now serves the cached response immediately (if available) and notifies the client to silently refresh the CSRF token. The client deduplicates concurrent CSRF refresh requests to avoid multiple refresh operations while preserving the existing retry flow. This change affects two main files: `apps/web/lib/apiWithRetry.ts` and `apps/web/worker/index.js`.

## The Problem Being Solved

Before this PR, when a GET request received a 403 CSRF error response, the client would wait for the token to be refreshed before retrying the request. This could lead to a delay in serving the response to the user. The new approach improves the user experience by serving stale cached data immediately while refreshing the CSRF token in the background.

## Files Modified

- `apps/web/lib/apiWithRetry.ts`
- `apps/web/worker/index.js`

## Implementation Details

The implementation involves two main parts: the client-side logic in `apiWithRetry.ts` and the Service Worker logic in `index.js`. On the client-side, a new function `silentlyRefreshCsrfToken` is introduced to handle CSRF token refresh in the background. This function ensures that only one CSRF refresh is in-flight at a time. The client also listens for messages from the Service Worker to trigger silent CSRF token refresh when necessary. In the Service Worker, the `networkFirstWithCache` function is modified to check for 403 CSRF errors on GET requests. If such an error occurs and a cached response is available, the Service Worker serves the cached response and notifies the client to refresh the CSRF token silently.

## Technical Decisions

The decision to use the Service Worker to serve stale cached responses was chosen to improve the user experience by reducing the delay in serving responses. The `silentlyRefreshCsrfToken` function was implemented to prevent multiple concurrent CSRF refresh requests, which could lead to unnecessary refresh operations. The use of the `navigator.serviceWorker.addEventListener` to listen for messages from the Service Worker allows for efficient communication between the client and the Service Worker.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, follow these steps:
1. Modify the `apiWithRetry.ts` file to include the `silentlyRefreshCsrfToken` function, which handles CSRF token refresh in the background.
2. In the same file, add an event listener to the `navigator.serviceWorker` to listen for messages from the Service Worker.
3. In the `index.js` file of the Service Worker, modify the `networkFirstWithCache` function to check for 403 CSRF errors on GET requests.
4. If a 403 CSRF error occurs and a cached response is available, serve the cached response and notify the client to refresh the CSRF token silently using the `notifyClientsCsrfRefresh` function.
5. Ensure that the client deduplicates concurrent CSRF refresh requests to avoid unnecessary refresh operations.

## Impact on System Architecture

This change improves the overall user experience of the SahiDawa system by reducing delays in serving responses. It also demonstrates the use of Service Workers to enhance the performance of web applications. This feature unlocks future development possibilities, such as further optimizing the handling of cached responses and improving the system's resilience to network errors.

## Testing & Verification

The change was tested using a series of test cases, including `offline.test.tsx`, `chat-route.test.ts`, `pharmacy-map-offline-cache.test.tsx`, and `voice-transcribe-route.test.ts`. These tests cover various scenarios, including offline caching, chat routes, pharmacy map offline caching, and voice transcribe routes. The tests verify that the system correctly serves stale cached responses during CSRF token refresh and that the client silently refreshes the CSRF token in the background.