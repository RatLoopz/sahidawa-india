# PR #1045 — fix: resolve multilingual localization inconsistency

> **Merged:** 2026-06-01 | **Author:** @vaishnavikhatri3 | **Area:** Frontend | **Impact Score:** 13 | **Closes:** #965

## What Changed

This PR addresses multilingual localization inconsistencies within our `apps/web` Next.js frontend. Specifically, we updated the `Chatbot.tsx` and `ChatUI.tsx` components to dynamically consume translation resources using the `next-intl` library. Hardcoded user-facing strings in `Chatbot.tsx` were replaced with translation keys, and corresponding English translations were added to `apps/web/messages/en.json` under new `chatbot` and `chat` namespaces.

## The Problem Being Solved

Before this PR, several UI components, notably our `Chatbot` and `ChatUI` interfaces, contained hardcoded user-facing strings. This meant that when a user switched the application's language, these specific components would remain untranslated, displaying their original English text. This resulted in a mixed-language user experience, creating inconsistency and hindering accessibility for our diverse user base, as reported in issue #965. The system failed to provide a fully localized experience across all interactive elements.

## Files Modified

- `apps/web/app/[locale]/components/Chatbot.tsx`
- `apps/web/app/components/health/ChatUI.tsx`
- `apps/web/messages/en.json`

## Implementation Details

The core of this implementation involved integrating `next-intl`'s `useTranslations` hook into the affected components and externalizing their user-facing strings into our locale message files.

1.  **`apps/web/app/[locale]/components/Chatbot.tsx`**:
    - We imported the `useTranslations` hook from `next-intl`.
    - Inside the `Chatbot` functional component, we initialized the translation function by calling `const t = useTranslations("chatbot");`. This binds the `t` function to the `chatbot` namespace defined in our `messages/*.json` files.
    - The following hardcoded strings were replaced with dynamic translation calls:
        - The initial welcome message `"Hi! I am the SahiDawa AI Assistant. How can I help you with your medicines today?"` was replaced with `{t("welcome")}`.
        - The chatbot's title `"SahiDawa AI"` was replaced with `{t("title")}`.
        - The online status `"Online"` was replaced with `{t("status")}`.
        - The input placeholder text `"Ask me about a medicine..."` was replaced with `placeholder={t("placeholder")}`.
    - This ensures that all these UI elements within the `Chatbot` component will now update their content dynamically based on the currently selected locale.

2.  **`apps/web/app/components/health/ChatUI.tsx`**:
    - We imported the `useTranslations` hook from `next-intl`.
    - Inside the `ChatUI` functional component, we initialized the translation function by calling `const t = useTranslations("chat");`. This binds the `t` function to the `chat` namespace.
    - While the provided diff does not explicitly show existing hardcoded strings being replaced with `t()` calls within `ChatUI.tsx`, the addition of the `useTranslations` hook and the corresponding `chat` namespace in `en.json` indicates the intent and readiness for dynamic localization of its UI elements. The `sendMessage` callback was slightly refactored to use a `trimmed` variable for clarity, but its core functionality remains unchanged.

3.  **`apps/web/messages/en.json`**:
    - We introduced two new top-level JSON objects to serve as namespaces for our translations:
        - `"chat"`: This namespace was created to house all English strings related to the `ChatUI` component. It includes keys such as `"welcome"`, `"listening"`, `"placeholder"`, `"quick_actions"`, `"footer"`, and nested objects for `"actions"` like `"scan"`, `"symptoms"`, and `"pharmacy"`, each with `label` and `description` keys.
        - `"chatbot"`: This namespace was created for the `Chatbot` component's English strings. It includes keys like `"title"`, `"status"`, `"welcome"`, and `"placeholder"`.
    - These additions provide the base English translations that `next-intl` will use, and which can be extended to other locale files (e.g., `hi.json`) for full multilingual support.

## Technical Decisions

