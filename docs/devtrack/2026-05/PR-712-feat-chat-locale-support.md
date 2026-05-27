# PR #712 — Feat/chat locale support

> **Merged:** 2026-05-27 | **Author:** @harshitsaxena214 | **Area:** Frontend | **Impact Score:** 14 | **Closes:** #552

## What Changed

This pull request introduces comprehensive locale-aware support for our AI chat assistant, enabling it to automatically respond in the user's currently selected application language. We refactored the AI prompt handling by moving the core system prompt from `ChatUI.tsx` into a new dedicated module, `lib/chatPrompts.ts`, to improve maintainability and facilitate future language expansions. This change ensures that both AI responses and initial welcome messages are localized, significantly enhancing the user experience for our diverse user base.

## The Problem Being Solved

Prior to this PR, our AI chat assistant was not locale-aware, meaning it consistently responded in English regardless of the user's selected application language. This created a significant barrier for users who prefer or are more comfortable interacting in their native Indian languages, limiting the accessibility and inclusivity of the SahiDawa platform. Additionally, the AI's system prompt was embedded directly within the `ChatUI.tsx` component, leading to tight coupling and making it cumbersome to manage, update, or extend prompt logic for new languages or behaviors.

## Files Modified

- `apps/web/app/api/chat/route.ts`
- `apps/web/app/components/health/ChatUI.tsx`
- `apps/web/lib/chatPrompts.ts`

## Implementation Details

This feature was implemented by introducing a dynamic locale-aware system across both our frontend chat UI and the backend AI API.

1.  **Prompt Refactoring and Centralization (`apps/web/lib/chatPrompts.ts`):**
    *   We created a new file, `apps/web/lib/chatPrompts.ts`, to centralize our AI system prompts.
    *   This file exports `BASE_PROMPT`, which defines the SahiDawa AI Assistant's persona, core instructions, and a crucial placeholder: `IMPORTANT: Respond in {language}.` This placeholder is key for dynamic language injection.

2.  **Frontend Locale Detection and Message Handling (`apps/web/app/components/health/ChatUI.tsx`):**
    *   The `ChatUI` component now utilizes `useParams` from `next/navigation` to dynamically retrieve the active `locale` from the URL. This ensures the UI is aware of the user's preferred language.
    *   We introduced `INITIAL_MESSAGES`, an object mapping locale codes (e.g., `en`, `bn`, `te`) to localized welcome messages. The `initialMessage` state is now set based on the detected `locale`, falling back to English if the specific locale's message is not found.
    *   When a user sends a message via `handleSendMessage`, the `locale` is now included in the request body sent to our `/api/chat` endpoint: `body: JSON.stringify({ messages: history, locale })`. This propagates the user's language preference to the backend.
    *   For speech recognition, the `toggleListening` function was updated to dynamically set the `r.lang` property of the `SpeechRecognition` object. A `speechLocales` map was introduced to provide specific language codes (e.g., `en-IN`, `bn-IN`, `ur-IN`) for the `SpeechRecognition` API based on the active `locale`, ensuring accurate voice input interpretation.

3.  **Backend AI Response Generation (`apps/web/app/api/chat/route.ts`):**
    *   The `/api/chat` POST handler now imports `BASE_PROMPT` from `lib/chatPrompts.ts`.
    *   It expects a `locale` field in the incoming request body, alongside `messages`, `mode`, and `responseLanguage`.
    *   We defined `supportedLocales` (e.g., `["en", "gu", "bn", "te", "ta", "mr", "ur", "kn"]`) to validate the incoming `locale`. If the provided `locale` is not supported, it defaults to "en".
    *   A `localeMap` object translates locale codes (e.g., `en`) into human-readable language names (e.g., "English").
    *   The `systemPrompt` for the Gemini AI model is then dynamically constructed by taking `BASE_PROMPT` and replacing the `{language}` placeholder with the human-readable language name obtained from `localeMap` based on the `finalLocale`.
    *   This dynamically generated `systemInstruction` is passed to `ai.models.generateContent`, instructing the AI to generate its response in the specified language.

This integrated approach ensures that the user's language preference is respected from the initial welcome message, through speech input, and ultimately in the AI's generated responses.

