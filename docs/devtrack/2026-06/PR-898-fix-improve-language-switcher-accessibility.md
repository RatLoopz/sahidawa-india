# PR #898 — fix: improve language switcher accessibility

> **Merged:** 2026-06-01 | **Author:** @Tanish-Solanki | **Area:** Frontend | **Impact Score:** 8 | **Closes:** #808

## What Changed

This pull request significantly enhances the accessibility of the Language Switcher component in our `apps/web` frontend. We have implemented WAI-ARIA compliant `listbox` behavior, comprehensive keyboard navigation support, and improved focus management. The Language Switcher is now fully operable via keyboard and provides correct semantic information to assistive technologies like screen readers, ensuring a more inclusive multilingual experience for all users.

## The Problem Being Solved

Prior to this PR, the Language Switcher component lacked proper accessibility features. It was primarily designed for mouse interaction, making it difficult or impossible for users relying on keyboard navigation or screen readers to effectively switch languages. Specifically, there was no explicit `role` or `aria` attributes to convey its purpose and state to assistive technologies, no keyboard navigation for selecting options, and no programmatic focus management, leading to a poor user experience for a significant portion of our user base. This directly addressed the issues outlined in #808.

## Files Modified

- `apps/web/app/[locale]/LanguageSwitcher.tsx`
- `apps/web/tests/language-switcher-accessibility.test.tsx`

## Implementation Details

The core of this implementation resides within `apps/web/app/[locale]/LanguageSwitcher.tsx`. We introduced several key changes to achieve WAI-ARIA `listbox` compliance and robust keyboard interaction:

1.  **State Management:**
    - A new `open` state (`useState(false)`) manages the visibility of the language dropdown.
    - A `focusedIndex` state (`useState(0)`) tracks the currently highlighted language option within the dropdown for keyboard navigation.

2.  **DOM References:**
    - `useRef` hooks (`ref`, `triggerRef`, `listboxRef`) were added to gain direct access to the component's root `div`, the trigger `button`, and the dropdown `div` (the listbox itself), respectively. These are crucial for programmatic focus management.

3.  **Focus Management on Open:**
    - An `useEffect` hook now programmatically manages focus when the dropdown opens. When `open` becomes `true`, it calculates the `currentIndex` of the currently active `locale`, sets `focusedIndex` to this value, and then calls `listboxRef.current?.focus()` to move keyboard focus to the dropdown container. This ensures that when the listbox appears, the user can immediately start navigating its options.

4.  **Language Switching Logic:**
    - The `switchLanguage` function was updated. After calling `router.replace` to change the locale, it now explicitly sets `setOpen(false)` to close the dropdown and `triggerRef.current?.focus()` to return focus to the trigger button, maintaining a logical focus flow. The previous `setTimeout` was removed for better responsiveness.

5.  **Keyboard Event Handlers:**
    - `handleTriggerKeyDown`: This function is attached to the main language switcher `button`. It intercepts `ArrowDown` and `ArrowUp` keys to immediately open the dropdown (`setOpen(true)`) when pressed on the trigger, preventing default browser behavior.
    - `handleListKeyDown`: This comprehensive handler is attached to the `div` acting as `role="listbox"`. It manages all internal keyboard navigation:
        - `ArrowDown`/`ArrowUp`: Navigates `focusedIndex` up and down the `languages` array, clamping the index to valid bounds. `e.preventDefault()` is called to stop default scrolling.
        - `Home`/`End`: Jumps `focusedIndex` to the first (0) or last (`languages.length - 1`) option.
        - `Enter`/`Space`: Selects the language at the current `focusedIndex` by calling `switchLanguage` and then preventing default behavior.
        - `Escape`: Closes the dropdown (`setOpen(false)`) and returns focus to the `triggerRef.current?.focus()`.
        - `Tab`: Closes the dropdown (`setOpen(false)`) and allows the browser's default tab behavior to continue to the next focusable element outside the component.

