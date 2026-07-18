# PR #821 — [I18N] Localize offline page and banner using next-intl

> **Merged:** 2026-05-29 | **Author:** @himanithakre56 | **Area:** Frontend | **Impact Score:** 10 | **Closes:** #753

## What Changed

This pull request introduces full internationalization (i18n) support for our SahiDawa offline fallback page and the global offline banner. We refactored `apps/web/app/[locale]/offline/page.tsx` and `apps/web/components/OfflineBanner.tsx` to replace all hardcoded English strings with dynamic translation keys, leveraging our existing `next-intl` library and the `offline` translation namespace.

## The Problem Being Solved

Prior to this change, the critical user-facing messages displayed when a user lost internet connectivity were hardcoded in English. This presented a significant barrier to accessibility and usability for our diverse user base, particularly in rural India where multiple languages are spoken. Our system's commitment to providing a seamless experience, regardless of network status or preferred language, was compromised by this lack of localization in a crucial user flow. This PR addresses issue #753 by ensuring that even in an offline state, users receive information in their chosen language.

## Files Modified

- `apps/web/app/[locale]/offline/page.tsx`
- `apps/web/components/OfflineBanner.tsx`

## Implementation Details

This PR primarily involved refactoring existing React components to integrate `next-intl`'s `useTranslations` hook.

**1. `apps/web/app/[locale]/offline/page.tsx`:**
    *   We added `import { useTranslations } from "next-intl";` to the component.
    *   Inside the `OfflinePage` functional component, we initialized the translation hook: `const t = useTranslations("offline");`. This `t` function is now responsible for fetching strings from the `offline` namespace in our translation files (e.g., `messages/en.json`, `messages/hi.json`).
    *   All previously hardcoded English strings were replaced with calls to the `t` function, using specific keys:
        *   The "Back Online!" headline changed from `"Back Online!"` to `{t("bannerOnline")}`.
        *   The "Connection restored" description became `{t("descriptionOnline")}`.
        *   The main "You're Offline" headline was replaced with `{t("title")}`.
        *   The detailed description `SahiDawa needs an internet connection...` became `{t("description")}`.
        *   The subtitle `Please check your Wi-Fi or mobile data...` was replaced with `{t("subtitle")}`.
        *   The "Try Again" button text became `{isRetrying ? "Checking connection…" : t("tryAgain")}`.
        *   The "Go to Home" link text became `{t("goHome")}`.
        *   The footer text `SahiDawa will automatically sync...` was replaced with `{t("footer")}`.
    *   The existing logic for connection detection, retry mechanisms, and redirection remains untouched, ensuring functional stability.

**2. `apps/web/components/OfflineBanner.tsx`:**
    *   Similarly, we added `import { useTranslations } from "next-intl";` to this component.
    *   Inside the `OfflineBanner` functional component, we initialized `const t = useTranslations("offline");`.
    *   The dynamic banner text, which previously toggled between "You are offline" and "Back online", was updated to use translation keys: `{isCurrentlyOffline ? t("bannerOffline") : t("bannerOnline")}`.
    *   The descriptive text below the banner title, which provided more context (e.g., "Medicine search and AI chat are unavailable"), was also localized: `{isCurrentlyOffline ? t("descriptionOffline") + (isTestMode ? " · Test mode" : "") : t("descriptionOnline")}`.
    *   The `aria-label` for the dismiss button, crucial for accessibility, was updated from `"Dismiss offline notification"` to `{t("dismiss")}`.
    *   The component's state management (`isDismissed`, `isVisible`) and the `useOfflineStatus` hook remain unchanged, focusing the PR purely on the presentation layer.

In both components, the `offline` namespace was consistently used, ensuring that all related translation keys are grouped logically within our `next-intl` message files.

## Technical Decisions

Our primary technical decision was to leverage `next-intl`, our established internationalization library for the Next.js frontend. This choice was made for several key reasons:

1.  **Consistency:** `next-intl` is already integrated into the `apps/web` project, and using it for the offline UI ensures a consistent approach to localization across the entire application. This reduces cognitive load for developers and streamlines our i18n workflow.
2.  **Maintainability:** By using `useTranslations("offline")`, we explicitly scope the translation keys to a dedicated namespace. This prevents key collisions, improves the organization of our translation files, and makes it easier for translators to understand the context of each string.
3.  **Leveraging Existing Infrastructure:** Instead of introducing a new i18n solution or custom logic, we built upon our existing `next-intl` setup. This minimizes technical debt and ensures compatibility with our current routing and locale management strategies.
4.  **Developer Experience:** The `useTranslations` hook provides a clean and idiomatic React way to access translations, making the code readable and easy to maintain for future contributors.

No alternative i18n libraries were considered, as `next-intl` is our chosen standard for the Next.js frontend. The decision was purely on how to best integrate the existing solution into these specific components.

## How To Re-Implement (Contributor Reference)

Should a similar localization task be required for another component, or if this feature needs to be re-implemented, here are the steps we followed:

