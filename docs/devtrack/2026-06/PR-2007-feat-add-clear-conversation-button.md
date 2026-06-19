# PR #2007 — feat: add clear conversation button

> **Merged:** 2026-06-17 | **Author:** @karansankrit01 | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #1918

## What Changed

This pull request introduces a new "Clear Conversation" button within our `Chatbot` component, located in the header alongside other action buttons. This button enables users to reset their current chat session, effectively clearing all previous messages and returning the chatbot to its initial welcome state. A two-step confirmation process is implemented to prevent accidental clearing, enhancing the user experience by providing explicit control over chat history.

## The Problem Being Solved

Prior to this change, users of our SahiDawa chatbot had no direct way to clear or reset their conversation history within the UI. If a user wanted to start a new topic, correct a previous interaction, or simply remove sensitive information from the chat display, their only option was to refresh the page, which is not intuitive and disrupts the user flow. This missing functionality led to a suboptimal user experience, as it limited user control over their interaction with the chatbot. Issue #1918 specifically highlighted this UX gap, requesting a dedicated feature for clearing chat history.

## Files Modified

- `apps/web/app/[locale]/components/Chatbot.tsx`

## Implementation Details

Our system implemented the clear conversation functionality by modifying the existing `Chatbot.tsx` component.

1.  **New State Variable:** A new `useState` variable, `isConfirmingClear`, was introduced and initialized to `false`. This boolean state manages the two-step confirmation process for clearing the conversation, toggling between the initial "clear" button and the "confirm/cancel" buttons.
2.  **New Icons:** The `Trash2` icon (for the initial clear button) and `Check` icon (for the confirm action) were imported from the `lucide-react` library, alongside existing icons like `MessageSquare` and `X`, maintaining consistency with our UI toolkit.
3.  **`handleClear` Function:** A new function, `handleClear`, was added to encapsulate the core logic for resetting the chat. This function performs three critical actions:
    - It calls `activeRequestRef.current?.abort()` to immediately terminate any ongoing API requests. This is crucial to prevent stale or irrelevant responses from being added to a newly cleared chat.
    - It resets the `messages` state array to its initial state, containing only the welcome message object (`{ text: "welcome", isBot: true, isTranslationKey: true }`).
    - It clears the `input` state by setting it to an empty string, ensuring the chat input field is empty after the conversation is reset.
    - Finally, it sets `isConfirmingClear` back to `false`, exiting the confirmation UI and returning to the default clear button.
4.  **Conditional Rendering in JSX:** Within the `Chatbot` component's JSX, a conditional rendering block was added in the header section, specifically within the `div` containing other action buttons (like the `Home` link).
    - When `isConfirmingClear` is `true`, a confirmation UI is rendered. This UI consists of a `div` containing two distinct buttons:
        - A "Confirm" button, styled with `text-green-300` and displaying the `Check` icon. Clicking this button triggers the `handleClear` function.
        - A "Cancel" button, styled with `text-red-300` and displaying the `X` icon. Clicking this button sets `isConfirmingClear` to `false`, reverting the UI to the initial clear button without performing the clear action.
    - When `isConfirmingClear` is `false`, the primary "Clear" button is rendered. This button displays the `Trash2` icon and, when clicked, sets `isConfirmingClear` to `true`, initiating the confirmation flow.
5.  **Accessibility and Internationalization:** Both the initial clear button and the confirmation/cancel buttons include `aria-label` and `title` attributes. These attributes utilize our `next-intl` translation system (`t("clear")`, `t("confirmClear")`, `t("cancelClear")`) to ensure proper accessibility for screen readers and provide helpful tooltips for all users, regardless of their preferred language.

## Technical Decisions

We opted for a two-step confirmation process for clearing the conversation (`isConfirmingClear` state) to prevent accidental data loss. While a single-click clear might seem simpler, the irreversible nature of deleting chat history warrants a confirmation step to improve user confidence and prevent frustration. This pattern is a standard UX practice for destructive actions in applications.

The decision to abort any active API requests (`activeRequestRef.current?.abort()`) when `handleClear` is called is a critical safeguard. This prevents a scenario where a user clears the chat, but a pending response from a previous query then populates the newly cleared chat, which would be confusing and undesirable. This ensures a clean slate immediately.

We leveraged `lucide-react` for the new `Trash2` and `Check` icons, which is our established icon library. This choice ensures visual consistency across our SahiDawa platform. The use of `next-intl` for button labels (`t("clear")`, `t("confirmClear")`, `t("cancelClear")`) ensures that this feature is fully localized and accessible to our diverse user base, aligning with our commitment to internationalization.

No alternative approaches were explicitly documented in this PR, but the current implementation aligns with best practices for user interaction design for destructive actions within a React component.

## How To Re-Implement (Contributor Reference)

To re-implement this "Clear Conversation" feature from scratch in a similar React component using Next.js and `next-intl`, a contributor would follow these steps:

1.  **Import Necessary Components and Hooks:**
    - Ensure `useState`, `useRef`, `useEffect` are imported from `react`.
    - Import `useTranslations` from `next-intl`.
    - Import `MessageSquare`, `X`, `Send`, `Bot`, `Home`, `Trash2`, `Check` from `lucide-react`.

