# PR #629 — i18n(od): Added Odia Translation

> **Merged:** 2026-05-26 | **Author:** @subham146 | **Area:** Frontend | **Impact Score:** 14 | **Closes:** #499

## What Changed

This pull request introduces comprehensive Odia (ଓଡ଼ିଆ) language support to the SahiDawa web application. It adds a new translation file (`od.json`), registers Odia as a supported locale within our `next-intl` configuration, and updates the language switcher component to allow users to select Odia. This enables the entire frontend interface, including core sections like Home, Navigation, Voice Triage, Offline, and Contact, to be displayed in Odia.

## The Problem Being Solved

Our mission at SahiDawa is to provide an accessible and reliable health platform for all Indians. Prior to this PR, Odia-speaking users, particularly those in Odisha, were unable to interact with the SahiDawa web application in their native language. This created a significant barrier to adoption and usability for a large segment of our target audience, hindering our goal of inclusive rural health verification. By adding Odia translation, we are making the platform more intuitive, user-friendly, and culturally relevant for millions of Odia speakers, thereby expanding our reach and impact.

## Files Modified

- `apps/web/app/[locale]/LanguageSwitcher.tsx`
- `apps/web/i18n/routing.ts`
- `apps/web/messages/od.json`
- `apps/web/proxy.ts`

## Implementation Details

The implementation leverages our existing `next-intl` internationalization framework within the `apps/web` Next.js frontend.

1.  **New Translation File (`apps/web/messages/od.json`):**
    A new JSON file, `od.json`, was created under the `apps/web/messages/` directory. This file contains all the key-value pairs for the Odia translations. The structure follows the `next-intl` message format, with nested objects for different application sections such as `Home`, `Navigation`, `VoicePage`, `offline`, and `contact`. For example, `Home.title` holds the Odia translation for the main home page title. The translations within this file have been specifically crafted to be natural, conversational, and accessible, prioritizing modern app terminology suitable for everyday smartphone users.

2.  **Routing Configuration Update (`apps/web/i18n/routing.ts`):**
    The `routing` constant, defined using `next-intl/routing`'s `defineRouting` function, was updated. The `locales` array within this configuration was expanded to include `'od'`. This change informs `next-intl` that Odia is now a supported locale, enabling locale-aware routing (e.g., `/od/home` for the Odia home page) and ensuring that the correct message file is loaded based on the URL path. The updated `locales` array now includes `['en', 'ta', 'bn', 'te', 'mr', 'gu', 'ur', 'od']`.

3.  **Language Switcher Component Update (`apps/web/app/[locale]/LanguageSwitcher.tsx`):**
    The `LanguageSwitcher` React component, responsible for rendering the UI element that allows users to change the application language, was modified. The `languages` array within this component was updated to include a new entry for Odia: `{ code: "od", label: "Odia", native: "ଓଡ଼ିଆ" }`. This addition makes "Odia" visible and selectable in the language dropdown or selector presented to the user, allowing them to switch to the newly supported language.

4.  **Middleware Configuration Update (`apps/web/proxy.ts`):**
    Our `next-intl` middleware, created via `createMiddleware(routing)`, is configured in `apps/web/proxy.ts`. The `config` object's `matcher` property, which uses a regular expression to match internationalized pathnames, was updated. The regex `/(ta|en|bn|te|mr|gu|ur|od)/:path*` now explicitly includes `'od'`. This ensures that requests with `/od/` in their path are correctly intercepted and processed by the `next-intl` middleware, applying the appropriate locale context for server-side rendering and routing.

## Technical Decisions

Our system continues to rely on the `next-intl` library for internationalization, a robust and well-supported solution for Next.js applications. This decision was reaffirmed with the addition of Odia, as `next-intl` seamlessly handles locale-based routing, message loading, and provides hooks for components to access translated strings.

The choice to use a dedicated JSON file (`od.json`) for Odia translations aligns with `next-intl`'s recommended practice for managing message dictionaries. This approach keeps translations organized, easily auditable, and separate from application logic, simplifying the process for translators and developers.

The emphasis on "natural, conversational, and highly accessible" language in the translations is a deliberate user experience decision. Instead of literal word-for-word translations, we prioritize how a native Odia speaker would naturally interact with a modern smartphone application. This ensures that the SahiDawa platform feels intuitive and familiar, reducing cognitive load and improving user engagement.

Integrating the new locale into the `routing.ts` and `proxy.ts` files ensures that Odia is treated as a first-class language within our application's routing and middleware layers. This means that features like automatic locale detection, URL-based locale switching, and server-side rendering with the correct language context are all supported out-of-the-box for Odia, consistent with our other supported languages.

## How To Re-Implement (Contributor Reference)

To add a new language, say "XYZ" with code "xy", to the SahiDawa web application, a contributor would follow these steps:

1.  **Create the Message File:**
    *   Create a new JSON file: `apps/web/messages/xy.json`.
    *   Populate this file with all the necessary key-value pairs for the UI strings. It's recommended to copy an existing language file (e.g., `en.json`) as a template and replace the values with the new language's translations.
    *   Ensure the translations are natural, conversational, and contextually appropriate for the target audience, reflecting modern app terminology.
    *   Example structure:
        ```json
        {
            "Home": {
                "title": "Your health, verified and secure."
                // ... other keys
            },
            "Navigation": {
                "language": "XYZ"
                // ... other keys
            }
        }
        ```