1.  **Leveraging `next-intl` for Dynamic Localization:** We chose to continue using `next-intl` as it is our established and robust internationalization library for the Next.js frontend. Its `useTranslations` hook provides a clean, React-idiomatic way to access locale-specific strings within functional components, ensuring dynamic updates upon language changes without manual state management.
2.  **Namespace-Based Translation Organization:** The decision to create distinct `chatbot` and `chat` namespaces within `messages/en.json` (and other locale files) was made to improve the maintainability and readability of our translation resources. This approach prevents key collisions, groups related strings logically, and makes it easier for contributors to locate and manage translations for specific components.
3.  **Client-Side Translation for Interactive Components:** Since both `Chatbot` and `ChatUI` are interactive, client-side components, using `useTranslations` within them is the appropriate pattern. This ensures that the UI updates instantly when the user changes the language, providing a seamless experience.

## How To Re-Implement (Contributor Reference)

To implement dynamic localization for a new or existing component using `next-intl`, follow these steps:

1.  **Identify Localizable Strings:** Review the target component (e.g., `MyNewComponent.tsx`) and identify all user-facing strings that need to be translated (e.g., headings, button labels, placeholders, error messages).
2.  **Import `useTranslations`:** At the top of your component file, import the necessary hook:
    ```typescript
    import { useTranslations } from "next-intl";
    ```
3.  **Initialize Translation Hook:** Inside your functional component, call `useTranslations` with a unique namespace that logically groups your component's strings. For example:
    ```typescript
    export default function MyNewComponent() {
        const t = useTranslations("myNewComponentNamespace");
        // ... rest of your component logic
    }
    ```
4.  **Add Translations to Locale Files:** Open `apps/web/messages/en.json` (and any other supported locale files like `hi.json`). Add a new top-level key matching your chosen namespace, and populate it with key-value pairs for each string you identified in step 1.
    ```json
    {
        // ... existing namespaces
        "myNewComponentNamespace": {
            "title": "Welcome to My Component",
            "buttonLabel": "Click Me",
            "placeholderText": "Enter your text here..."
        }
    }
    ```
5.  **Replace Hardcoded Strings:** In your component's JSX, replace the hardcoded strings with calls to the `t` function, passing the corresponding key:
    ```typescript
    <h1 className="text-xl">{t("title")}</h1>
    <button>{t("buttonLabel")}</button>
    <input type="text" placeholder={t("placeholderText")} />
    ```
6.  **Verify Functionality:** Run the application locally and switch between different languages to ensure that all translated strings update correctly. Check for any layout issues caused by varying string lengths.

**Gotchas:**

- Ensure the namespace provided to `useTranslations` exactly matches the key in your `messages/*.json` files.
- Remember to add all new translation keys to _all_ supported locale files (e.g., `en.json`, `hi.json`). Missing keys will typically display the key itself or a fallback, which is undesirable.
- For complex translations involving variables, plurals, or rich text, refer to the `next-intl` documentation for advanced features.

## Impact on System Architecture

This PR further solidifies our frontend's internationalization architecture by extending dynamic localization to critical interactive components. It reinforces the pattern of externalizing all user-facing strings, making our application more adaptable to new languages and ensuring a consistent multilingual experience. This change reduces technical debt associated with hardcoded strings and makes future feature development easier, as new UI elements can be localized from inception using the established `next-intl` pattern. It directly contributes to SahiDawa's goal of being accessible and user-friendly across diverse linguistic backgrounds in India.

## Testing & Verification

The author performed local testing, as indicated by the "Contributor Checklist" and the provided screenshot. The screenshot demonstrates the `Chatbot` component's UI, implying visual verification of the changes. The checklist also confirms that the project ran locally without compile/build errors and that a self-review was conducted.

**Edge Cases:** Not documented in this PR. However, typical edge cases for i18n that would require further testing include:

- **Missing Translations:** What happens if a key exists in `en.json` but is missing in another locale file (e.g., `hi.json`)? `next-intl` typically falls back or displays the key, which should be handled gracefully.
- **String Length Variations:** Translations can vary significantly in length. UI elements containing these strings should be tested to ensure they do not overflow or cause layout shifts in different languages.
- **Dynamic Content:** If any part of the chatbot's response or `ChatUI`'s content is generated dynamically (e.g., from an API), ensuring that dynamic content is also localized or handled appropriately is crucial. This PR primarily addresses static UI strings.