2.  **Define State Variables:**
    - Initialize the `messages` state with the default welcome message for the chatbot.
    - Initialize the `input` state for the chat input field.
    - Introduce a new state variable for the confirmation flow: `const [isConfirmingClear, setIsConfirmingClear] = useState(false);`

3.  **Create the `handleClear` Function:**
    - Define a function, `handleClear`, that will encapsulate the reset logic.
    - Inside `handleClear`:
        - Access the `activeRequestRef` (assuming it's a `useRef` holding an `AbortController` instance for ongoing API calls) and call `activeRequestRef.current?.abort()` to cancel any pending requests.
        - Reset the `messages` state to its initial welcome message:
            ```typescript
            setMessages([
                {
                    text: "welcome", // This should be a key for next-intl
                    isBot: true,
                    isTranslationKey: true,
                },
            ]);
            ```
        - Clear the input field: `setInput("");`
        - Reset the confirmation state: `setIsConfirmingClear(false);`

4.  **Integrate into JSX (Chatbot Header):**
    - Locate the section in the `Chatbot` component's JSX where action buttons (like the `Home` link) are rendered, typically within a header or control area.
    - Implement conditional rendering based on the `isConfirmingClear` state:
        ```tsx
        <div className="flex items-center gap-1">
            {isConfirmingClear ? (
                <div className="flex items-center gap-1 rounded-full bg-white/10 px-1 py-0.5">
                    <button
                        onClick={handleClear}
                        className="rounded-full p-1.5 text-green-300 transition-colors hover:bg-white/20 hover:text-green-200"
                        aria-label={t("confirmClear")}
                        title={t("confirmClear")}
                    >
                        <Check size={16} />
                    </button>
                    <button
                        onClick={() => setIsConfirmingClear(false)}
                        className="rounded-full p-1.5 text-red-300 transition-colors hover:bg-white/20 hover:text-red-200"
                        aria-label={t("cancelClear")}
                        title={t("cancelClear")}
                    >
                        <X size={16} />
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setIsConfirmingClear(true)}
                    className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                    aria-label={t("clear")}
                    title={t("clear")}
                >
                    <Trash2 size={18} />
                </button>
            )}
            {/* Ensure existing Home link or other buttons are still rendered */}
            <Link
                href="/"
                className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                aria-label={t("home")}
                title={t("home")}
            >
                <Home size={18} />
            </Link>
        </div>
        ```

5.  **Add Translations:**
    - Ensure the `next-intl` translation files (e.g., `messages/en.json`, `messages/hi.json`) include entries for the keys `clear`, `confirmClear`, and `cancelClear`. For example, in `messages/en.json`:
        ```json
        {
            "clear": "Clear conversation",
            "confirmClear": "Confirm clear conversation",
            "cancelClear": "Cancel clear conversation"
        }
        ```

This approach ensures a robust, user-friendly, and accessible clear conversation feature, consistent with our existing frontend architecture.

## Impact on System Architecture

This change primarily impacts the frontend user experience of our SahiDawa platform by enhancing the `Chatbot` component's interactivity and user control. Architecturally, it is a self-contained feature within the client-side application and does not introduce new backend services, API endpoints, or database schema changes. It leverages existing frontend state management patterns (`useState`, `useRef`) and our established UI component library (`lucide-react`) and internationalization framework (`next-intl`).

The ability to programmatically abort active requests (`activeRequestRef.current?.abort()`) when clearing the chat reinforces the robustness of our frontend's interaction with the backend, preventing orphaned or irrelevant responses from affecting the UI state. This pattern is beneficial for any future features involving user-initiated resets or cancellations of ongoing operations. This feature unlocks improved user satisfaction and control within the chatbot interface, making it a more versatile tool for health information and verification, without altering the core backend services.

## Testing & Verification

This change was verified through manual testing, as evidenced by the provided screenshots in the PR description. The testing involved:

1.  **Initial State:** Opening the chatbot and observing the "Clear Conversation" button with the `Trash2` icon in the chatbot header.
2.  **Confirmation Flow Activation:** Clicking the "Clear Conversation" button and verifying that the UI transitions to display the "Confirm" (`Check` icon) and "Cancel" (`X` icon) buttons, replacing the initial clear button.
3.  **Cancel Action Verification:** Clicking the "Cancel" button and confirming that the UI reverts to the initial "Clear Conversation" button without clearing the chat history.
4.  **Confirm Action Verification:** Clicking the "Confirm" button and verifying that:
    - The entire chat history is cleared, and only the initial welcome message is displayed.
    - The input field is empty.
    - The UI reverts to the initial "Clear Conversation" button.
5.  **Active Request Abort (Implicit):** While not explicitly shown in screenshots, the `handleClear` function's call to `activeRequestRef.current?.abort()` implies testing for scenarios where a chat is cleared while a response from the backend is pending. This ensures no stale data populates the new conversation.

Edge cases considered during manual verification included:

- **No active conversation:** The button should still be present and functional, resetting to the welcome message even if no user messages were sent.
- **Ongoing API request:** The `activeRequestRef.current?.abort()` call handles this, preventing a response from an old query from appearing in the new, cleared chat.
- **Rapid clicks:** The confirmation step mitigates issues with accidental rapid clicks, requiring a deliberate second action to clear the chat.

Automated unit or integration tests for this specific feature were not documented in this PR.
