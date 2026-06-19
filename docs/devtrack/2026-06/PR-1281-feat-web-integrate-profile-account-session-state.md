# PR #1281 — feat(web): integrate profile account session state

> **Merged:** 2026-06-04 | **Author:** @shashank03-dev | **Area:** Frontend | **Impact Score:** 8 | **Closes:** #1200

## What Changed

This pull request introduces dynamic session state management to the `ProfilePage` component within our `apps/web` Next.js frontend. It enables the profile page to read the `sb-access-token` from `localStorage`, parse its payload to determine the user's authentication status, and display relevant information or actions, including a sign-out mechanism.

## The Problem Being Solved

Prior to this change, the `ProfilePage` (`apps/web/app/[locale]/profile/page.tsx`) was a static component that consistently displayed "Guest User" and "No account connected", regardless of whether a user was actually authenticated elsewhere in the application. This created a disjointed user experience where a logged-in user would visit their profile and not see their account details or an option to manage their session. The system lacked a unified way to reflect the local authentication session on the profile page, making it inconsistent with other parts of the application that utilize the `sb-access-token`.

## Files Modified

- `apps/web/app/[locale]/profile/page.tsx`
- `apps/web/tests/profile-auth-status.test.tsx`

## Implementation Details

We have refactored the `ProfilePage` component to be a client-side rendered page that dynamically manages and displays the user's authentication status.

1.  **Session State Management:**
    *   We introduced a `ProfileSession` type, a discriminated union representing three states: `"checking"` (initial load), `"guest"` (no valid token), and `"authenticated"` (with `displayName`).
    *   The `ProfilePage` component now uses `useState<ProfileSession>({ status: "checking" })` to manage its internal session state.
    *   `accountTitle` and `accountSubtitle` are computed dynamically based on the current `session.status`, providing user feedback like "Checking account status" or "Asha Sharma".

2.  **Token Reading and Decoding:**
    *   A `useEffect` hook is used to read the `sb-access-token` from `localStorage` only after the component mounts, ensuring client-side execution.
    *   A new helper function, `readSessionFromToken(token: string | null)`, is central to this logic. It takes the raw token string and performs the following:
        *   If the token is `null` or empty, it returns a `guest` session.
        *   It attempts to split the JWT into its parts. If the payload part is missing, it returns a `guest` session and flags `clearToken: true` for cleanup.
        *   It uses `decodeBase64Url(value: string)` to safely decode the base64url-encoded JWT payload. This custom utility handles URL-safe characters (`-`, `_`) and padding (`=`) before using `window.atob` and `TextDecoder`.
        *   The decoded payload is parsed as `AccessTokenPayload`, which includes `email`, `sub`, `exp` (expiration timestamp), and `user_metadata`.
        *   It checks for token expiry by comparing `payload.exp * 1000` (milliseconds) with `Date.now()`. Expired tokens result in a `guest` session with `clearToken: true`.
        *   The `displayName` for an authenticated user is extracted in a prioritized order: `user_metadata.full_name`, then `user_metadata.name`, then `email`, then `sub`, falling back to "Signed-in User".
        *   A `try-catch` block wraps the decoding and parsing to gracefully handle malformed tokens, returning a `guest` session and `clearToken: true`.
    *   If `readSessionFromToken` indicates `clearToken: true`, the `useEffect` block ensures `localStorage.removeItem(ACCESS_TOKEN_KEY)` is called to clean up invalid or expired tokens.

3.  **User Interface Updates:**
    *   The profile card's content is now conditional.
    *   When in the `"guest"` state, a `Link` component from `@/i18n/routing` is displayed, directing users to `/login` with the text "Sign In / Register". The `LogIn` icon from `lucide-react` is used.
    *   When in the `"authenticated"` state, a "Sign Out" button is rendered. This button triggers the `handleSignOut` function.

