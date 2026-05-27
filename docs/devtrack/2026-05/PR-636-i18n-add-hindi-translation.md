# PR #636 — I18n: Add Hindi translation

> **Merged:** 2026-05-27 | **Author:** @0411-bokilshruti | **Area:** Frontend | **Impact Score:** 14 | **Closes:** #515

## What Changed

This pull request introduces comprehensive Hindi (हिन्दी) language support to the SahiDawa frontend application. We have added a new translation file, `apps/web/messages/hi.json`, containing all necessary UI strings, and updated our internationalization configuration to enable Hindi as a selectable and routable language option across the platform.

## The Problem Being Solved

Before this change, SahiDawa lacked support for Hindi, the most widely spoken language in India with over 500 million speakers. This absence created a significant accessibility gap for a large segment of our target user base, particularly in regions like Uttar Pradesh, Bihar, Madhya Pradesh, Rajasthan, and Delhi. To fulfill SahiDawa's mission as an open-source Indian medicine verification and rural health platform, it is critical that our system is usable and understandable in the native languages of its users. The addition of Hindi directly addresses this by making the platform more inclusive and accessible.

## Files Modified

- `apps/web/app/[locale]/LanguageSwitcher.tsx`
- `apps/web/i18n/routing.ts`
- `apps/web/messages/hi.json`
- `apps/web/proxy.ts`

## Implementation Details

The implementation involved a series of coordinated changes across our `apps/web` Next.js frontend to integrate Hindi as a new locale:

1.  **New Translation File (`apps/web/messages/hi.json`):**
    *   A new JSON file was created to house all Hindi translations. This file follows the `next-intl` message format, organizing UI strings into logical key groups such as `Home`, `Navigation`, `VoicePage`, and `contact`.
    *   The file contains complete translations for all existing UI elements, including page titles, subtitles, button labels, error messages, voice triage flow instructions, emergency guidance, and contact page content. This ensures a consistent and fully localized experience when Hindi is selected.

2.  **Language Switcher Update (`apps/web/app/[locale]/LanguageSwitcher.tsx`):**
    *   The `languages` array within the `LanguageSwitcher` component was updated to include Hindi. A new object `{ code: "hi", label: "Hindi", native: "हिन्दी" }` was added.
    *   This modification makes Hindi available as an option in the frontend's language selection dropdown, allowing users to explicitly switch to the Hindi interface.

3.  **Internationalized Routing Configuration (`apps/web/i18n/routing.ts`):**
    *   The `locales` array within the `defineRouting` function (from `next-intl/routing`) was extended to include `'hi'`.
    *   This change registers Hindi as a recognized locale within our `next-intl` routing setup. It enables the application to generate and handle URL paths prefixed with `/hi/` (e.g., `/hi/home`), ensuring that the correct locale context is established for server-side rendering and client-side navigation.

4.  **Middleware Matcher Update (`apps/web/proxy.ts`):**
    *   The `matcher` array in the `config` object, which is used by our `next-intl` middleware, was updated to include `'hi'`.
    *   This ensures that the `createMiddleware(routing)` function correctly intercepts requests for paths like `/(hi)/:path*`, applying the internationalization logic to detect the locale from the URL and load the corresponding `hi.json` messages.

## Technical Decisions

Our system leverages the `next-intl` library for robust internationalization, and the technical decisions made in this PR align with our existing architecture:

*   **Leveraging `next-intl` for Consistency:** We chose to extend our existing `next-intl` configuration rather than implementing a new i18n mechanism. This decision maintains consistency with our current frontend stack, ensuring that locale detection, message loading, and routing are handled uniformly across all supported languages. This approach minimizes technical debt and simplifies future language additions.
*   **JSON File Format for Translations:** Storing translations in `apps/web/messages/hi.json` is a standard practice with `next-intl`. This allows for clear, human-readable key-value pairs, making translation management straightforward and enabling easy collaboration with translators.
*   **Comprehensive Initial Translation:** The decision to provide complete translations for all existing UI key groups (Home, Navigation, VoicePage, contact) from the outset was critical. For a health platform, partial translations can lead to confusion or misinterpretation of vital information. A full translation ensures a seamless and trustworthy user experience in Hindi.
*   **URL-based Locale Strategy:** Our system uses URL prefixes (e.g., `/hi/`) for locale identification, configured via `next-intl/routing` and the `proxy.ts` middleware. This approach provides clear, bookmarkable URLs for different languages and is SEO-friendly, making it easier for search engines to index localized content.

## How To Re-Implement (Contributor Reference)

To add another new language (e.g., French with locale code `fr`) to the SahiDawa frontend, a contributor would follow these steps:

