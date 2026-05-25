# PR #485 — feat(voice): expand bn/mr/te voice triage with graceful fallback

> **Merged:** 2026-05-24 | **Author:** @shashank03-dev | **Area:** i18n | **Impact Score:** 33 | **Closes:** #443

## What Changed

This pull request significantly enhances our Voice Triage feature by introducing native-script labels for Hindi, Tamil, Bengali, Marathi, and Telugu in the language selection dropdown. Crucially, we've implemented a mechanism to lock the voice workflow language to the user's initial selection for the entire session, ensuring consistency across speech recognition, transcription, and text-to-speech. Additionally, we've improved the user experience with localized fallback messages for unsupported speech recognition languages and limited text-to-speech voice availability, and addressed a bug that could cause stale language settings on retry.

## The Problem Being Solved

Prior to this PR, our Voice Triage system had several areas for improvement regarding multilingual support and user experience:

1.  **Limited Language Visibility:** While we supported several Indian languages, the language selector labels were only in English (e.g., "Hindi" instead of "हिन्दी (Hindi)"). This made it less intuitive for native speakers to identify their preferred language.
2.  **Inconsistent Workflow Language:** The voice workflow language was not consistently maintained throughout a session. This could lead to scenarios where the speech recognition, transcription processing, or text-to-speech output might not align with the user's initially selected language, especially after retries or during complex interactions.
3.  **Ambiguous Fallback Behavior:** When a specific voice or speech recognition language was not fully supported by the browser, the system lacked clear, localized feedback to the user, potentially causing confusion or frustration.
4.  **Stale Language on Retry:** A bug existed where retrying a voice capture session could inadvertently reuse a stale language setting from a previous run, leading to incorrect recognition or synthesis.
5.  **CI Instability:** Our CI pipeline experienced occasional failures related to map layout and panel tests that were inadvertently coupled with the main application routing module, causing unnecessary flakiness.

## Files Modified

- `apps/web/app/[locale]/voice/lib/browser.ts`
- `apps/web/app/[locale]/voice/lib/languages.ts`
- `apps/web/app/[locale]/voice/page.tsx`
- `apps/web/messages/bn.json`
- `apps/web/messages/en.json`
- `apps/web/messages/mr.json`
- `apps/web/messages/ta.json`
- `apps/web/messages/te.json`
- `apps/web/tests/voice-helpers.test.ts`

## Implementation Details

This PR introduces several key changes across our frontend application:

1.  **Enhanced Speech Synthesis Voice Resolution (`apps/web/app/[locale]/voice/lib/browser.ts`):**
    - We introduced a new type `SpeechSynthesisVoiceMatch` to provide more granular information about the voice matching process, including the `voice` itself and a `supportLevel` ("exact", "language", "fallback", "unknown").
    - The existing `findBestVoice` function was refactored to internally call a new, more robust `resolveSpeechSynthesisVoice` function.
    - `resolveSpeechSynthesisVoice` now attempts to find a voice in this order:
        1.  An exact `voice.lang` match (e.g., "hi-IN").
        2.  A language-only match (e.g., `voice.lang.startsWith("hi")` for "hi-IN").
        3.  A generic fallback to the browser's first available voice (`voices[0]`).
    - This provides a clearer hierarchy for voice selection and allows us to determine the level of support for a given language.

