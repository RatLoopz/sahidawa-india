# PR #778 — fix(i18n): localize homepage navigation strings

> **Merged:** 2026-05-27 | **Author:** @shashank03-dev | **Area:** i18n | **Impact Score:** 44 | **Closes:** #754

## What Changed

This pull request significantly enhances the internationalization of the SahiDawa homepage by migrating all remaining hardcoded user-facing strings into our `next-intl` translation message files. This includes critical elements such as the desktop "My Reports" link, the "AI Health Assistant" call-to-action, the "Live CDSCO Alerts" panel, the alert empty state messages, the "View Full Alert Log" button, and all labels within the mobile bottom navigation bar. We also introduced a new regression test to validate the correct usage of translation keys and their presence across all locale files.

## The Problem Being Solved

Prior to this PR, several key user interface elements on the SahiDawa homepage (`apps/web/app/[locale]/page.tsx`) contained hardcoded English strings. This directly hindered our goal of providing an accessible and localized experience for users across various linguistic regions in India. Regardless of the language selected via our `LanguageSwitcher`, these specific strings would always display in English, creating an inconsistent and potentially confusing user experience. This limitation prevented SahiDawa from fully serving its rural health platform mission where local language support is paramount for effective communication and trust.

## Files Modified

- `apps/web/app/[locale]/page.tsx`
- `apps/web/messages/bn.json`
- `apps/web/messages/en.json`
- `apps/web/messages/gu.json`
- `apps/web/messages/hi.json`
- `apps/web/messages/kn.json`
- `apps/web/messages/mr.json`
- `apps/web/messages/od.json`
- `apps/web/messages/pa.json`
- `apps/web/messages/sa.json`
- `apps/web/messages/ta.json`
- `apps/web/messages/te.json`
- `apps/web/messages/ur.json`
- `apps/web/tests/homepage-i18n.test.tsx`

## Implementation Details

Our implementation involved a systematic approach to identify, extract, and replace hardcoded strings with `next-intl` translation calls, coupled with robust testing.

1.  **Frontend Component (`apps/web/app/[locale]/page.tsx`):**
    *   We integrated `useTranslations` from `next-intl` within the `SahiDawaHome` component. Specifically, two translation functions were instantiated: `const tHome = useTranslations('Home');` and `const tNav = useTranslations('Navigation');`. These functions are responsible for fetching translated strings from the `Home` and `Navigation` namespaces, respectively.
    *   All identified hardcoded strings were replaced with dynamic calls to these translation functions. Examples include:
        *   The desktop "My Reports" link text changed from `My Reports` to `{tNav("my_reports")}`.
        *   The "Open AI Health Assistant" `aria-label` was updated to `aria-label={tHome("open_ai_health_assistant")}`.
        *   The visible "AI Health Assistant" text became `{tHome("ai_health_assistant")}`.
        *   The "AI Chat" label in the animated badge was replaced with `{tHome("ai_chat")}`.
        *   The descriptive text for the AI Health Assistant banner, "Get instant health advice, symptom checking & prescription guidance", was replaced by `{tHome("ai_health_assistant_description")}`.
        *   The "Chat Now" button text became `{tHome("chat_now")}`.
        *   The "Live CDSCO Alerts" heading was updated to `{tHome("live_cdsco_alerts")}`.
        *   The "India Region" label for alerts was replaced with `{tHome("india_region")}`.
        *   The `EmptyState` component's `title` and `description` props, previously "All clear!" and "No active regulatory alerts right now. Stay safe and verify your medicines.", now use `{tHome("alerts_empty_title")}` and `{tHome("alerts_empty_description")}`.
        *   The "View Full Alert Log" button text was updated to `{tHome("view_full_alert_log")}`.
        *   The mobile bottom navigation `aria-label` and visible text for "Home", "Scans", "Map", "Alerts", and "Profile" were replaced with calls like `aria-label={tNav("home")}` and `{tNav("home")}` respectively.

2.  **Locale Message Files (`apps/web/messages/*.json`):**
    *   For each of our supported locales (Bengali `bn.json`, English `en.json`, Gujarati `gu.json`, Hindi `hi.json`, Kannada `kn.json`, Marathi `mr.json`, Odia `od.json`, Punjabi `pa.json`, Sanskrit `sa.json`, Tamil `ta.json`, Telugu `te.json`, Urdu `ur.json`), we added new keys under two primary namespaces: `Home` and `Navigation`.
    *   **`Home` namespace keys added:** `open_ai_health_assistant`, `ai_health_assistant`, `ai_chat`, `ai_health_assistant_description`, `chat_now`, `live_cdsco_alerts`, `india_region`, `alerts_empty_title`, `alerts_empty_description`, `view_full_alert_log`, `sign_in`, `get_started`, `subtitle`. Each key was populated with its corresponding translated string for that specific locale.
    *   **`Navigation` namespace keys added:** `my_reports`, `home`, `scans`, `map`, `alerts`, `profile`. Similarly, these were populated with their respective translations.
    *   This ensures that `next-intl` has the necessary data to render the correct strings based on the active locale.