6.  **WAI-ARIA Attributes:**
    - **Trigger Button:**
        - `aria-haspopup="listbox"`: Informs assistive technologies that activating this button will open a listbox.
        - `aria-expanded={open}`: Dynamically communicates the open/closed state of the dropdown.
        - `aria-label="Select language"`: Provides a descriptive label for the button.
    - **Dropdown Container (`div`):**
        - `role="listbox"`: Identifies the element as a listbox, a widget that allows the user to select one or more items from a list.
        - `aria-label="Language options"`: Provides an accessible name for the listbox.
        - `aria-activedescendant={`lang-option-${focusedIndex}`}`: Crucially, this attribute on the `listbox` points to the `id` of the currently keyboard-focused `option`. This allows screen readers to announce the focused item without needing actual DOM focus on the option itself.
        - `tabIndex={-1}`: Makes the listbox programmatically focusable without being part of the natural tab order, allowing `listboxRef.current?.focus()` to work.
    - **Individual Language Options (`div`):**
        - `role="option"`: Identifies each item within the listbox as a selectable option.
        - `id={`lang-option-${index}`}`: Provides a unique ID for each option, referenced by `aria-activedescendant`.
        - `aria-selected={isSelected}`: Dynamically indicates whether the option corresponds to the currently selected language.

7.  **Visual Accessibility:**
    - Dynamic CSS classes were added to apply a visible focus indicator (`ring-2 ring-emerald-500/50 ring-inset`) to the `role="option"` element that matches the `focusedIndex`. This provides clear visual feedback for keyboard users.
    - The visual styling for the selected language was also updated to use a small emerald circle instead of a checkmark icon, and the focus styling now applies to both selected and focused states.

## Technical Decisions

We chose to implement the WAI-ARIA `listbox` pattern because it is the standard and most semantically appropriate pattern for a single-selection list of options, which perfectly describes our language switcher. This pattern provides a well-defined set of roles, states, and properties (`role="listbox"`, `role="option"`, `aria-activedescendant`, `aria-selected`, `aria-haspopup`, `aria-expanded`) that assistive technologies understand and can correctly interpret.

Programmatic focus management was essential to ensure a smooth and predictable user experience for keyboard users. By explicitly setting focus to the listbox when it opens and returning it to the trigger when it closes, we prevent focus traps and ensure users can navigate efficiently. The use of `tabIndex={-1}` on the listbox allows us to manage focus without interfering with the natural tab order of the page.

The `useEffect` hook for handling the `Escape` key is a standard React pattern for managing global keyboard events that affect component state. The removal of the `setTimeout` in `switchLanguage` was a performance and responsiveness improvement, as the UI update for closing the dropdown can happen synchronously.

The decision to use `div` elements with `role="option"` instead of `button` elements for the language options was made to strictly adhere to the `listbox` pattern, where `role="option"` is the expected child role. While `button` elements are inherently focusable and clickable, using `role="option"` with custom click handlers and keyboard navigation ensures the correct semantic meaning for screen readers within the `listbox` context.

## How To Re-Implement (Contributor Reference)

To re-implement a WAI-ARIA compliant listbox component from scratch, a contributor would follow these steps:

1.  **Identify Trigger and Listbox Elements:**
    - Create a `button` element to act as the trigger.
    - Create a `div` element to contain the list of options, which will serve as the `listbox`.
    - Create `div` elements for each individual option within the listbox.

2.  **State Management:**
    - Use `useState` for `isOpen` (boolean) to control the visibility of the listbox.
    - Use `useState` for `focusedIndex` (number) to track the currently highlighted option for keyboard navigation.

3.  **DOM References:**
    - Use `useRef` to get references to the trigger button and the listbox container. This is crucial for programmatic focus management.

4.  **ARIA Attributes for Trigger:**
    - Add `aria-haspopup="listbox"` to the trigger button.
    - Add `aria-expanded={isOpen}` to the trigger button, dynamically reflecting its state.
    - Add a descriptive `aria-label` to the trigger button (e.g., "Select an option").

5.  **ARIA Attributes for Listbox Container:**
    - Add `role="listbox"` to the container `div`.
    - Add `aria-label` to the listbox (e.g., "Available options").
    - Add `tabIndex={-1}` to the listbox container to make it programmatically focusable.
    - Implement `aria-activedescendant={`option-id-${focusedIndex}`} ` on the listbox, where `option-id-${focusedIndex}`is the`id` of the currently focused option.

6.  **ARIA Attributes for Options:**
    - For each option `div`:
        - Add `role="option"`.
        - Assign a unique `id` (e.g., `id={`option-id-${index}`}`).
        - Add `aria-selected={isOptionSelected}` to indicate if the option is currently chosen.

