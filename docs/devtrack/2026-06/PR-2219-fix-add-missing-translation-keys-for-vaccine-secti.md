# PR #2219 — fix: add missing translation keys for vaccine section

> **Merged:** 2026-06-21 | **Author:** @Vartika2903 | **Area:** i18n | **Impact Score:** 39 | **Closes:** #2172

## What Changed

This pull request introduces three new internationalization (i18n) keys: `Home.vaccine_title`, `Home.vaccine_subtitle`, and `Home.vaccine_open`, along with their corresponding translated values. These keys have been added to 13 specific locale JSON files located under `apps/web/messages/`. This ensures that the user interface elements within the Vaccine section now display correctly localized text across all supported Indian languages, eliminating the display of raw translation keys.

## The Problem Being Solved

Before this PR, the user interface for the Vaccine section within our `apps/web` application was displaying raw translation keys, such as `Home.vaccine_title`, `Home.vaccine_subtitle`, and `Home.vaccine_open`, instead of their intended localized text. This occurred because while the UI components were configured to use these translation keys, the actual key-value pairs were missing from our internationalization message files for various Indian languages. This deficiency resulted in a suboptimal user experience, as users encountered untranslated, technical strings in critical areas of the Vaccine section, hindering comprehension and usability.

## Files Modified

- `apps/web/messages/as.json`
- `apps/web/messages/bn.json`
- `apps/web/messages/hi.json`
- `apps/web/messages/kn.json`
- `apps/web/messages/mai.json`
- `apps/web/messages/ml.json`
- `apps/web/messages/mr.json`
- `apps/web/messages/or.json`
- `apps/web/messages/pa.json`
- `apps/web/messages/sa.json`
- `apps/web/messages/ta.json`
- `apps/web/messages/te.json`
- `apps/web/messages/ur.json`

## Implementation Details

The implementation involved a direct modification of our existing locale message JSON files, which are central to our internationalization strategy for the `apps/web` frontend. For each of the 13 specified languages (Assamese, Bengali, Hindi, Kannada, Maithili, Malayalam, Marathi, Odia, Punjabi, Sanskrit, Tamil, Telugu, and Urdu), we updated its corresponding `messages/<lang_code>.json` file.

Within each JSON file, we located the top-level `Home` object, which groups translations related to the application's home or main dashboard section. We then appended three new key-value pairs to this object:

1.  `"vaccine_title"`: This key was assigned the translated string for "Vaccine Hub & Immunization Tracker".
2.  `"vaccine_subtitle"`: This key received the translated string for "Explore vaccine schedules, safety info, and aftercare guidance for enhanced public health awareness."
3.  `"vaccine_open"`: This key was populated with the translated string for "Open Vaccine Hub".

For example, in `apps/web/messages/hi.json`, the additions appear as:
```json
        "alerts_empty_title": "सब ठीक है!",
        "alerts_empty_description": "अभी कोई सक्रिय नियामक अलर्ट नहीं है। सुरक्षित रहें और अपनी दवाएं सत्यापित करें।",
        "view_full_alert_log": "पूरा अलर्ट लॉग देखें",
        "vaccine_title": "वैक्सीन हब और टीकाकरण ट्रैकर",
        "vaccine_subtitle": "बेहतर जन-स्वास्थ्य जागरूकता के लिए वैक्सीन शेड्यूल, सुरक्षा संबंधी जानकारी और टीकाकरण के बाद की देखभाल के बारे में जानें।",
        "vaccine_open": "ओपन वैक्सीन हब",
        "heroTitle": {
            "prefix": "आपका स्वास्थ्य, ",
            "highlight": "सत्यापित और सुरक्षित।"
        }
```
Our `apps/web` application, built with Next.js, leverages an i18n library (likely `next-intl`) that automatically loads these JSON files based on the user's selected locale. When a React component in the Vaccine section attempts to render text using a translation hook or function (e.g., `t('Home.vaccine_title')`), the system now successfully retrieves the corresponding localized string from the updated JSON files, ensuring correct display. No changes were required in the application's core i18n logic or component-level code, as the issue was purely data-related.