3.  **Regression Test (`apps/web/tests/homepage-i18n.test.tsx`):**
    *   A new Jest test suite was introduced to provide automated verification of the i18n implementation on the homepage.
    *   This test is designed to render the `SahiDawaHome` component within a testing environment and assert that specific UI elements display translated content rather than hardcoded English strings.
    *   Additionally, the PR included a programmatic check (executed via a Node.js script during the CI/CD process) that iterates through all `apps/web/messages/*.json` files to ensure that every required `Home` and `Navigation` key is present and has a non-empty string value. This acts as a safeguard against missing translations.

## Technical Decisions

1.  **Continued Use of `next-intl`:** We chose to continue leveraging `next-intl` for our frontend internationalization. This decision aligns with our existing technology stack for the `apps/web` Next.js application, providing a consistent and robust framework for managing translations. `next-intl`'s support for server-side rendering (SSR) of translations is crucial for optimal performance and SEO, ensuring that localized content is available immediately upon page load.
2.  **Namespace Organization (`Home`, `Navigation`):** Grouping translation keys under logical namespaces like `Home` and `Navigation` was a deliberate choice to improve maintainability and clarity. This structure prevents key collisions, makes it easier for developers and translators to locate specific strings, and provides context for each translation, which is vital for accurate localization.
3.  **Comprehensive Homepage Localization:** The decision to localize *all* remaining hardcoded strings on the homepage was made to ensure a complete and seamless user experience from the very first interaction. A partially translated homepage would undermine user trust and accessibility, especially for users in diverse linguistic regions who rely on local language support.
4.  **Automated Regression Testing:** The addition of `apps/web/tests/homepage-i18n.test.tsx` and the locale key validation script was a critical technical decision. This proactive measure ensures that our i18n efforts are resilient to future code changes. It prevents regressions where hardcoded strings might be accidentally reintroduced or new translation keys might be overlooked in specific locale files, thereby maintaining the high quality of our localization.

## How To Re-Implement (Contributor Reference)

Should a similar localization task be required for another component, a contributor would follow these steps:

1.  **Identify Hardcoded Strings:** Begin by thoroughly reviewing the target React component (e.g., `apps/web/app/[locale]/some-other-page.tsx`) to identify all user-facing text strings, including visible text, `aria-label` attributes, `alt` text, and component props that accept text.
2.  **Define Translation Keys and Namespaces:** For each identified string, create a unique, descriptive key using `snake_case` (e.g., `product_description`, `add_to_cart_button`). Determine an appropriate namespace (e.g., `ProductPage`, `Checkout`) to group related keys logically.
3.  **Update All Locale Files:**
    *   Navigate to the `apps/web/messages/` directory.
    *   For *every* `.json` file present (e.g., `en.json`, `hi.json`, `bn.json`), add the newly defined keys under their respective namespaces.
    *   **Example for `en.json` (assuming a new `ProductPage` namespace):**
        ```json
        {
          "ProductPage": {
            "product_title": "SahiDawa Medicine",
            "product_description": "Verify your medicines instantly.",
            "add_to_cart_button": "Add to Cart"
          },
          // ... other namespaces
        }
        ```
    *   Ensure that each key has a non-empty string value for all locales. For new locales, placeholder values might be used initially, but they must be translated before merging.
4.  **Integrate `useTranslations` in the Component:**
    *   In the target React component, import `useTranslations` from `next-intl`.
    *   Instantiate a translation function for the new namespace: `const tProductPage = useTranslations('ProductPage');`.
    *   Replace the hardcoded strings with calls to this translation function, passing the appropriate key.
    *   **Example:**
        ```typescript jsx
        // Before
        // <h1 className="text-2xl">SahiDawa Medicine</h1>
        // After
        <h1 className="text-2xl">{tProductPage("product_title")}</h1>

        // Before
        // <button aria-label="Add to Cart">Add to Cart</button>
        // After
        <button aria-label={tProductPage("add_to_cart_button")}>{tProductPage("add_to_cart_button")}</button>
        ```
5.  **Add Regression Tests:**
    *   Create a new test file (e.g., `apps/web/tests/some-other-page-i18n.test.tsx`).
    *   Use `@testing-library/react` to render the component.
    *   Set up a mock `next-intl` provider to supply test translations.
    *   Assert that the rendered component displays the translated text correctly (e.g., `expect(screen.getByText('Translated Product Title')).toBeInTheDocument();`).
    *   Consider adding a programmatic check (similar to the Node.js script in this PR) to your CI/CD pipeline or as a pre-commit hook to validate that all locale files contain the newly required keys.