2.  **Native Script Language Labels and Workflow Language Resolution (`apps/web/app/[locale]/voice/lib/languages.ts`):**
    - The `VOICE_LANGUAGE_OPTIONS` array was updated to include native script labels for Hindi (`हिन्दी (Hindi)`), Tamil (`தமிழ் (Tamil)`), Bengali (`বাংলা (Bengali)`), Marathi (`मराठी (Marathi)`), and Telugu (`తెలుగు (Telugu)`). This improves accessibility and user experience for native speakers.
    - A new utility function, `resolveVoiceWorkflowLanguage(sessionLanguage, activeLanguage, selectedLanguage)`, was added. This function determines the authoritative language for the current voice session. It prioritizes:
        1.  A `sessionLanguage` (once a session starts, this is locked).
        2.  An `activeLanguage` (Not documented in this PR how `activeLanguage` is set, but it's a fallback).
        3.  The `selectedLanguage` from the dropdown.
    - This function is central to ensuring the language remains consistent throughout the voice interaction lifecycle.

3.  **Voice Triage Page Logic Updates (`apps/web/app/[locale]/voice/page.tsx`):**
    - **Language Locking:**
        - A new `sessionLanguageRef` `useRef` hook was introduced to store the language chosen at the start of a voice capture session.
        - The `startVoiceCapture` function now sets `sessionLanguageRef.current` to the currently `selectedLanguage` before initiating recognition.
        - A new `workflowLanguageCode` derived from `resolveVoiceWorkflowLanguage` is now used consistently for `SpeechRecognition.lang`, `transcribeRecordedAudio` calls, and `shouldReviewTranscription` logic, ensuring all parts of the workflow use the locked session language.
        - The language selection dropdown is disabled (`isLanguageSelectionLocked`) during active voice steps (`listening`, `processing`, `review`, `result`) to prevent mid-session changes.
    - **Improved Error Handling:**
        - The `getRecognitionErrorState` function now accepts an optional `languageLabel` parameter.
        - A new error code `language-not-supported` was added, providing a specific message (`errors.language_not_supported_title`, `errors.language_not_supported_message`) when the browser's speech recognition API does not support the selected language.
        - This error state is now passed the `fallbackWorkflowLanguageOption.label` for more informative messages.
    - **Text-to-Speech Fallback Notices:**
        - When `processVoiceResult` initiates text-to-speech, it now uses the new `resolveSpeechSynthesisVoice` function to determine the `voiceMatch` and its `supportLevel`.
        - If `voiceMatch.supportLevel` is "fallback" (meaning a generic voice was used because no exact or language-specific voice was found), a `toast.warning` message (`tts_fallback_message`) is displayed to the user, informing them that a fallback voice is being used. A `ttsFallbackNoticeKeyRef` prevents duplicate toasts for the same message.
    - **Retry Path Fix:**
        - The `resetVoiceState` function now explicitly sets `sessionLanguageRef.current = null` and `setActiveLanguageCode(null)`. This ensures that when a user retries a voice session, the `workflowLanguageCode` is re-evaluated based on the current `selectedLanguage`, preventing stale language settings from persisting.
    - **UI State Management:**
        - `activeLanguageCode` state was added, though its direct update path is not explicitly shown in the provided diff, it's used in `resolveVoiceWorkflowLanguage`.
        - `ttsFallbackNoticeKeyRef` was added to manage the display of TTS fallback warnings.

4.  **Localization Updates (`apps/web/messages/*.json`):**
    - `bn.json`, `en.json`, `mr.json`, `ta.json`, `te.json` files were updated.
    - New translation keys were added for the native script language labels (e.g., `VoicePage.language_options.hi-IN`).
    - New error messages were added for unsupported language scenarios (`VoicePage.errors.language_not_supported_title`, `VoicePage.errors.language_not_supported_message`) and a general TTS fallback message (`VoicePage.tts_fallback_message`).

5.  **Test Stabilization (`apps/web/tests/voice-helpers.test.ts`):**
    - Not documented in this PR, but the PR description indicates that CI stability was improved by isolating map layout and panel tests from the app routing module they do not exercise. This likely involved refactoring or moving tests to ensure they only test relevant components, reducing interdependencies and flakiness.

## Technical Decisions

1.  **Granular Speech Synthesis Voice Resolution:** We decided to introduce `resolveSpeechSynthesisVoice` with a `SpeechSynthesisVoiceMatch` return type instead of just returning `SpeechSynthesisVoice | undefined`. This was a deliberate choice to provide more context about _why_ a particular voice was chosen (or not chosen). This `supportLevel` is crucial for displaying informative user feedback, such as the `tts_fallback_message` toast, which wouldn't be possible with a simpler `findBestVoice` signature.
2.  **Session-Locked Workflow Language:** The decision to lock the `workflowLanguageCode` at the start of a voice session (using `sessionLanguageRef`) was made to ensure consistency and predictability. Allowing the language to change mid-session could lead to confusing scenarios where a user speaks in one language, but the transcription or TTS response happens in another due to a last-minute dropdown change. This "snapshot" approach simplifies the state management for the entire voice interaction.
3.  **Native Script Labels:** Adding native script labels directly to `VOICE_LANGUAGE_OPTIONS` was a user experience-driven decision. While English labels are functional, providing labels in the native script (e.g., `বাংলা` for Bengali) significantly improves discoverability and usability for our target audience, aligning with our commitment to accessibility in Indian languages.
4.  **Localized Fallback Messaging:** Implementing specific error messages for "language not supported" and general "TTS fallback" was chosen to provide transparency to the user. Instead of a generic error, users now understand if their browser lacks support for a specific language or if a less ideal voice is being used, empowering them with information about potential limitations.
5.  **Explicit `resetVoiceState` for Retries:** Explicitly clearing `sessionLanguageRef.current` in `resetVoiceState` was a targeted fix for a bug where stale language settings could persist across retries. This ensures that each new voice session correctly initializes with the currently `selectedLanguage`.

## How To Re-Implement (Contributor Reference)

To re-implement the enhanced voice triage language handling and fallback, a contributor would follow these steps:

1.  **Define Language Options with Native Labels:**
    - In `apps/web/app/[locale]/voice/lib/languages.ts`, extend `VOICE_LANGUAGE_OPTIONS` to include `label` fields with both English and native script names (e.g., `label: "हिन्दी (Hindi)"`). Ensure `speechRecognition` and `speechSynthesisLang` values are correct BCP 47 language tags (e.g., "hi-IN").
    - Add corresponding translation keys and values to `apps/web/messages/*.json` for each supported locale.

2.  **Implement Robust Speech Synthesis Voice Resolution:**
    - Create a `SpeechSynthesisVoiceMatch` type in `apps/web/app/[locale]/voice/lib/browser.ts` to encapsulate the `voice` and its `supportLevel`.
    - Implement `resolveSpeechSynthesisVoice(targetWindow: Window, preferredLanguage: string)`:
        - Fetch `targetWindow.speechSynthesis.getVoices()`.
        - Prioritize an exact `voice.lang` match.
        - If no exact match, look for a primary language match (e.g., `voice.lang.startsWith(preferredLanguage.split("-")[0])`).
        - As a final fallback, return the first available voice (`voices[0]`).
        - Return the result as a `SpeechSynthesisVoiceMatch` object.
    - Update `findBestVoice` to simply return `resolveSpeechSynthesisVoice(...).voice`.

3.  **Implement Workflow Language Resolution:**
    - In `apps/web/app/[locale]/voice/lib/languages.ts`, create `resolveVoiceWorkflowLanguage(sessionLanguage: string | null | undefined, activeLanguage: string | null | undefined, selectedLanguage: string)`:
        - Return `sessionLanguage` if present and trimmed.
        - Else, return `activeLanguage` if present and trimmed.
        - Else, return `selectedLanguage`.

4.  **Integrate Language Locking and Fallback in `apps/web/app/[locale]/voice/page.tsx`:**
    - **State Management:**
        - Introduce a `sessionLanguageRef = useRef<string | null>(null)` to store the locked language.
        - Derive `workflowLanguageCode` using `resolveVoiceWorkflowLanguage` with `sessionLanguageRef.current`, `activeLanguageCode`, and `selectedLanguage`.
        - Derive `workflowLanguageOption` using `getVoiceLanguageOption(workflowLanguageCode)`.
        - Implement `isLanguageSelectionLocked` based on the current `step` to disable the language dropdown during active voice sessions.
    - **Start Session:**
        - In `startVoiceCapture`, before initiating `SpeechRecognition`, set `sessionLanguageRef.current = selectedLanguage`.
    - **Consistent Language Usage:**
        - Ensure all calls to `SpeechRecognition.lang`, `transcribeRecordedAudio`, and `shouldReviewTranscription` use `workflowLanguageCode` (or `workflowLanguageOption.speechRecognition`).
    - **TTS Fallback UI:**
        - In `processVoiceResult`, when preparing `SpeechSynthesisUtterance`:
            - Call `resolveSpeechSynthesisVoice(window, resultLanguageOption.speechSynthesisLang)`.
            - If `voiceMatch.voice` exists, assign it to `utterance.voice`.
            - If `voiceMatch.supportLevel === "fallback"`, display a `toast.warning` with a localized message (`t("tts_fallback_message")`), using a `ttsFallbackNoticeKeyRef` to prevent duplicate toasts.
    - **Enhanced Error Handling:**
        - Update `getRecognitionErrorState` to accept a `languageLabel`.
        - Add a new `case "language-not-supported"` to `getRecognitionErrorState` with specific localized messages.
        - When calling `getRecognitionErrorState`, pass the `workflowLanguageOption.label` for more context.
    - **Reset Logic:**
        - In `resetVoiceState`, explicitly set `sessionLanguageRef.current = null` and `setActiveLanguageCode(null)` to clear the session language for new attempts.

5.  **Update Localization Files:**
    - Add new translation keys for `errors.language_not_supported_title`, `errors.language_not_supported_message`, and `tts_fallback_message` to all relevant `apps/web/messages/*.json` files.

## Impact on System Architecture

This change significantly strengthens the internationalization (i18n) capabilities of our `apps/web` frontend, particularly for the Voice Triage feature.

- **Improved i18n Robustness:** By introducing a session-locked workflow language and more granular voice resolution, we've made the voice interaction more predictable and reliable across different locales. This reduces the likelihood of language mismatches between user input, backend processing, and frontend output.
- **Enhanced User Experience:** The addition of native script labels and localized fallback messages directly improves the user experience for non-English speakers, making the platform more accessible and user-friendly in rural Indian contexts. Users will now have clearer feedback when browser limitations affect voice functionality.
- **Foundation for Future Voice Features:** The `resolveSpeechSynthesisVoice` function, with its `supportLevel` output, provides a robust foundation for future enhancements. We can now build more sophisticated UI elements or logic that react to the exact level of voice support (e.g., suggesting alternative languages if an "exact" match isn't found).
- **Decoupling and Stability:** The reported CI stabilization (though not fully detailed in the diff) suggests a move towards better modularity and test isolation within the `apps/web` project, which is a positive architectural shift for long-term maintainability.
- **Increased Frontend Complexity:** The `page.tsx` component now manages more state related to language locking and fallback, increasing its internal complexity. This is a necessary trade-off for the improved user experience and robustness.

## Testing & Verification

The changes were thoroughly tested and verified locally:

1.  **Unit and Integration Tests:**
    - `npm test -w web -- --runInBand`: All web-specific tests passed, indicating that the new logic for language resolution and voice handling integrates correctly without regressions. 12 suites passed, 76 tests passed.
    - `npm test`: All workspace tests, including both API and web suites, passed successfully.
2.  **Build Verification:**
    - `npm run build`: The workspace build completed without errors, confirming that the TypeScript changes in the API and the production build for the web frontend were successful.
3.  **Manual UI Verification (Screenshots provided in PR):**
    - The voice UI was manually tested to confirm:
        - Native script labels (e.g., Bengali, Marathi) are correctly displayed in the voice language dropdown.
        - The selected language is consistently used for speech recognition and text-to-speech within a session.
        - Fallback messages for unsupported languages or TTS voices are displayed correctly as toasts.
        - The language selection dropdown is locked during an active voice session.
        - Retrying a voice session correctly resets the language to the current selection, preventing stale language issues.

Edge cases considered include browsers with no speech recognition support, browsers with limited voice synthesis options, and users switching languages mid-session (now prevented by locking). The new `supportLevel` in `resolveSpeechSynthesisVoice` and the explicit error messages handle these scenarios gracefully.
