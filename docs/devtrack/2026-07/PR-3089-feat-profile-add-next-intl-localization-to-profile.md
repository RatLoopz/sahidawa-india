# PR #3089 — feat(profile): add next-intl localization to profile page

> **Merged:** 2026-07-04 | **Author:** @ANISHA-RAWAT | **Area:** i18n | **Impact Score:** 62 | **Closes:** #2906

## What Changed

We integrated `next-intl` localization into the SahiDawa profile page (`apps/web/app/[locale]/profile/page.tsx`) to replace all hardcoded English strings with dynamic translations. We extracted these strings into a unified `"Profile"` namespace and added corresponding translations to all 19 regional Indian language locale files within `apps/web/messages/`. Additionally, we refactored the session token parser to return `null` instead of a hardcoded fallback string, allowing the UI layer to handle localized fallbacks cleanly.

## The Problem Being Solved

SahiDawa is designed to serve rural Indian populations, making multi-lingual support a core requirement. Prior to this PR, the profile page contained hardcoded English strings (such as "Your Profile", "ABHA Setup", and "Sign Out"), which alienated non-English speaking users. 

Furthermore, the session parsing utility `readSessionFromToken` contained a hardcoded fallback string `'Signed-in User'` directly inside its business logic. Because this function runs outside of the React component lifecycle and lacks access to the React context required by `next-intl`, it was impossible to translate this fallback string directly. This architectural coupling prevented clean localization of the user's display name when metadata was missing.

## Files Modified

- `apps/web/app/[locale]/profile/page.tsx`
- `apps/web/messages/as.json`
- `apps/web/messages/bn.json`
- `apps/web/messages/en.json`
- `apps/web/messages/gu.json`
- `apps/web/messages/hi.json`
- `apps/web/messages/kn.json`
- `apps/web/messages/kok.json`
- `apps/web/messages/ks.json`
- `apps/web/messages/mai.json`
- `apps/web/messages/ml.json`
- `apps/web/messages/mni.json`
- `apps/web/messages/mr.json`
- `apps/web/messages/or.json`
- `apps/web/messages/pa.json`
- `apps/web/messages/sa.json`
- `apps/web/messages/sd.json`
- `apps/web/messages/ta.json`
- `apps/web/messages/te.json`
- `apps/web/messages/ur.json`

## Implementation Details

### 1. Refactoring Token Session Parsing
We modified the `AccessTokenPayload` and the `ProfileSession` types to allow `displayName` to be `string | null` instead of a strict `string`. Inside `readSessionFromToken`, we updated the fallback chain:

```typescript
// Before
const displayName =
    getString(payload.user_metadata?.name) ??
    getString(payload.email) ??
    getString(payload.sub) ??
    "Signed-in User";

// After
const displayName =
    getString(payload.user_metadata?.name) ??
    getString(payload.email) ??
    getString(payload.sub) ??
    null;
```

This shifts the responsibility of fallback rendering to the UI layer where the translation context is available.

### 2. Integrating `next-intl` in the Profile Component
We imported `useTranslations` from `next-intl` and initialized the translation hook within the `ProfilePage` component:

```typescript
const t = useTranslations("Profile");
```

We then mapped the state-dependent variables `accountTitle` and `accountSubtitle` to use the translation keys:

```typescript
const accountTitle =
    session.status === "authenticated"
        ? (session.displayName ?? t("signedInUser"))
        : session.status === "checking"
          ? t("checkingStatus")
          : t("guestUser");

const accountSubtitle =
    session.status === "authenticated"
        ? t("authenticatedAccount")
        : session.status === "checking"
          ? t("readingSession")
          : t("noAccountConnected");
```

### 3. Updating JSX Elements
All hardcoded text nodes within the profile page's JSX were replaced with calls to `t()`. This included navigation links ("Back to Home"), page headers ("Your Profile", "Manage your account..."), error boundaries ("Failed to load profile", "Retry", "Sign In"), and action buttons/list items ("Sign In / Register", "Sign Out", "ABHA Setup", "ABHA Records", "Notification Settings", "Privacy & Security").

### 4. Locale Dictionary Updates
We added a nested `"Profile"` object containing 17 translation keys to all 19 locale JSON files in `apps/web/messages/`. Below is an example of the schema added to the files:

```json
"Profile": {
    "backToHome": "...",
    "title": "...",
    "subtitle": "...",
    "checkingStatus": "...",
    "guestUser": "...",
    "signedInUser": "...",
    "authenticatedAccount": "...",
    "readingSession": "...",
    "noAccountConnected": "...",
    "errorTitle": "...",
    "errorDescription": "...",
    "retry": "...",
    "signIn": "...",
    "signInRegister": "...",
    "signOut": "...",
    "abhaSetup": "...",
    "abhaRecords": "...",
    "notificationSettings": "...",
    "privacySecurity": "..."
}
```

## Technical Decisions

### Decoupling Business Logic from UI Localization
We chose to return `null` from `readSessionFromToken` rather than passing a translation function or context into it. This keeps our utility functions pure, testable, and independent of React-specific context or internationalization libraries. The UI component is the correct place to resolve presentation fallbacks.

### Namespace Isolation
We grouped all profile-related translation keys under a dedicated `"Profile"` namespace. This prevents key collisions in our large locale files and ensures that developers working on other parts of the application do not accidentally overwrite or duplicate keys.

## How To Re-Implement (Contributor Reference)

If you need to localize a new page or refactor an existing one using this pattern, follow these steps:

1. **Identify Hardcoded Strings in Utilities:**
   If a helper function outside the React component returns a string intended for the UI, refactor it to return `null` or a status code. Let the React component resolve the actual string using `useTranslations`.

2. **Import and Initialize `next-intl`:**
   At the top of your client or server component, import the hook:
   ```typescript
   import { useTranslations } from "next-intl";
   ```
   Initialize it inside your component with a specific namespace:
   ```typescript
   const t = useTranslations("YourNamespace");
   ```

3. **Replace JSX Text:**
   Replace static text with `{t("yourKey")}`. For dynamic states, use ternary operators or switch statements to map states to translation keys.

4. **Update All Locale Files:**
   Open `apps/web/messages/en.json` and append your namespace block. You must replicate this exact block structure across all other 18 regional language JSON files (e.g., `hi.json`, `ta.json`, `te.json`) to prevent missing key runtime warnings.

## Impact on System Architecture

This change completes the localization coverage for user account management, ensuring a seamless transition when a user switches languages on the platform. By standardizing on the `next-intl` namespace pattern, we keep our translation dictionaries modular and maintainable as SahiDawa scales its feature set (such as ABHA health record integrations).

## Testing & Verification

- **Visual Verification:** The profile page was verified across multiple locales (e.g., `/en/profile`, `/hi/profile`, `/as/profile`) to ensure that translations load correctly and do not break the layout.
- **Fallback Verification:** We verified that when a user is signed in but lacks a display name in their metadata, the system correctly falls back to the localized version of "Signed-in User" (e.g., "ছাইন-ইন ব্যৱহাৰকাৰী" in Assamese).
- **State Verification:** We tested the UI under three distinct states: authenticated, checking session (loading), and unauthenticated (guest) to ensure the correct localized titles and subtitles render.