## Technical Decisions

The decision to directly update the existing locale JSON files (`apps/web/messages/*.json`) was a pragmatic one, aligning with our established internationalization architecture. Our system employs a file-based approach where each supported language has a dedicated JSON file containing all static UI strings. This method is well-suited for managing a fixed set of translations for the `apps/web` frontend and integrates seamlessly with our Next.js environment. No new libraries or complex translation management systems were introduced, as the problem was a straightforward omission of key-value pairs within the existing structure. This approach minimizes overhead and maintains consistency with how other UI strings are handled across the platform. Not documented in this PR: specific alternatives considered for the i18n system itself (e.g., database-backed translations, different file formats).

## How To Re-Implement (Contributor Reference)

To re-implement or add new translation keys following this pattern, a contributor would:

1.  **Identify the missing translation key(s):** Observe the UI for raw key display (e.g., `Home.new_feature_text`). This indicates the key the component is trying to use.
2.  **Locate the relevant locale files:** For the `apps/web` application, all static message files are located in the `apps/web/messages/` directory.
3.  **Determine the appropriate JSON object:** Based on the key's prefix (e.g., `Home.`), identify the top-level JSON object where the new key should reside. In this PR, it was the `Home` object.
4.  **Add the key-value pair(s) to each affected locale file:**
    *   Open `apps/web/messages/<lang_code>.json` for every language that needs the translation.
    *   Navigate to the correct JSON object (e.g., `Home`).
    *   Insert the new key and its corresponding translated string. For example, to add `Home.new_feature_title` for Hindi:
        ```json
        // apps/web/messages/hi.json
        {
          "Home": {
            // ... existing keys
            "vaccine_title": "वैक्सीन हब और टीकाकरण ट्रैकर", // Existing key
            "new_feature_title": "नई सुविधा का शीर्षक" // New key addition
          }
        }
        ```
    *   Ensure the translated string is accurate and culturally appropriate for each language.
5.  **Verify consistency:** Confirm that the translation key used in the UI component code (e.g., `t('Home.new_feature_title')`) exactly matches the key added to the JSON files.
6.  **Test the changes:** Run the `apps/web` application locally. Switch the application's locale to each modified language and visually confirm that the new text is displayed correctly and that no raw keys are visible.
7.  **Dependencies:** This process relies solely on the existing `apps/web` Next.js application's internationalization setup, which is configured to load these JSON files. No external APIs or database updates are involved for these static UI string translations.

## Impact on System Architecture

This change has a minimal and positive impact on the overall SahiDawa system architecture. It primarily addresses a data completeness issue within our existing internationalization framework rather than introducing new architectural components or altering fundamental data flows. By populating the missing translation keys, we reinforce the robustness of our multi-lingual support for the `apps/web` platform. This ensures a consistent and fully localized user experience for the Vaccine section across all supported Indian languages, which is crucial for a platform focused on rural health and accessibility. It implicitly validates our current file-based i18n approach as effective for managing static UI text. This PR unlocks the full intended usability of the Vaccine section for our diverse user base by making it accessible in their preferred native languages.

## Testing & Verification

Verification for this change primarily involved manual inspection of the user interface across all affected locales. The author confirmed that raw translation keys, such as `Home.vaccine_title`, were no longer displayed in the UI after the changes were applied. This process typically entails:

1.  Building and running the `apps/web` application locally.
2.  Navigating to the specific UI section where the new translations are expected (the Vaccine section).
3.  Iterating through each of the 13 modified languages by changing the application's locale setting.
4.  Visually inspecting the `vaccine_title`, `vaccine_subtitle`, and `vaccine_open` elements to ensure they displayed the correct, translated text instead of the raw keys.

Not documented in this PR: specific automated tests (e.g., snapshot tests for translations, end-to-end UI tests) were not mentioned. However, the manual verification described is a standard and effective method for confirming the presence of translations. Potential edge cases, such as text overflow with particularly long translated strings or nuanced semantic differences in translations, would typically be caught during such visual inspection or subsequent user feedback, but were not explicitly detailed as part of this PR's testing scope.