4.  **Sign-Out Functionality:**
    *   The `handleSignOut` function is an `onClick` handler for the "Sign Out" button.
    *   It clears the `sb-access-token` from `localStorage`.
    *   It updates the component's internal `session` state to `guest`.
    *   It then uses `router.push("/")` (obtained via `useRouter` from `@/i18n/routing`) to redirect the user to the home page, completing the sign-out flow.

## Technical Decisions

1.  **Client-Side Rendering for Session:** We chose to make the `ProfilePage` a client-side component (`"use client"`) because authentication tokens (like `sb-access-token`) are typically stored in `localStorage`, which is only accessible in the browser environment. Attempting to read `localStorage` during server-side rendering would fail. This ensures the session state is accurately reflected after the page hydrates.
2.  **Custom JWT Decoding:** Instead of relying on a full-fledged JWT library, we implemented a lightweight, custom `decodeBase64Url` function and manual payload parsing. This decision was made to minimize bundle size and external dependencies for a relatively simple task: extracting display-relevant fields and checking expiration. The focus is on "safe" payload fields for display, not cryptographic verification, which would require a more robust library.
3.  **Robust Token Handling:** The `readSessionFromToken` function is designed to be resilient. It explicitly handles `null` tokens, malformed tokens (e.g., incorrect JWT structure), and expired tokens. In all invalid cases, it not only defaults to a "guest" state but also flags the token for removal from `localStorage` (`clearToken: true`). This proactive cleanup prevents persistent display of incorrect states or reliance on stale data.
4.  **Prioritized Display Name Extraction:** The logic for `displayName` extraction (from `full_name`, `name`, `email`, `sub`) provides a flexible and user-friendly fallback mechanism. This ensures that even if a user's `user_metadata` is incomplete, a meaningful identifier is still displayed.
5.  **`@/i18n/routing` Integration:** We leveraged our existing `@/i18n/routing` library for the "Sign In / Register" link and the sign-out redirect. This ensures that routing respects our internationalization setup and provides a consistent navigation experience.

## How To Re-Implement (Contributor Reference)

To re-implement this session state integration for a similar page:

1.  **Mark as Client Component:** Ensure the component file starts with `"use client";` to enable client-side hooks and `localStorage` access.
2.  **Import Necessary Hooks and Utilities:**
    ```typescript
    import { useEffect, useState } from "react";
    import { useRouter } from "@/i18n/routing"; // For navigation
    import { LogIn, LogOut, ShieldCheck } from "lucide-react"; // For icons
    ```
3.  **Define Token Key and Session Types:**
    ```typescript
    const ACCESS_TOKEN_KEY = "sb-access-token"; // Standard key for Supabase tokens

    type ProfileSession =
        | { status: "checking" }
        | { status: "guest" }
        | {
              status: "authenticated";
              displayName: string; // Or other relevant user data
          };

    type AccessTokenPayload = {
        email?: unknown;
        sub?: unknown;
        exp?: unknown;
        user_metadata?: Record<string, unknown> | null;
    };
    ```
4.  **Implement JWT Decoding Utilities:**
    *   `getString(value: unknown)`: A helper to safely cast to string and trim.
    *   `decodeBase64Url(value: string)`: This is crucial for correctly parsing the base64url-encoded JWT payload. It needs to handle character replacements (`-` to `+`, `_` to `/`) and padding (`=`) before using `window.atob` and `TextDecoder`.
    *   `readSessionFromToken(token: string | null)`: This function encapsulates the core logic:
        *   Split the token by `.` to get the payload part.
        *   `try-catch` block for `JSON.parse` and `decodeBase64Url`.
        *   Check `exp` against `Date.now()` for expiry.
        *   Extract display name from `user_metadata` or other payload fields.
        *   Return `{ session: ProfileSession, clearToken: boolean }`.
5.  **Initialize State and Router in Component:**
    ```typescript
    export default function MyPage() {
        const router = useRouter();
        const [session, setSession] = useState<ProfileSession>({ status: "checking" });

        // Derive display strings
        const accountTitle = session.status === "authenticated" ? session.displayName : "Guest";
        // ...
    ```
