# PR #884 — i18n(kn,te): complete Kannada and Telugu translations

> **Merged:** 2026-05-30 | **Author:** @Ashitha0409 | **Area:** i18n | **Impact Score:** 9 | **Closes:** #795

## What Changed

This pull request completes the localization of the SahiDawa web application for Kannada (kn) and Telugu (te) languages. We have translated all 166 keys in `apps/web/messages/kn.json` and `apps/web/messages/te.json` to match the reference `en.json` file, ensuring a fully localized user experience. Additionally, we extended our `i18n-locales.test.tsx` test suite to include coverage for Telugu, verifying its integration into our routing configuration and native language label display.

## The Problem Being Solved

Prior to this PR, the Kannada and Telugu localizations were incomplete, as indicated by their "🔜 Open" status in our `README.md` and the presence of untranslated English strings within `kn.json` and `te.json`. This meant that users selecting Kannada or Telugu would still encounter English text for certain UI elements, particularly for `sign_in`, `get_started`, `switch_to_text_button`, and several voice error messages. This inconsistency degraded the user experience and hindered our progress towards SahiDawa's strategic goal of providing full support for all 22 Indian scheduled languages, as tracked in issue #795. The lack of explicit test coverage for Telugu also meant that future regressions in its i18n configuration might not be immediately caught.

## Files Modified

- `README.md`
- `apps/web/messages/kn.json`
- `apps/web/messages/te.json`
- `apps/web/tests/i18n-locales.test.tsx`

## Implementation Details

The core of this change involved updating two primary translation files within our `apps/web/messages/` directory: `kn.json` and `te.json`.

1.  **Translation Completion:**
    *   In `apps/web/messages/kn.json`, all 166 keys were translated to Kannada. Specifically, the previously untranslated English values for `"sign_in": "Sign In"` were updated to `"sign_in": "ಪ್ರವೇಶಿಸಿ"`, and `"get_started": "Get Started"` was updated to `"get_started": "ಪ್ರಾರಂಭಿಸಿ"`.
    *   Similarly, in `apps/web/messages/te.json`, all 166 keys were translated to Telugu. This included fixing `"sign_in": "Sign In"` to `"sign_in": "ప్రవేశించండి"`, `"get_started": "Get Started"` to `"get_started": "ప్రారంభించండి"`, and `"switch_to_text_button": "Type Instead"` to `"switch_to_text_button": "బదులుగా టైప్ చేయండి"`. Crucially, four voice error strings were also translated:
        *   `"service_unavailable_title": "Voice service unavailable"` became `"service_unavailable_title": "వాయిస్ సేవ అందుబాటులో లేదు"`
        *   `"service_unavailable_message": "Our voice servers are currently under heavy load. Please try again or type your symptoms instead."` became `"service_unavailable_message": "మా వాయిస్ సర్వర్లపై ప్రస్తుత భారం ఎక్కువగా ఉంది. దయచేసి మళ్లీ ప్రయత్నించండి లేదా బదులుగా మీ లక్షణాలను టైప్ చేయండి."`
        *   `"timeout_title": "Voice request timed out"` became `"timeout_title": "వాయిస్ అభ్యర్థనకు సమయం ముగిసింది"`
        *   `"timeout_message": "The voice service is taking longer than expected. Please try again or switch to text input."` became `"timeout_message": "వాయిస్ సేవ అంచనా కంటే ఎక్కువ సమయం తీసుకుంటోంది. దయచేసి మళ్లీ ప్రయత్నించండి లేదా టెక్స్ట్ ఇన్‌పుట్‌కు మారండి."`

2.  **Test Coverage Extension:**
    *   The existing `apps/web/tests/i18n-locales.test.tsx` file, which uses Jest for testing, was updated to include Telugu in its parameterized tests.
    *   The `it.each` block responsible for verifying locale availability in the `next-intl` routing configuration was modified from `it.each(["kn", "pa"])` to `it.each(["kn", "te", "pa"])`. This ensures that our `routing.locales` array, which is mocked from `next-intl/routing`, correctly contains "te".
    *   The `it.each` block that checks for the display of native language labels was also updated. A new entry `["te", "తెలుగు"]` was added to the array, ensuring that when `activeLocale` is set to "te", the `useTranslations("LocaleSwitcher")("te")` call correctly returns "తెలుగు". This confirms that our `LocaleSwitcher` component will display the appropriate native label for Telugu.

3.  **Documentation Update:**
    *   The `README.md` file was updated to reflect the completed translation status. The lines for Telugu and Kannada were changed from `| Telugu (తెలుగు) | 🔜 Open | — |` and `| Kannada (ಕನ್ನಡ) | 🔜 Open | — |` to `| Telugu (తెలుగు) | ✅ Complete | GSSoC 2026 |` and `| Kannada (ಕನ್ನಡ) | ✅ Complete | GSSoC 2026 |` respectively.

These changes ensure that both Kannada and Telugu are now fully supported, tested, and documented within our i18n system.

## Technical Decisions

Our system utilizes `next-intl` for internationalization, which relies on structured JSON files (`messages/*.json`) to store locale-specific strings. The decision to complete translations within these existing JSON files (`kn.json`, `te.json`) was made to adhere to our established i18n architecture and leverage `next-intl`'s capabilities for message loading and retrieval.