## Technical Decisions

1.  **Centralizing Prompts in `lib/chatPrompts.ts`:** We decided to extract the AI system prompt from `ChatUI.tsx` into a dedicated `lib/chatPrompts.ts` module. This adheres to the principle of separation of concerns, making `ChatUI.tsx` solely responsible for UI logic and `chatPrompts.ts` for AI prompt management. This decision significantly improves maintainability, simplifies future modifications to the AI's persona or instructions, and makes it easier to add support for more languages without cluttering the UI component.
2.  **Dynamic Language Injection via Placeholder:** Instead of creating separate, hardcoded system prompts for each supported language, we opted for a single `BASE_PROMPT` with a `{language}` placeholder. This allows us to dynamically inject the target language into the prompt on the backend (`/api/chat/route.ts`). This approach is more scalable, reduces redundancy, and ensures consistency in the AI's core instructions across all languages.
3.  **Frontend-to-Backend Locale Propagation:** We chose to pass the active `locale` from the frontend (`ChatUI.tsx`) to the backend API (`/api/chat/route.ts`) in the request body. This ensures that the backend AI service is always aware of the user's preferred language, which is critical for generating locale-aware responses. Retrieving the locale via `useParams` is the standard Next.js way to access route-level locale information.
4.  **Localized Initial Messages:** Providing localized `INITIAL_MESSAGES` directly in `ChatUI.tsx` ensures that the very first interaction a user has with the AI assistant is in their preferred language, enhancing the immediate user experience and setting a welcoming tone.
5.  **Dynamic Speech Recognition Language:** Updating the `SpeechRecognition` API's `lang` property based on the active `locale` was crucial. This ensures that voice input is correctly processed and transcribed in the user's chosen language, improving the accuracy and usability of the voice interaction feature. The `speechLocales` map provides specific regional language codes for optimal performance.
6.  **Fallback to English:** We implemented a fallback mechanism in `apps/web/app/api/chat/route.ts` where if the requested `locale` is not explicitly listed in `supportedLocales`, the system defaults to "en" (English). This prevents errors and ensures a consistent experience even if a user somehow requests an unsupported language.

## How To Re-Implement (Contributor Reference)

To re-implement or extend this locale-aware chat functionality, a contributor would follow these steps:

1.  **Define a Base AI Prompt:**
    *   Create a dedicated module (e.g., `lib/chatPrompts.ts`) to house the core AI system prompt.
    *   Ensure this prompt includes a placeholder for dynamic language injection, such as `IMPORTANT: Respond in {language}.`
    *   Example:
        ```typescript
        // apps/web/lib/chatPrompts.ts
        export const BASE_PROMPT = `
        You are SahiDawa, India's trusted health assistant.
        Respond in {language}.
        `;
        ```

2.  **Manage Supported Locales and Language Mappings:**
    *   In the backend API route (`apps/web/app/api/chat/route.ts`), define an array of `supportedLocales` (e.g., `["en", "hi", "bn"]`).
    *   Create a `localeMap` object that translates these locale codes into human-readable language names that can be injected into the AI prompt (e.g., `{ en: "English", hi: "Hindi", bn: "Bengali" }`).

3.  **Frontend Locale Retrieval and Propagation:**
    *   In the chat UI component (`apps/web/app/components/health/ChatUI.tsx`), use `useParams()` from `next/navigation` to extract the current `locale` from the URL.
    *   When making API calls to the chat endpoint, include this `locale` in the request body:
        ```typescript
        // apps/web/app/components/health/ChatUI.tsx
        const params = useParams();
        const locale = (params.locale as string) || "en";
        // ...
        await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: history, locale }),
        });
        ```

4.  **Localized Initial Messages:**
    *   Define an object of `INITIAL_MESSAGES` in the chat UI component, mapping locales to their respective welcome messages.
    *   Set the initial chat state using the message corresponding to the detected `locale`, with a fallback to English.
    *   Example:
        ```typescript
        // apps/web/app/components/health/ChatUI.tsx
        const INITIAL_MESSAGES = {
            en: "Hello, I'm SahiDawa.",
            bn: "নমস্কার, আমি SahiDawa।",
        };
        // ...
        const initialMessageContent = INITIAL_MESSAGES[locale as keyof typeof INITIAL_MESSAGES] || INITIAL_MESSAGES.en;
        const [messages, setMessages] = useState<Message[]>([{ id: "init", role: "assistant", content: initialMessageContent, timestamp: new Date() }]);
        ```