1.  **Verify `next-intl` Setup:** Ensure that `next-intl` is correctly installed and configured in the `apps/web` project. This includes having `next-intl` providers wrapping the application and locale-specific message files (e.g., `messages/en.json`, `messages/hi.json`) structured with appropriate namespaces. For this PR, the `offline` namespace was used.
2.  **Identify Target Component:** Locate the React functional component that contains hardcoded strings needing localization (e.g., `OfflinePage`, `OfflineBanner`).
3.  **Import `useTranslations`:** At the top of the component file, add the import statement:
    ```typescript
    import { useTranslations } from "next-intl";
    ```
4.  **Initialize Translator Hook:** Inside the functional component, at the top, call the `useTranslations` hook, specifying the relevant namespace. For this PR, it was `offline`:
    ```typescript
    export default function MyComponent() {
        const t = useTranslations("offline"); // Or 'common', 'home', etc.
        // ... rest of the component logic
    }
    ```
5.  **Replace Hardcoded Strings:** Iterate through the component's JSX and replace every hardcoded string with a call to the `t` function, passing a unique key for that string.
    *   **Example for text content:**
        ```jsx
        // Before
        <p>Hello World</p>
        // After
        <p>{t("helloWorld")}</p>
        ```
    *   **Example for attributes (like `aria-label`):**
        ```jsx
        // Before
        <button aria-label="Close" />
        // After
        <button aria-label={t("closeButtonLabel")} />
        ```
    *   **Example for dynamic strings:**
        ```jsx
        // Before
        <p>{isOnline ? "Online" : "Offline"}</p>
        // After
        <p>{isOnline ? t("statusOnline") : t("statusOffline")}</p>
        ```
6.  **Update Translation Files:** Add the new translation keys and their corresponding localized values to the appropriate `messages/{locale}.json` files under the specified namespace (`offline` in this case).
    *   Example `messages/en.json`:
        ```json
        {
          "offline": {
            "title": "You're Offline",
            "description": "SahiDawa needs an internet connection...",
            "bannerOnline": "Back Online!",
            "dismiss": "Dismiss offline notification"
          }
        }
        ```
7.  **Test Thoroughly:**
    *   Run the application locally.
    *   Navigate to the component's route (e.g., `/en/offline`, `/hi/offline`).
    *   Change the locale in the URL to verify translations for each supported language.
    *   For components like `OfflinePage` and `OfflineBanner`, simulate network conditions (e.g., using Chrome DevTools' Network tab to go "Offline") to ensure the correct localized messages are displayed in different connectivity states.

## Impact on System Architecture

This change significantly enhances the SahiDawa frontend architecture in several ways:

1.  **Improved User Experience (UX):** By localizing critical offline messages, we directly improve the accessibility and usability of our platform for users who prefer or require content in languages other than English. This is crucial for SahiDawa's mission in diverse linguistic regions of India.
2.  **Reinforced i18n Strategy:** This PR solidifies `next-intl` as the standard and robust solution for internationalization across our Next.js frontend. It demonstrates the scalability of our current i18n setup to even critical, system-level messages.
3.  **Enhanced Maintainability:** Centralizing translation strings within `messages/*.json` files, under a clear `offline` namespace, makes it easier for our team and future contributors to manage, update, and add new language support without touching the core UI logic. This separation of concerns is a key architectural principle.
4.  **No Backend Impact:** This change is entirely confined to the frontend presentation layer. It does not affect our backend services, API contracts, or database schema, ensuring minimal risk and focused development.
5.  **Foundation for Future Localization:** With the offline experience now fully localized, we have a stronger foundation to extend i18n efforts to other parts of the application, ensuring a consistently multilingual experience throughout SahiDawa.

## Testing & Verification

The author performed comprehensive local testing and verification for this change:

1.  **Multilingual Behavior:** The author verified that the offline page and banner displayed correctly across different localized routes (e.g., `/en/offline`, `/hi/offline`), confirming that `next-intl` was correctly fetching and rendering the appropriate strings for each locale.
2.  **Offline Simulation:** The core functionality was tested by simulating an offline network state in the browser (using the Network tab in developer tools). This confirmed that the `OfflinePage` was rendered correctly and the `OfflineBanner` appeared as expected, both with localized content.
3.  **Screenshots/Proof of Work:** Screenshots were provided to visually demonstrate:
    *   The offline page displaying localized content.
    *   The global offline banner appearing with localized messages during an offline simulation.
    *   The translation behavior working correctly when switching between localized routes.

**Edge Cases:**
*   **Missing Translation Keys:** If a translation key used in `t("key")` is missing from the `offline` namespace in a specific locale's message file, `next-intl` typically falls back to the default locale's value or displays the key itself, depending on configuration. This behavior is understood and handled by our `next-intl` setup.
*   **Dynamic Content:** The PR correctly handles dynamic content within strings (e.g., `(Attempt {retryCount})` or `(isTestMode ? " · Test mode" : "")`) by concatenating the dynamic part with the translated string, ensuring flexibility.
*   **Connectivity Restoration:** The existing logic for detecting when the connection is restored and redirecting the user remains unchanged and was implicitly verified as part of the offline simulation.