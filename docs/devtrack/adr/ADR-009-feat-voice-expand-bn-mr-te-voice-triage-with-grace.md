# ADR — feat(voice): expand bn/mr/te voice triage with graceful fallback

> **Date:** 2026-05-24 | **PR:** #485 | **Status:** Accepted

## Context

The existing voice triage system provided inconsistent and limited support for key Indian languages, specifically Bengali, Marathi, and Telugu. Users encountered a lack of native-script labels in the language selector, leading to a suboptimal user experience. Furthermore, the voice language handling was unstable across different stages of a session and during retries, often reusing stale language settings from previous interactions. This resulted in misaligned Automatic Speech Recognition (ASR), transcription, and Text-to-Speech (TTS) processes. The system also lacked clear and graceful fallback mechanisms when browser speech recognition or text-to-speech capabilities were limited or unavailable for a preferred language.

## Decision

The voice triage system was enhanced to provide robust and user-friendly multilingual support with graceful fallback.

1.  **Native-script language labels:** The voice language selector was updated to display native-script labels for Hindi, Tamil, Bengali, Marathi, and Telugu, improving discoverability and user experience.
2.  **Stable per-session language handling:** A dedicated `resolveVoiceWorkflowLanguage` function was introduced to ensure that the language selected at the start of a voice capture session is locked and consistently used throughout the entire workflow (ASR, transcription upload, review, and TTS). This prevents stale language settings from being reused in subsequent retries or stages.
3.  **Granular TTS voice resolution and fallback:** The `findBestVoice` utility was refactored to use a new `resolveSpeechSynthesisVoice` function. This function now returns a `SpeechSynthesisVoiceMatch` object, which includes the best available `SpeechSynthesisVoice` and a `supportLevel` (`exact`, `language`, `fallback`, `unknown`). This allows for more precise handling and localized messaging based on the level of voice support available in the user's browser.
4.  **Localized fallback messaging:** The structured `supportLevel` enables the display of localized fallback messages to users when an exact voice is not available, or when TTS capabilities are limited, providing clearer expectations.

## Alternatives Considered

| Alternative                                                                                    | Why Rejected                                                                                                                                                                                                                                                                                                                      |
| :--------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rely on browser's default language selection for TTS/ASR without explicit fallback logic.**  | This approach would lead to an unpredictable user experience, as the browser's default might not align with the user's selected language or SahiDawa's intended workflow. It would also prevent providing specific, localized feedback to the user about voice availability.                                                      |
| **Implement simpler, ad-hoc language state management without a dedicated workflow resolver.** | This could lead to race conditions or inconsistent language application across different components of the voice workflow. Without a centralized `resolveVoiceWorkflowLanguage`, ensuring the correct language is used from session start to finish, especially during retries, would be more error-prone and harder to maintain. |

## Consequences

**Positive:**

- Significantly improved user experience for speakers of Bengali, Marathi, and Telugu, with native-script labels enhancing clarity and accessibility.
- Enhanced reliability and consistency of voice triage workflows by ensuring the selected language remains stable throughout a session.
- Provided clearer, more informative, and localized feedback to users regarding browser speech recognition and text-to-speech capabilities and fallback behavior.
- Reduced user confusion and potential errors caused by inconsistent or stale language settings during voice interactions.

**Trade-offs:**

- Increased complexity in the voice language resolution and fallback logic within the frontend application.
- Requires ongoing maintenance of `VOICE_LANGUAGE_OPTIONS` to ensure accurate native script labels and language codes are supported.
- The quality and availability of `SpeechSynthesisVoice` still depend on the user's browser and operating system, necessitating continued reliance on fallback mechanisms and clear user communication.

## Related Issues & PRs

- PR #485: feat(voice): expand bn/mr/te voice triage with graceful fallback
- Issue #443