5.  **Dynamic Speech Recognition Language:**
    *   In the chat UI component, create a `speechLocales` map to provide specific `lang` values for the `SpeechRecognition` API.
    *   Set the `SpeechRecognition` instance's `lang` property dynamically based on the current `locale`.
    *   Example:
        ```typescript
        // apps/web/app/components/health/ChatUI.tsx
        const speechLocales = {
            en: "en-IN",
            bn: "bn-IN",
        };
        // ...
        r.lang = speechLocales[locale as keyof typeof speechLocales] || "en-IN";
        ```

6.  **Backend AI Prompt Construction:**
    *   In the backend API route (`apps/web/app/api/chat/route.ts`), receive the `locale` from the request body.
    *   Implement logic to validate the `locale` against `supportedLocales` and apply a fallback (e.g., to "en").
    *   Use the `localeMap` to get the human-readable language name.
    *   Construct the `systemInstruction` by replacing the placeholder in `BASE_PROMPT` with this language name.
    *   Pass this dynamic `systemInstruction` to the AI model's content generation function.
    *   Example:
        ```typescript
        // apps/web/app/api/chat/route.ts
        import { BASE_PROMPT } from "@/lib/chatPrompts";
        // ...
        const { locale } = await req.json();
        const supportedLocales = ["en", "gu", "bn", "te", "ta", "mr", "ur", "kn"];
        const finalLocale = supportedLocales.includes(locale) ? locale : "en";
        const localeMap = {
            en: "English",
            bn: "Bengali",
            // ...
        };
        const language = localeMap[finalLocale as keyof typeof localeMap] || "English";
        const systemPrompt = BASE_PROMPT.replace("{language}", language);
        // ...
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: formattedContents,
            config: {
                systemInstruction: systemPrompt,
            },
        });
        ```

## Impact on System Architecture

This change significantly enhances the internationalization capabilities of our AI chat system. It establishes a robust pattern for handling locale-aware AI interactions, decoupling the AI's core instructions from the UI layer and making the system more modular and scalable. By centralizing prompts in `lib/chatPrompts.ts`, we've created a single source of truth for AI persona and behavior, which will simplify future updates and expansions. This architectural improvement unlocks the potential for SahiDawa to serve a much broader audience across India, fostering greater inclusivity and accessibility. It also sets a precedent for how other AI-driven features within the platform can be made multilingual.

## Testing & Verification

We verified this change through comprehensive local testing across all newly supported languages. The primary verification steps included:

1.  **UI Localization:** Confirming that the initial welcome message in `ChatUI.tsx` correctly displayed in Bengali, Telugu, Tamil, Marathi, Gujarati, Kannada, and Urdu when the respective locale was active.
2.  **AI Response Language:** Sending various queries to the AI assistant via `/api/chat` while different locales were active and confirming that the AI's responses were consistently generated in the expected language (e.g., Bengali responses for Bengali locale, Urdu for Urdu locale).
3.  **Speech Recognition:** Testing the voice input feature with different languages to ensure that `SpeechRecognition` accurately transcribed spoken words in the selected locale.
4.  **Fallback Mechanism:** Testing with an unsupported locale (if any were to be introduced) to ensure the system gracefully fell back to English for AI responses and initial messages, as designed.
5.  **Existing Functionality:** Ensuring that the core SahiDawa assistant behavior, prompt context, and emergency keyword detection remained intact and functional across all locales.

Screenshots provided in the PR (e.g., `dbb5197a-17bd-46cf-ae89-63182ed50d1b`, `35ab278e-4060-4c11-9876-4cff7c4bff43`, `8713fdbc-6dce-4623-8e6f-ffb9e335bd20`, `94112c0f-1216-4caf-a30b-cbbc9b2b440f`, `a3653690-4936-4c35-9dc3-fb213eb9248f`) visually confirm the localized UI and AI responses in various languages. We confirmed no compile/build errors during local testing.