2.  **Register the Locale for Routing:**
    *   Open `apps/web/i18n/routing.ts`.
    *   Locate the `locales` array within the `defineRouting` function.
    *   Add the new language code `'xy'` to this array.
    *   Example diff:
        ```diff
        -  locales: ['en', 'ta', 'bn', 'te', 'mr', 'gu', 'ur'],
        +  locales: ['en', 'ta', 'bn', 'te', 'mr', 'gu', 'ur', 'xy'],
        ```

3.  **Update the Language Switcher UI:**
    *   Open `apps/web/app/[locale]/LanguageSwitcher.tsx`.
    *   Locate the `languages` array.
    *   Add a new object for the new language, including its code, label, and native name.
    *   Example diff:
        ```diff
        -  { code: "ur", label: "Urdu", native: "اردو" }
        +  { code: "ur", label: "Urdu", native: "اردو" },
        +  { code: "xy", label: "XYZ", native: "XYZ Native Name" }
        ```

4.  **Configure the i18n Middleware:**
    *   Open `apps/web/proxy.ts`.
    *   Locate the `matcher` property within the `config` object.
    *   Add the new language code `'xy'` to the regular expression.
    *   Example diff:
        ```diff
        -  matcher: ['/', '/(ta|en|bn|te|mr|gu|ur)/:path*']
        +  matcher: ['/', '/(ta|en|bn|te|mr|gu|ur|xy)/:path*']
        ```

5.  **Verify Locally:**
    *   Run the application locally (`npm run dev` or `yarn dev`).
    *   Navigate to the application and use the language switcher to select the newly added language.
    *   Verify that all UI elements display the correct translations and that routing works as expected (e.g., `/xy/home`).
    *   Check for any console errors related to missing translations or routing issues.

This process ensures that the `next-intl` library correctly identifies, loads, and serves the new language across the application.

## Impact on System Architecture

This change primarily impacts the frontend architecture by expanding its internationalization capabilities.

1.  **Enhanced Accessibility and Reach:** The most significant impact is on user accessibility. By supporting Odia, SahiDawa can now effectively serve a larger and more diverse user base, particularly in Odisha, directly aligning with our platform's mission to provide health verification and rural health services across India. This unlocks potential for greater adoption and impact in previously underserved linguistic communities.

2.  **Reinforcement of `next-intl` Architecture:** This PR reinforces our existing `next-intl` based internationalization architecture. It demonstrates the scalability and flexibility of our current setup, confirming that adding new languages is a well-defined and straightforward process. This validates `next-intl` as a suitable long-term solution for our multilingual requirements.

3.  **Increased Translation Asset Volume:** The addition of `apps/web/messages/od.json` increases the total number of translation files and the overall size of our frontend assets. While this is a necessary trade-off for multilingual support, it means that future build processes will include more data.

4.  **Ongoing Maintenance Overhead:** Each new language introduces a recurring maintenance overhead. As new features are developed or existing strings are modified, the `od.json` file will need to be updated to ensure consistency and completeness of the Odia translation. This necessitates a robust process for managing translations and engaging with community translators.

5.  **No Core Logic Changes:** Crucially, this PR does not introduce any changes to the core business logic, data models, or backend services. The impact is confined to the presentation layer, demonstrating a clean separation of concerns within our system architecture.

## Testing & Verification

The following steps were taken to test and verify this change:

1.  **Local Development Server Verification:** The author confirmed that the project ran locally without any compile or build errors, ensuring the new files and modifications did not break the existing application.
2.  **Visual Confirmation via Screenshots:** A screenshot was provided in the PR description, demonstrating the SahiDawa web application interface rendered entirely in Odia. This visually confirmed that the translations were correctly loaded and displayed across various UI elements, including navigation, buttons, and content areas.
3.  **Manual UI Navigation:** It is implied that the author manually navigated through the core application interfaces (Home, Navigation, Voice Triage, Offline, Contact sections) after switching to Odia to ensure all translated strings were present and correctly rendered.
4.  **Locale Switching Functionality:** The update to `LanguageSwitcher.tsx` and `i18n/routing.ts` implies testing the ability to switch to Odia from another language and vice-versa, ensuring the routing and message loading mechanisms functioned as expected.

**Edge Cases (Not documented in this PR, but typically considered):**

*   **Missing Translations:** What happens if a key is present in `en.json` but missing in `od.json`? Our `next-intl` setup typically falls back to the `defaultLocale` (English) or displays the key itself, which would be an important check.
*   **Dynamic Content:** If any content is dynamically loaded or generated, ensuring it respects the active Odia locale.
*   **Text Overflow/Layout Issues:** Odia text can have different lengths and character widths compared to English, which might lead to UI elements overflowing or misaligning. Visual inspection across different screen sizes would typically address this.
*   **Accessibility (Screen Readers):** Ensuring that screen readers correctly announce Odia text and that the `lang` attribute is correctly set on the `<html>` tag for accessibility tools.
*   **Browser Compatibility:** Verifying that Odia fonts render correctly across different browsers and operating systems.