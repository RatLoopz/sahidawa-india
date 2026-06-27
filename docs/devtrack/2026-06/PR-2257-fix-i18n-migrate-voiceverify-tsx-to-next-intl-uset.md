# PR #2257 — fix(i18n): migrate VoiceVerify.tsx to next-intl useTranslations — closes #2251

> **Merged:** 2026-06-21 | **Author:** @Aditya948351 | **Area:** Frontend | **Impact Score:** 8

## What Changed

This pull request fully integrates internationalization (i18n) into the `VoiceVerify.tsx` component by migrating all its hardcoded English UI strings to use the `next-intl` library. We introduced a new `voiceVerify` namespace in `apps/web/messages/en.json` containing 29 new translation keys, and updated `VoiceVerify.tsx` to utilize the `useTranslations` hook to fetch and display these localized strings.

## The Problem Being Solved

Prior to this change, the `apps/web/components/VoiceVerify.tsx` component rendered all its user-facing text, such as headings, subtitles, status messages, error messages, and result card labels, as hardcoded English literals. This prevented the SahiDawa platform from offering a localized experience for users interacting with the voice verification feature, which is critical for our mission in diverse linguistic regions of India. The lack of i18n integration meant that the component was not ready for translation into Hindi, Tamil, Telugu, or other supported languages.

## Files Modified

- `apps/web/components/VoiceVerify.tsx`
- `apps/web/messages/en.json`

## Implementation Details

The core of this implementation involved two main steps: defining translation keys and integrating them into the component.

1.  **Translation Key Definition (`apps/web/messages/en.json`):**
    - We added a new top-level namespace, `"voiceVerify"`, to `apps/web/messages/en.json`.
    - Within this namespace, 29 new translation keys were defined. These keys correspond to every user-facing string previously hardcoded in `VoiceVerify.tsx`. Examples include:
        - `"heading": "Voice Medicine Check"`
        - `"subtitle": "Speak the medicine name in your language"`
        - `"errorMicDenied": "Microphone access denied. Please allow microphone access and try again."`
        - `"statusVerified": "Verified"`
        - `"ariaStartRecording": "Start recording"`
        - `"scriptLabel": "Medicine ({script} script)"` (demonstrating a key with a dynamic parameter)