1.  **Create the Translation File:**
    *   Create a new JSON file at `apps/web/messages/fr.json`.
    *   Populate this file with all necessary UI strings, ensuring it mirrors the structure and keys found in `apps/web/messages/en.json` or `apps/web/messages/hi.json`. All key groups (e.g., `Home`, `Navigation`, `VoicePage`, `contact`) must be translated.

2.  **Update the Language Switcher Component:**
    *   Open `apps/web/app/[locale]/LanguageSwitcher.tsx`.
    *   Locate the `languages` array.
    *   Add a new language object to this array:
        ```typescript
        { code: "fr", label: "French", native: "Français" },
        ```

3.  **Configure `next-intl` Routing:**
    *   Open `apps/web/i18n/routing.ts`.
    *   Locate the `locales` array within the `defineRouting` call.
    *   Add `'fr'` to this array:
        ```typescript
        export const routing = defineRouting({
          locales: ['en', 'ta', 'bn', 'te', 'mr', 'gu', 'ur', 'od', 'hi', 'fr'], // Add 'fr' here
          defaultLocale: 'en'
        });
        ```

4.  **Update the `next-intl` Middleware Matcher:**
    *   Open `apps/web/proxy.ts`.
    *   Locate the `matcher` array in the `config` object.
    *   Add `'fr'` to this array:
        ```typescript
        export const config = {
          // Match only internationalized pathnames
          matcher: ['/', '/(ta|en|bn|te|mr|gu|ur|od|hi|fr)/:path*'] // Add 'fr' here
        };
        ```

5.  **Verify Implementation:**
    *   Run the SahiDawa application locally (`npm run dev` in `apps/web`).
    *   Navigate to `http://localhost:3000/fr/` (or your local development URL).
    *   Verify that all UI elements are displayed in French.
    *   Test the language switcher to ensure you can switch to and from French successfully.
    *   Check console for any `next-intl` warnings about missing translation keys.

## Impact on System Architecture

This change significantly enhances the SahiDawa system's accessibility and scalability for internationalization.

*   **Expanded User Reach:** By integrating Hindi, we have made SahiDawa immediately accessible to hundreds of millions of new users, directly aligning with our platform's goal of serving the diverse linguistic landscape of India. This is a critical step towards broader adoption and impact in rural health.
*   **Validated i18n Architecture:** This PR confirms the robustness and extensibility of our `next-intl` based internationalization architecture. The process for adding a new language is now well-defined and requires minimal changes to core logic, primarily involving configuration updates and translation file creation. This paves the way for efficient future localization efforts for other Indian languages.
*   **Frontend Routing and Middleware:** The updates to `apps/web/i18n/routing.ts` and `apps/web/proxy.ts` reinforce that our Next.js application's internationalized routing and middleware are correctly configured to dynamically handle new locales. This ensures that new language versions of the site are properly routed and rendered without requiring complex architectural overhauls.
*   **Foundation for Multilingual Content:** While this PR focuses on UI strings, it lays the groundwork for future features that might involve multilingual content generation (e.g., AI responses in different languages, localized health alerts).

## Testing & Verification

The integration of Hindi translation was verified through a combination of manual testing and visual inspection:

*   **Manual UI Verification:** The author provided screenshots demonstrating the SahiDawa frontend rendered entirely in Hindi. These screenshots covered key sections like the Home page and the Voice Triage page, confirming that the `hi.json` translations were correctly loaded and applied to all visible UI elements. This included verification of text direction (Left-to-Right for Hindi) and character rendering.
*   **Language Switcher Functionality:** Although not explicitly detailed in the diff, the modification to `apps/web/app/[locale]/LanguageSwitcher.tsx` implies testing that Hindi can be successfully selected from the language dropdown, and the application correctly transitions to the `/hi/` locale.
*   **Routing Verification:** The changes to `apps/web/i18n/routing.ts` and `apps/web/proxy.ts` necessitate verification that direct navigation to `/hi/` prefixed URLs functions as expected, and the `next-intl` middleware correctly processes these requests to load the Hindi locale.

**Edge Cases:**

*   **Missing Translation Keys:** Our `next-intl` setup is configured to fall back to the `defaultLocale` (English) if a key is missing in `hi.json`. The PR description explicitly states "complete Hindi (Devanagari) translations covering all existing key groups," which mitigates this risk for the current scope.
*   **Font Support:** While not directly addressed in this PR, ensuring that the chosen frontend fonts adequately support the Devanagari script is a general consideration for rendering Hindi characters correctly.
*   **Voice Triage Language Support:** The `VoicePage` UI now displays Hindi translations for labels like "वॉयस भाषा" (Voice Language). However, the actual backend speech-to-text and AI processing for Hindi voice input is a separate concern and is not documented in this PR. This PR only localizes the frontend interface for the Voice Triage feature.