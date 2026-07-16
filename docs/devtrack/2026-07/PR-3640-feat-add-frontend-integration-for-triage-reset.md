# PR #3640 — feat: add frontend integration for triage reset

> **Merged:** 2026-07-16 | **Author:** @Soquixx | **Area:** Frontend | **Impact Score:** 10 | **Closes:** #3493

## What Changed

This PR introduces a new feature to the SahiDawa platform, enabling the frontend to integrate with the triage reset functionality. Specifically, it modifies the `apps/web/app/api/chat/route.ts` and `apps/web/app/components/health/ChatUI.tsx` files to preserve the backend session ID across requests and clear the triage session when the user returns to the home screen. The change ensures that stale triage sessions are avoided by calling the session clear endpoint during chat reset.

## The Problem Being Solved

Before this PR, the SahiDawa platform did not have a mechanism to reset the triage session when the user navigated away from the chat interface. This led to potential issues with stale sessions, where the system might retain outdated or irrelevant triage data. The lack of session management also made it challenging to ensure a seamless user experience, particularly when users returned to the home screen and expected a fresh start.

## Files Modified

- `apps/web/app/api/chat/route.ts`
- `apps/web/app/components/health/ChatUI.tsx`

## Implementation Details

The implementation involves two primary components: the chat route API (`apps/web/app/api/chat/route.ts`) and the ChatUI component (`apps/web/app/components/health/ChatUI.tsx`). In `route.ts`, the code now extracts the `session_id` from the request body and includes it in the API call to the ML service. The response from the ML service also contains the `session_id`, which is then returned in the response headers. In `ChatUI.tsx`, the code now sends the `session_id` with each request to the chat API and retrieves the `session_id` from the response headers. When the user clicks the home button, the code sends a request to the `/api/triage/clear` endpoint to clear the triage session.

## Technical Decisions

The decision to use the `session_id` to manage triage sessions was driven by the need to preserve the backend session state across requests. By including the `session_id` in the API calls, the system can ensure that each request is associated with the correct session, preventing stale sessions and ensuring a seamless user experience. The use of response headers to return the `session_id` allows for a standardized and efficient way to communicate session information between the frontend and backend.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, follow these steps:
1. Modify the `apps/web/app/api/chat/route.ts` file to extract the `session_id` from the request body and include it in the API call to the ML service.
2. Update the `apps/web/app/components/health/ChatUI.tsx` file to send the `session_id` with each request to the chat API and retrieve the `session_id` from the response headers.
3. Implement the logic to clear the triage session when the user clicks the home button by sending a request to the `/api/triage/clear` endpoint.
4. Ensure that the `session_id` is properly handled and stored in the component state to maintain session continuity.

## Impact on System Architecture

This change enhances the overall SahiDawa system architecture by introducing a more robust session management mechanism. By preserving the backend session state across requests, the system can ensure a more seamless and efficient user experience. The introduction of the `/api/triage/clear` endpoint also provides a standardized way to manage triage sessions, making it easier to integrate with other components and features.

## Testing & Verification

The change was tested by verifying that the `session_id` is correctly sent and received in the API calls. The testing also involved checking that the triage session is properly cleared when the user clicks the home button. Additionally, the code was reviewed to ensure that it follows the standard coding practices and conventions of the SahiDawa platform. The provided screenshots and logs demonstrate the successful implementation of the feature.