6.  **Use `useEffect` for Initial Session Load:**
    ```typescript
    useEffect(() => {
        const result = readSessionFromToken(localStorage.getItem(ACCESS_TOKEN_KEY));
        if (result.clearToken) {
            localStorage.removeItem(ACCESS_TOKEN_KEY);
        }
        setSession(result.session);
    }, []); // Empty dependency array ensures it runs once on mount
    ```
7.  **Implement Sign-Out Logic:**
    ```typescript
    const handleSignOut = () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        setSession({ status: "guest" }); // Update local state immediately
        router.push("/"); // Redirect to home or login page
    };
    ```
8.  **Conditionally Render UI:** Use `session.status` to render different UI elements, such as a "Sign In" button (linking to `/login`) or a "Sign Out" button (calling `handleSignOut`).

## Impact on System Architecture

This change significantly improves the user experience of the SahiDawa web application by making the profile page dynamic and reflective of the user's authentication state.

*   **Enhanced User Experience:** Users now see personalized content on their profile page, confirming their logged-in status and providing direct access to session management.
*   **Consistency:** It aligns the profile page with the authentication state managed by `localStorage` across the rest of the application, reducing cognitive load for users.
*   **Foundation for User-Specific Features:** By establishing a reliable way to read and display user session data on the profile, this PR lays the groundwork for future features that require authenticated user information, such as managing personal details, viewing past reports, or accessing premium features.
*   **Robustness:** The explicit handling of malformed and expired tokens ensures that our system gracefully degrades and cleans up invalid data, improving overall stability.
*   **Frontend Autonomy:** The profile page can now manage its own authentication display state without requiring direct backend calls for basic status checks, relying on the client-side token.

## Testing & Verification

This change was thoroughly tested with dedicated Jest unit tests in `apps/web/tests/profile-auth-status.test.tsx`.

*   **Test Environment Setup:** The tests utilize `@jest-environment jsdom` and include polyfills for `globalThis.TextDecoder` and `window.atob` to ensure the `decodeBase64Url` function works correctly within the Jest DOM environment. `localStorage` is cleared before each test, and `useRouter().push` is mocked to track navigation.
*   **Guest State Verification:** We verified that when no `sb-access-token` exists in `localStorage`, the page correctly renders "Guest User", "No account connected", and displays a "Sign In / Register" link pointing to `/login`. It also asserts that no "Sign Out" button is present.
*   **Authenticated State Verification:** We created mock valid JWTs using a `createAccessToken` helper, setting `email`, `sub`, `exp`, and `user_metadata.full_name`. We then asserted that the page correctly displays the `displayName` (e.g., "Asha Sharma") derived from the token.
*   **Malformed Token Handling:** Not explicitly detailed in the provided diff, but the PR description states "malformed token cleanup" was tested. This implies tests exist to ensure that if `localStorage` contains an invalid JWT, it's treated as a guest session, and the token is cleared.
*   **Expired Token Handling:** Similarly, the PR description mentions "expired token cleanup". This indicates tests are in place to confirm that if an `sb-access-token` is present but its `exp` claim is in the past, it's treated as a guest session, and the token is removed.
*   **Sign-Out Behavior:** We tested the `handleSignOut` function, verifying that clicking the "Sign Out" button clears the `sb-access-token` from `localStorage`, updates the component's state to `guest`, and triggers a navigation event to the home page (`/`) via `router.push`.

Edge cases covered include:
*   No token present.
*   Valid token with various `displayName` fields.
*   Malformed token structure.
*   Expired token.
*   User-initiated sign-out.

Verification steps included running `npm run test -w web -- profile-auth-status.test.tsx --runInBand`, `npx eslint`, `npx prettier --check`, and `npm run build -w web` to ensure code quality and build success.