For testing, we continued to use Jest's `it.each` pattern in `apps/web/tests/i18n-locales.test.tsx`. This approach was chosen for its efficiency and readability, allowing us to test multiple locales against the same assertion logic without duplicating test code. Extending this existing pattern to include "te" for both routing configuration and native label verification was a natural and consistent choice, ensuring that new languages are properly integrated into our test suite.

The specific keys chosen for translation completion were identified by comparing the existing `kn.json` and `te.json` files against the comprehensive `en.json` reference, as well as addressing specific user-facing strings that were previously untranslated, such as the voice error messages. This ensures that all user-facing text is localized.

## How To Re-Implement (Contributor Reference)

To implement a new language or complete an existing one, a contributor would follow these steps:

1.  **Identify Missing Keys:**
    *   First, ensure a locale-specific JSON file exists in `apps/web/messages/` (e.g., `xx.json` for a new language 'xx').
    *   Compare the target locale's JSON file (e.g., `apps/web/messages/xx.json`) against `apps/web/messages/en.json`. Tools or scripts can be used to find keys present in `en.json` but missing or untranslated in `xx.json`.

2.  **Translate Keys:**
    *   For each identified missing or untranslated key, provide an accurate and contextually appropriate translation in the target `xx.json` file. Ensure that the JSON structure remains valid.
    *   Example: If `en.json` has `"sign_in": "Sign In"`, and `xx.json` has `"sign_in": "Sign In"`, update it to `"sign_in": "Your_Translation_Here"`.

3.  **Update `README.md`:**
    *   Once all keys are translated and verified, update the `README.md` file. Locate the language in the "Internationalization (i18n)" table and change its status from "🔜 Open" to "✅ Complete". Also, update the "Contributor" column if applicable (e.g., `GSSoC 2026`).

4.  **Extend Test Coverage (`apps/web/tests/i18n-locales.test.tsx`):**
    *   **Routing Configuration Test:** Add the new locale's identifier (e.g., `"xx"`) to the `it.each` array in the test block that verifies locale availability:
        ```typescript
        it.each(["kn", "te", "pa", "xx"])("enables %s in the routing config", (locale) => {
            expect(routing.locales).toContain(locale);
        });
        ```
    *   **Native Language Label Test:** Add an entry for the new locale and its native name to the `it.each` array in the test block that verifies native language labels:
        ```typescript
        it.each([
            ["kn", "ಕನ್ನಡ"],
            ["te", "తెలుగు"],
            ["pa", "ਪੰਜਾਬੀ"],
            ["xx", "Your_Native_Language_Name_Here"], // Add this line
        ])("shows the native language label for %s", (locale, nativeLabel) => {
            activeLocale = locale;
            expect(useTranslations("LocaleSwitcher")(locale)).toBe(nativeLabel);
        });
        ```

5.  **Verify:**
    *   Run the test suite (`npm test` or `yarn test`) to ensure all i18n tests pass.
    *   Manually test the application locally: switch the language to the newly completed locale in the UI and verify that all strings are correctly translated and no English text remains. Pay special attention to dynamic content and error messages.

## Impact on System Architecture

This PR significantly enhances the internationalization capabilities of the SahiDawa web application. By completing the Kannada and Telugu translations, we have demonstrated the robustness of our `next-intl` based i18n framework and moved two major Indian languages from "in progress" to "complete" status. This directly improves the user experience for a substantial portion of our target audience, making the platform more accessible and user-friendly.

Architecturally, this change reinforces our commitment to a modular and testable i18n system. The extension of `i18n-locales.test.tsx` provides a clear pattern for future language additions, ensuring that new locales are correctly integrated into our routing and display mechanisms from a testing perspective. This reduces the risk of regressions and simplifies the onboarding process for contributors working on new translations. It also validates the design decision to separate translation files from application logic, allowing for independent updates.

## Testing & Verification

Verification for this change involved both automated testing and manual review:

1.  **Automated Testing:**
    *   The `apps/web/tests/i18n-locales.test.tsx` file was updated to include Telugu (`te`) in its test cases. This test suite, powered by Jest, ensures:
        *   **Locale Routing Configuration:** The test `it.each(["kn", "te", "pa"])("enables %s in the routing config", ...)` confirms that "te" is correctly recognized and enabled within our `next-intl` routing configuration, preventing 404 errors or incorrect language loading.
        *   **Native Language Label Display:** The test `it.each([["kn", "ಕನ್ನಡ"], ["te", "తెలుగు"], ["pa", "ਪੰਜਾਬੀ"]])("shows the native language label for %s", ...)` verifies that the `LocaleSwitcher` component correctly retrieves and displays the native name "తెలుగు" for the Telugu locale, ensuring a consistent and intuitive language selection experience.
    *   The PR description explicitly states "10/10 i18n tests passing, 0 missing keys vs `en.json`", indicating that a comprehensive check was performed to ensure all keys present in the English reference file (`en.json`) are also present and translated in both `kn.json` and `te.json`. This addresses the primary edge case of untranslated strings appearing in the UI.

2.  **Manual Verification:**
    *   The author confirmed running the project locally and verifying no compile/build errors.
    *   Screenshots or terminal logs were provided as proof of testing, which typically involves navigating the application with the Kannada and Telugu locales selected to visually confirm that all UI elements, including the previously untranslated `sign_in`, `get_started`, `switch_to_text_button`, and voice error messages, are now correctly displayed in the respective languages. This ensures the translations are not only present but also contextually accurate and render correctly in the UI.