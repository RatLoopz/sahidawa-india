# PR #3728 — fix(expiry): authenticate csrf-protected tracking requests

> **Merged:** 2026-07-18 | **Author:** @Shreya-nipunge | **Area:** Frontend | **Impact Score:** 8 | **Closes:** #3725

## What Changed

We transitioned the Expiry Tracker component from using an unauthenticated, raw `fetch` call to our secure, authenticated, and CSRF-protected network flow. We integrated the `useSession` hook to retrieve the active user's bearer token, fetched a CSRF token using `getCsrfToken()`, and routed the request through our resilient `fetchWithRetry()` utility.

## The Problem Being Solved

Previously, the Expiry Tracker component sent tracking requests to `/api/v1/medicines/track` using a standard, unauthenticated `fetch()` call without any CSRF protection or session authorization. This left the tracking endpoint vulnerable to Cross-Site Request Forgery (CSRF) attacks and unauthorized spamming, as the backend expects authenticated requests with valid session credentials and matching CSRF tokens. Additionally, using raw `fetch` bypassed our global retry mechanisms, making tracking requests fragile under poor network conditions (common in rural health settings where SahiDawa operates).

## Files Modified

- `apps/web/components/ExpiryTracker.tsx`
- `apps/web/tests/expiry-tracker.test.tsx`

## Implementation Details

### Session Retrieval & Guard Clauses
We integrated the `useSession()` hook from `@/src/components/AuthProvider` to extract the current user's JWT `token`. Before initiating the network request, we perform a pre-flight authentication check:
```typescript
if (!token) {
    setError(t("error"));
    return;
}
```
This prevents unauthenticated users from attempting to submit tracking data and provides immediate localized UI feedback.

### CSRF & Retry Integration
Inside the submission handler, we asynchronously fetch the CSRF token using our shared `getCsrfToken()` utility. We then replace the native `fetch` call with `fetchWithRetry` pointing to `${API_BASE}/api/v1/medicines/track`.

### Request Configuration
The request payload structure is preserved, but the configuration object is updated to include:
- **Method**: `POST`
- **Credentials**: `"include"` (ensures session cookies are sent across origins)
- **Headers**:
  - `Content-Type`: `application/json`
  - `Authorization`: `Bearer ${token}`
  - `x-csrf-token`: `csrfToken`

## Technical Decisions

- **Reusing Core Utilities**: Instead of writing custom retry logic or manually managing CSRF headers, we reused `fetchWithRetry` and `getCsrfToken` from our shared API library. This maintains architectural consistency and ensures we don't duplicate network handling logic.
- **Early Return on Missing Auth**: Blocking the request on the client-side when `token` is null prevents unnecessary network round-trips and provides immediate UI feedback to unauthenticated users.
- **Mocking Strategy in Tests**: We mocked `@/lib/api`, `@/lib/apiWithRetry`, and `@/src/components/AuthProvider` using Jest to isolate the component's behavior and verify that the correct headers and credentials are sent without hitting actual network endpoints.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar authenticated, CSRF-protected request flow in another component, follow these steps:

1. **Import the required hooks and utilities**:
   ```typescript
   import { API_BASE, getCsrfToken } from "@/lib/api";
   import { fetchWithRetry } from "@/lib/apiWithRetry";
   import { useSession } from "@/src/components/AuthProvider";
   ```

2. **Retrieve the session token**:
   ```typescript
   const { token } = useSession();
   ```

3. **Add a guard clause** to prevent unauthenticated submissions:
   ```typescript
   if (!token) {
       setError(t("error"));
       return;
   }
   ```

4. **Fetch the CSRF token and execute the request** using `fetchWithRetry`:
   ```typescript
   try {
       const csrfToken = await getCsrfToken();
       const response = await fetchWithRetry(`${API_BASE}/your-endpoint`, {
           method: "POST",
           headers: {
               "Content-Type": "application/json",
               Authorization: `Bearer ${token}`,
               "x-csrf-token": csrfToken,
           },
           credentials: "include",
           body: JSON.stringify(payload),
       });
       // Handle response...
   } catch (err) {
       // Handle error...
   }
   ```

## Impact on System Architecture

This change aligns the Expiry Tracker with SahiDawa's secure-by-default API consumption standards. By enforcing CSRF protection and token-based authentication on the frontend tracking requests, we secure the `/api/v1/medicines/track` endpoint from unauthorized write operations. Furthermore, using `fetchWithRetry` improves the resilience of our tracking feature in low-connectivity rural environments, ensuring that critical medicine expiry data is successfully logged even during transient network drops.

## Testing & Verification

We updated `apps/web/tests/expiry-tracker.test.tsx` to fully cover the new authenticated flow:
- **Mocked Dependencies**: Mocked `getCsrfToken`, `fetchWithRetry`, and `useSession` to return controlled test values.
- **Authentication Guard Test**: Added a test case verifying that the component does not submit when authentication is unavailable (`token: null`), asserting that `mockGetCsrfToken` and `mockFetchWithRetry` are not called, and the error alert is displayed.
- **Header & Credentials Verification**: Added assertions to verify that `fetchWithRetry` is called with the correct URL, `POST` method, `credentials: "include"`, and headers (`Authorization`, `x-csrf-token`).
- **Test Suite Health**: All 11 unit tests pass successfully. ESLint, TypeScript type checks, and Prettier checks have all passed for the modified files.