# PR #1107 — fix(web): improve accessibility in health chat UI

> **Merged:** 2026-06-02 | **Author:** @himanithakre56 | **Area:** Frontend | **Impact Score:** 13 | **Closes:** #946

## What Changed

This pull request significantly enhances the accessibility of our AI Health Assistant Chat UI within the `apps/web` frontend. We have implemented WAI-ARIA attributes to provide better semantic meaning for assistive technologies, specifically for icon-only controls, the chat input textarea, and the dynamic chat conversation log, ensuring a more inclusive user experience for screen reader users.

## The Problem Being Solved

Before this PR, the AI Health Assistant chat interface (`apps/web/app/components/health/ChatUI.tsx`) presented several accessibility barriers for users relying on screen readers. Icon-only buttons, such as the voice input toggle and the send message button, lacked descriptive labels, making their purpose unclear. The chat input textarea also lacked proper accessible labeling. Crucially, new messages appearing in the chat conversation were not announced to screen readers, hindering users from following the conversation flow. This directly addressed the accessibility concerns outlined in issue #946.

## Files Modified

- `apps/web/README.md`
- `apps/web/app/[locale]/components/SearchBar.tsx`
- `apps/web/app/components/health/ChatUI.tsx`
- `docs/devtrack/2026-06/PR-1095-fixes-white-flash-on-pharmacy-map-page-navigation-.md`
- `docs/devtrack/README.md`
- `docs/devtrack/adr/ADR-019-fixes-white-flash-on-pharmacy-map-page-navigation-.md`

## Implementation Details

The core accessibility improvements were implemented within `apps/web/app/components/health/ChatUI.tsx`.

1.  **Chat Conversation Log Accessibility:**
    - The `main` HTML element that serves as the container for chat messages (referenced by `messagesContainerRef`) was enhanced. We added `role="log"`, `aria-live="polite"`, and `aria-label="Chat conversation"`.
    - `role="log"` semantically identifies this region as a message log, indicating to assistive technologies that new content is added frequently and should be announced.
    - `aria-live="polite"` instructs screen readers to announce updates to this region without interrupting the user's current task, which is ideal for a chat interface where new messages appear asynchronously.
    - `aria-label="Chat conversation"` provides a descriptive name for the entire chat log area, making it easier for users to understand its purpose when navigating.

2.  **Voice Input Toggle Button Accessibility:**
    - The `button` element responsible for toggling voice input (`onClick={toggleVoice}`) was updated.
    - We added a dynamic `aria-label` attribute: `aria-label={isListening ? "Stop voice input" : "Start voice input"}`. This ensures that the button's purpose is clearly communicated to screen readers, changing based on its current state (listening or not).
    - An `aria-pressed={isListening}` attribute was also added. This attribute indicates the toggle state of the button, informing screen readers whether the voice input is currently active (pressed) or inactive.

3.  **Chat Textarea Accessibility:**
    - The `textarea` element used for typing health questions was made more accessible.
    - We assigned a unique `id="chat-input"` to the textarea.
    - An `aria-label="Type your health question"` was added directly to the `textarea` to provide a clear, concise label for screen readers.
    - Additionally, a visually hidden `label` element (`<label htmlFor="chat-input" className="sr-only">Type your health question</label>`) was introduced immediately before the `textarea`. While `aria-label` is often sufficient, providing a semantic `label` linked via `htmlFor` is considered a robust accessibility practice, especially for input fields. The `sr-only` class ensures it's only available to screen readers.

4.  **Send Message Button Accessibility:**
    - The `button` element used to send messages (`onClick={() => sendMessage(input)}`) was given an `aria-label="Send message"`. This provides a clear, descriptive label for screen reader users, indicating the button's function.

Minor formatting changes were also applied to `apps/web/README.md` (table alignment) and `apps/web/app/[locale]/components/SearchBar.tsx` (self-closing tag formatting for `Search` icon). These changes are incidental to the primary accessibility fix.

## Technical Decisions

Our primary technical decision was to leverage WAI-ARIA attributes to enhance the semantic structure of the AI Health Assistant chat UI without altering its visual design.

- **WAI-ARIA for Semantic Meaning:** We chose to implement `aria-label`, `aria-pressed`, `role="log"`, and `aria-live="polite"` because they are the standard and most effective way to convey complex UI states and dynamic content updates to assistive technologies. This approach ensures that screen readers can accurately interpret and announce the interface elements and their behavior.
- **`aria-live="polite"` for Chat Log:** For the chat conversation container, `aria-live="polite"` was specifically chosen over `aria-live="assertive"`. `Polite` ensures that new messages are announced in a non-disruptive manner, waiting for the user to finish their current task or interaction. `Assertive` would immediately interrupt the user, which is generally reserved for critical, time-sensitive updates (e.g., error messages) and would be jarring in a chat context.
- **Dynamic `aria-label` for Toggle Buttons:** The use of a dynamic `aria-label` for the voice input button (`isListening ? "Stop voice input" : "Start voice input"`) was a deliberate choice to provide context-sensitive information. This allows screen reader users to understand the current action the button will perform, rather than just its generic function.
- **`sr-only` Label for Textarea:** Combining an `id` and `htmlFor`-linked `label` with an `sr-only` class alongside `aria-label` on the `textarea` itself provides maximum compatibility and semantic correctness. The `sr-only` class (likely a Tailwind CSS utility) hides the label visually while keeping it available to screen readers, maintaining our clean UI design.