7.  **Keyboard Navigation Handlers:**
    - **Trigger Button:** Attach an `onKeyDown` handler. If `ArrowDown` or `ArrowUp` is pressed, prevent default and set `isOpen(true)`.
    - **Listbox Container:** Attach an `onKeyDown` handler. Implement logic for:
        - `ArrowDown`/`ArrowUp`: Increment/decrement `focusedIndex`, clamping values.
        - `Home`/`End`: Set `focusedIndex` to 0 or `options.length - 1`.
        - `Enter`/`Space`: Select the option at `focusedIndex` and close the listbox.
        - `Escape`: Close the listbox and return focus to the trigger button.
        - `Tab`: Close the listbox and allow default tab behavior.
        - Ensure `e.preventDefault()` is called for handled keys to prevent unwanted browser actions.

8.  **Focus Management:**
    - Use `useEffect` to manage focus when `isOpen` changes:
        - When `isOpen` becomes `true`, set `focusedIndex` to the currently selected item (or 0) and call `listboxRef.current?.focus()`.
        - When `isOpen` becomes `false` due to keyboard interaction (e.g., `Escape`), call `triggerRef.current?.focus()`.

9.  **Visual Feedback:**
    - Apply CSS styling (e.g., a `ring` or `outline`) to the option corresponding to `focusedIndex` to provide a clear visual focus indicator for keyboard users.
    - Ensure selected options have distinct visual styling.

10. **Outside Click Handling (Optional but Recommended):**
    - Implement an `useEffect` with a `mousedown` event listener on `document` to close the listbox if a click occurs outside the component's root `div`. (Note: This specific PR removed this, but it's generally good practice for dropdowns).

## Impact on System Architecture

This change primarily impacts the user experience layer of our `apps/web` frontend. It does not introduce new architectural patterns or dependencies at a system level. However, it significantly raises the bar for accessibility standards within SahiDawa. By implementing a complex WAI-ARIA pattern like `listbox` correctly, we establish a precedent and provide a robust example for future UI component development. This improvement ensures that a fundamental interaction like language switching is available to all users, aligning with our mission of inclusive health access. It reinforces our commitment to building a platform that is usable by everyone, regardless of their interaction method or assistive technology.

## Testing & Verification

Verification for this change involved both manual testing and the addition of dedicated automated accessibility tests.

1.  **New Automated Tests:**
    - A new test file, `apps/web/tests/language-switcher-accessibility.test.tsx`, was introduced.
    - This test suite uses `react-dom/server.renderToStaticMarkup` to render the `LanguageSwitcher` component into a static HTML string, allowing for inspection of the rendered ARIA attributes.
    - `jest.mock("react", ...)` was used to mock `React.useState`, enabling us to control the `open` and `focusedIndex` states programmatically within tests. This allowed us to test both the closed (`open=false, focusedIndex=0`) and open (`open=true, focusedIndex=1`) states of the component.
    - `next-intl` and `i18n/routing` were also mocked to isolate the `LanguageSwitcher` component from its Next.js and internationalization context.
    - Assertions were made to verify:
        - The presence and correct values of `aria-haspopup`, `aria-expanded`, and `aria-label` on the trigger button in both open and closed states.
        - The presence of `role="listbox"`, `aria-label="Language options"`, `aria-activedescendant`, and `tabIndex="-1"` on the dropdown container when open.
        - The presence of `role="option"`, unique `id`s, and `aria-selected` on individual language options.
        - The absence of the listbox markup when the component is in its closed state.

2.  **Manual Verification:**
    - Keyboard navigation was manually tested to confirm `ArrowDown`, `ArrowUp`, `Home`, `End`, `Enter`, `Space`, `Escape`, and `Tab` keys function as expected for opening, navigating, selecting, and closing the dropdown.
    - Focus management was verified, ensuring focus correctly shifts to the listbox on open and back to the trigger on close.
    - Visual focus indicators were confirmed to be present and clear for keyboard users.
    - Screen reader compatibility (e.g., with NVDA or VoiceOver) was manually checked to ensure correct announcement of roles, states, and active elements.

3.  **Regression Testing:**
    - Existing locale and translation tests were confirmed to continue passing, ensuring no regressions in core internationalization functionality.