6.  **Local Verification:** Run the application locally (`npm run dev -w web`) and navigate to the component's page. Use the `LanguageSwitcher` to switch between different locales (e.g., `/en`, `/hi`) and visually confirm that all targeted strings are correctly translated.

## Impact on System Architecture

This PR has a significant positive impact on the SahiDawa system architecture, particularly for the `apps/web` frontend:

*   **Enhanced Internationalization Foundation:** By fully localizing the homepage, we have solidified the foundation for comprehensive i18n across the entire platform. This sets a clear precedent and pattern for future localization efforts in other components and pages.
*   **Improved User Experience and Accessibility:** A fully translated homepage removes a major barrier for non-English speaking users, making SahiDawa more accessible and user-friendly. This directly supports our mission to reach and serve diverse communities in rural India, fostering trust and engagement.
*   **Increased Maintainability and Scalability:** Centralizing all user-facing strings in `.json` files, organized by namespaces, drastically improves the maintainability of our codebase. Future text updates or the addition of new languages will be simpler, more consistent, and less prone to errors, allowing us to scale our linguistic support more efficiently.
*   **Robustness Against Regressions:** The introduction of automated tests for i18n key usage and presence ensures that our localization efforts are resilient. This prevents accidental reintroduction of hardcoded strings or omission of translation keys in new features, safeguarding the integrity of our multilingual platform.
*   **Clearer Development Workflow:** The established pattern for integrating `next-intl` and managing translation files provides a clear and consistent workflow for contributors, reducing the learning curve for new developers working on localization tasks.

## Testing & Verification

We performed a comprehensive set of tests and verifications to ensure the correctness and stability of this change:

1.  **Local Browser Verification:** The author manually performed visual checks by:
    *   Opening `http://127.0.0.1:3000/en` to verify the English translations.
    *   Using the language switcher to select Hindi, navigating to `http://127.0.0.1:3000/hi`.
    *   Confirmed that the following elements displayed correctly translated text: `My Reports`, `AI Health Assistant`, `AI Chat`, `Live CDSCO Alerts`, `All clear!`, `View Full Alert Log`, and the mobile bottom navigation labels (`Home`, `Scans`, `Map`, `Alerts`, `Profile`). This validated the functional integration of `next-intl` and the visual correctness of the translations.

2.  **Hardcoded String Scan (`rg`):** A `ripgrep` command was executed (`rg -n 'My Reports|Open AI Health Assistant|AI Health Assistant|AI Chat|Chat Now|Get instant health advice|Live CDSCO Alerts|India Region|All clear!|No active regulatory alerts|View Full Alert Log|aria-label="(Home|Scans|Map|Alerts|Profile)"' apps/web/app/[locale]/page.tsx || true`). This command confirmed that the previously hardcoded strings were successfully removed from `apps/web/app/[locale]/page.tsx`, ensuring that all targeted text is now sourced from translation files.

3.  **Locale Key Validation Script:** A Node.js script was run to programmatically validate the integrity of our translation files. This script iterated through all `.json` files in `apps/web/messages` and verified that:
    *   All required `Home` keys (`open_ai_health_assistant`, `ai_health_assistant`, `ai_chat`, `ai_health_assistant_description`, `chat_now`, `live_cdsco_alerts`, `india_region`, `alerts_empty_title`, `alerts_empty_description`, `view_full_alert_log`) were present.
    *   All required `Navigation` keys (`my_reports`, `home`, `scans`, `map`, `profile`) were present.
    *   The values for these keys were non-empty strings in every locale file. This critical check prevents missing translations or empty strings from reaching production.

4.  **Linting:** `npx eslint 'apps/web/app/[locale]/page.tsx' 'apps/web/tests/homepage-i18n.test.tsx'` was executed to ensure that the modified and new files adhered to our established code style and quality guidelines.

5.  **TypeScript Compilation:** `npx tsc --noEmit -p apps/web/tsconfig.json` was run to confirm that the changes did not introduce any TypeScript compilation errors, maintaining type safety across the `apps/web` application.

6.  **Unit/Integration Tests:** `npm run test -w web -- --runInBand` was executed, resulting in `18 passed, 18 total` test suites and `111 passed, 111 total` tests. This included the newly added `apps/web/tests/homepage-i18n.test.tsx`, which specifically validates the correct rendering of translated content on the homepage.

7.  **Production Build:** `npm run build -w web` was successfully completed, confirming that the `apps/web` application could be built for production without any issues, indicating no build-time regressions.

**Edge Cases:** Not documented in this PR.