No alternative accessibility libraries or frameworks were considered, as direct ARIA attribute application is the most performant and direct method for these specific UI enhancements in a React/Next.js environment.

## How To Re-Implement (Contributor Reference)

To re-implement or apply similar accessibility improvements to other interactive UI components in our `apps/web` frontend, follow these patterns:

1.  **Identify Interactive Elements:** Scan your component for buttons, input fields, and dynamic content areas that lack clear textual labels or whose state changes dynamically.
2.  **Icon-Only Buttons:**
    - For any `button` element that only contains an icon (e.g., `<IconMic />`), add an `aria-label` attribute.
    - The `aria-label` should concisely describe the button's action.
    - **Example:** `<button aria-label="Start voice input"> <IconMic /> </button>`
    - **Toggle Buttons:** If the button toggles a state, also add `aria-pressed` and update its value dynamically based on the component's state.
    - **Example (from `ChatUI.tsx`):**
        ```tsx
        <button
            onClick={toggleVoice}
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
            aria-pressed={isListening}
            // ... other props
        >
            {isListening ? <IconStop /> : <IconMic size={20} />}
        </button>
        ```
3.  **Input Fields (Textarea, Input):**
    - Assign a unique `id` to the input element (e.g., `id="my-input"`).
    - Add an `aria-label` attribute to the input element with a descriptive label.
    - Optionally, and for robust semantic correctness, add a `label` element immediately preceding the input. Link it using `htmlFor` and apply the `sr-only` class (or equivalent) to hide it visually.
    - **Example (from `ChatUI.tsx`):**
        ```tsx
        <label htmlFor="chat-input" className="sr-only">
            Type your health question
        </label>
        <textarea
            id="chat-input"
            aria-label="Type your health question"
            // ... other props
        />
        ```
4.  **Dynamic Content Areas (Chat Logs, Feeds):**
    - For containers where content is frequently added and should be announced to screen readers, apply `role="log"` and `aria-live="polite"`.
    - Add an `aria-label` to the container to describe its purpose.
    - **Example (from `ChatUI.tsx`):**
        ```tsx
        <main
            ref={messagesContainerRef}
            role="log"
            aria-live="polite"
            aria-label="Chat conversation"
            // ... other props
        >
            {/* Chat messages */}
        </main>
        ```
5.  **Dependencies:** No new external dependencies are required for these ARIA attribute implementations, as they are native HTML attributes. Ensure your CSS framework (e.g., Tailwind CSS) provides an `sr-only` utility class or implement one manually (`position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0;`).

## Impact on System Architecture

This change primarily impacts the user-facing layer of our `apps/web` frontend, specifically the `ChatUI` component. It does not introduce new architectural patterns, modify our backend APIs, database schemas, or core framework choices (Next.js, React, Tailwind CSS).

The main impact is a significant improvement in the accessibility posture of the SahiDawa platform. By making the AI Health Assistant chat more usable for individuals with visual impairments, we reinforce our commitment to building an inclusive platform. This PR serves as a strong example and sets a precedent for future UI development, encouraging contributors to consider accessibility from the initial design phase of new features. It unlocks a better user experience for a wider audience, aligning with our mission of providing health services to all.

## Testing & Verification

The PR description states that "all existing tests continue to pass," and a screenshot of successful test results was provided. This indicates that our existing Jest-based unit or integration tests for the `ChatUI` component were not broken by these changes.

For thorough verification of accessibility improvements, manual testing with various screen readers (e.g., NVDA on Windows, VoiceOver on macOS/iOS, TalkBack on Android) is crucial. This involves:

1.  Navigating to the AI Health Assistant chat page (`/health`).
2.  Using a screen reader to interact with the voice input toggle button and verifying its `aria-label` and `aria-pressed` states are correctly announced.
3.  Focusing on the chat input `textarea` and confirming its accessible label is read aloud.
4.  Sending messages and observing that new messages appearing in the chat conversation are announced by the screen reader without being overly disruptive, confirming the `role="log"` and `aria-live="polite"` behavior.

Specific accessibility test scripts, such as the `test:a11y:voice` script mentioned in `apps/web/README.md`, were not explicitly documented as having been run for this PR beyond the general statement of existing tests passing.