2.  **Component Integration (`apps/web/components/VoiceVerify.tsx`):**
    - **Import `useTranslations`:** The `next-intl` `useTranslations` hook was imported at the top of the component: `import { useTranslations } from "next-intl";`.
    - **Initialize `t` function:** Inside the `VoiceVerify` functional component, the `t` function was initialized by calling `const t = useTranslations("voiceVerify");`. This `t` function is now scoped to the `voiceVerify` namespace, allowing us to access keys like `t("heading")`.
    - **Relocating `STATUS_CONFIG`:** The `STATUS_CONFIG` object, which defines labels and styles for verification statuses (verified, suspicious, not_found), was moved from a global constant outside the component to inside the `VoiceVerify` component. This was a critical change because the `t` function is only available within the component's render scope after the `useTranslations` hook is called. By moving `STATUS_CONFIG` inside, its `label` properties could be updated to use `t()`:
        - `label: "✅ Verified"` became `label: `✅ ${t("statusVerified")}`
        - `label: "⚠️ Suspicious"` became `label: `⚠️ ${t("statusSuspicious")}`
        - `label: "❌ Not Found"` became `label: `❌ ${t("statusNotFound")}`
    - **Replacing Hardcoded Strings:** All instances of hardcoded English strings throughout the JSX and logic were replaced with calls to the `t()` function, referencing the newly defined keys. This includes:
        - The main heading (`<h2 className="...">{t("heading")}</h2>`) and subtitle (`<p className="...">{t("subtitle")}</p>`).
        - Error messages (`setError(t("errorMicDenied"))`, `setError(data.error || t("errorNetwork"))`).
        - `aria-label` attributes on interactive elements (`aria-label={isRecording ? t("ariaStopRecording") : t("ariaStartRecording")}`).
        - Dynamic status messages below the microphone button (`t("statusVerifying")`, `t("statusRecording")`, `t("statusIdle")`).
        - The supported languages hint (`t("supportedLanguages")`).
        - The "Try again" link (`{t("tryAgain")}`).
        - CDSCO badge text (`t("cdscoRegistered")`, `t("cdscoUnverified")`).
        - Result card labels (e.g., `t("scriptLabel", { script: result.script })`, `t("manufacturerLabel")`, `t("categoryLabel")`, `t("languageDetectedLabel")`, `t("youSaidLabel")`, `t("warningsLabel")`).
        - The "Check another medicine" button (`t("checkAnother")`).
        - The fallback text and link for no microphone (`t("fallbackText")`, `t("fallbackLinkText")`).
    - **`useCallback` Dependencies:** The `startRecording` `useCallback` hook's dependency array was updated to include `t` (`[t]`) because the `t` function is now used within its logic to set error messages.

## Technical Decisions

1.  **Choice of `next-intl`:** We chose `next-intl` because it is the established and standard internationalization library for our `apps/web` frontend. It provides robust features like message formatting, pluralization, and client-side translation loading, aligning with our existing i18n architecture.
2.  **Namespace `voiceVerify`:** A dedicated `voiceVerify` namespace was created in `messages/en.json` to encapsulate all strings related to this component. This decision promotes modularity, prevents key collisions with other components, and improves the maintainability and organization of our translation files.
3.  **Moving `STATUS_CONFIG`:** The `STATUS_CONFIG` object was moved from a module-level constant to inside the `VoiceVerify` component. This was necessary because the `useTranslations` hook, which provides the `t` function, can only be called within a React component or custom hook. To dynamically translate the `label` property of each status configuration using `t()`, `STATUS_CONFIG` needed to be within the component's scope where `t` is accessible.
4.  **Updating `useCallback` Dependencies:** Including `t` in the dependency array for `startRecording` is a standard React practice. While `next-intl`'s `t` function is stable across renders for a given locale, explicitly listing it ensures that the `useCallback` hook correctly re-creates the memoized function if the `t` function (e.g., due to a locale change) were to ever change its identity, preventing stale closures.

## How To Re-Implement (Contributor Reference)

To implement internationalization for a new or existing component using `next-intl`, follow these steps, using `VoiceVerify.tsx` as a reference:

1.  **Identify Hardcoded Strings:** Go through the target component (e.g., `MyNewComponent.tsx`) and identify all user-facing strings, including text content, `aria-label` attributes, `alt` texts, and any other literals that should be translatable.
2.  **Create/Extend Namespace in `messages/en.json`:**
    - Open `apps/web/messages/en.json`.
    - If a suitable namespace already exists for your component, use it. Otherwise, create a new top-level JSON object (e.g., `"myNewComponent": {}`).
    - For each identified string, create a unique key-value pair within your chosen namespace (e.g., `"myNewComponent": { "heading": "My New Feature", "buttonLabel": "Click Me" }`).
    - Ensure keys are descriptive and follow a consistent naming convention (e.g., `camelCase`).
3.  **Integrate `useTranslations` in the Component:**
    - Open your component file (e.g., `apps/web/components/MyNewComponent.tsx`).
    - Import the `useTranslations` hook: `import { useTranslations } from "next-intl";`.
    - Inside your functional component, initialize the `t` function, specifying your namespace: `const t = useTranslations("myNewComponent");`.
4.  **Replace Hardcoded Strings:**
    - Go through your component's JSX and logic.
    - Replace every hardcoded string with a call to `t("yourKey")`.
    - For strings requiring dynamic values (e.g., `t("greeting", { name: "John" })`), ensure your translation key in `en.json` uses placeholders (e.g., `"greeting": "Hello, {name}!"`).
5.  **Handle External Objects/Constants:**
    - If your component uses external objects (like `STATUS_CONFIG` in `VoiceVerify.tsx`) that contain strings needing translation, you have two primary options:
        - **Move the object inside the component:** If the object's structure is simple and it doesn't need to be globally accessible, move it inside the component where `t` is available. Then, update its string properties to use `t()`.
        - **Pass `t` as a prop/argument:** If the object must remain external or is used by multiple components, consider refactoring to pass the `t` function (or specific translated strings) as a prop to a sub-component, or as an argument to a utility function that constructs the object.
6.  **Update `useCallback`/`useMemo` Dependencies:**
    - If you use `useCallback` or `useMemo` hooks and their memoized functions/values directly or indirectly depend on the `t` function (e.g., `t` is called within them, or an object constructed with `t` is used), ensure `t` is included in their dependency arrays.
7.  **Verify and Test:**
    - Run the application and navigate to the component. Verify that all strings are correctly displayed from the `en.json` file.
    - Check the console for any `next-intl` warnings or errors related to missing keys.
    - Consider adding specific tests for i18n integration if the component has complex text logic.

## Impact on System Architecture

This change significantly enhances the internationalization readiness of the SahiDawa `apps/web` frontend, specifically for the critical voice medicine verification feature.

- **Improved User Experience:** It lays the groundwork for providing a fully localized experience for users across India, making the platform more accessible and user-friendly for non-English speakers. This directly supports SahiDawa's mission of rural health platform accessibility.
- **Reinforced i18n Standard:** It reinforces `next-intl` as the canonical solution for frontend internationalization, ensuring consistency across our codebase.
- **Reduced Technical Debt:** By removing hardcoded strings, we reduce technical debt and make future localization efforts (adding new languages) much simpler and less error-prone.
- **Scalability:** The modular `voiceVerify` namespace allows for easy management and scaling of translations as the feature evolves.
- **No Core Logic Change:** The underlying voice verification logic and API interactions remain unchanged, ensuring that the functional core of the feature is stable while its presentation layer becomes adaptable.

## Testing & Verification

The testing for this change primarily relied on established patterns and type safety:

- **`useTranslations` Mock Pattern:** The integration of `useTranslations` in `VoiceVerify.tsx` followed the same mocking pattern already established and used in `apps/web/components/OfflineBanner.tsx`. This pattern has been validated by existing unit tests, such as those in `back-to-top-button.test.tsx`, which confirm that `next-intl` hooks can be correctly mocked in our testing environment.
- **TypeScript Compilation:** The PR confirmed that TypeScript compilation was unaffected, indicating no regressions in type signatures or unexpected type errors introduced by the changes.
- **Manual Verification (Implied):** While not explicitly detailed in the PR description, the nature of i18n changes typically involves manual verification by running the application and visually inspecting the UI to ensure all strings are correctly rendered and translated (in this case, from `en.json`).
- **Edge Cases:** The PR does not introduce new functional logic, so existing edge cases related to microphone access, network errors, or API responses are handled by the component's existing error states, which now display translated messages. No new specific i18n-related edge cases were identified or required new dedicated tests in this PR.
