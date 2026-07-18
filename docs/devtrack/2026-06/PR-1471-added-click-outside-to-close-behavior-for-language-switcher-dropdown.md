# PR #1471 — Added Click outside to close behavior for language switcher Dropdown

> **Merged:** 2026-06-07 | **Author:** @hrx01-dev | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #1373

## What Changed

We have enhanced the `LanguageSwitcher` component in `apps/web/app/[locale]/LanguageSwitcher.tsx` to include "click outside to close" functionality for its dropdown menu. This change also refines the existing "escape key to close" behavior by ensuring focus is programmatically returned to the trigger button, significantly improving user experience and accessibility.

## The Problem Being Solved

Previously, the language switcher dropdown in `apps/web/app/[locale]/LanguageSwitcher.tsx` lacked a common and expected user interaction pattern: the ability to close the dropdown by clicking anywhere outside its boundaries. Users could only dismiss the dropdown by re-clicking the toggle button or by pressing the Escape key. This led to a less intuitive and potentially frustrating user experience, as it deviated from standard web UI behavior for dropdowns and popovers (Issue #1373). Furthermore, while the Escape key closed the dropdown, it did not explicitly return focus to the trigger element, which could disorient keyboard users.

## Files Modified

- `apps/web/app/[locale]/LanguageSwitcher.tsx`

## Implementation Details

The core of this change resides within the `useEffect` hook of the `LanguageSwitcher` functional component in `apps/web/app/[locale]/LanguageSwitcher.tsx`.

1.  **Conditional Listener Attachment:** The `useEffect` hook now begins with an `if (!open) return;` guard clause. This critical optimization ensures that the global `mousedown` and `keydown` event listeners are only attached to the `document` when the `LanguageSwitcher` dropdown is actively visible (i.e., its `open` state variable is `true`). This prevents unnecessary event processing when the dropdown is closed.

2.  **Unified Dismissal Handler (`handleDismiss`):** A new, consolidated event handler function, `handleDismiss`, was introduced within the `useEffect` scope. This function is responsible for processing both keyboard and mouse events that should trigger the dropdown's closure:
    *   **Keyboard Dismissal:** If the event is a `KeyboardEvent` and `e.key` is `"Escape"`, the `setOpen(false)` state update is triggered to close the dropdown. Crucially, `triggerRef.current?.focus()` is then called to programmatically return keyboard focus to the language switcher's globe button, enhancing accessibility.
    *   **Click Outside Dismissal:** If the event is a `MouseEvent`, the logic checks `ref.current && !ref.current.contains(e.target as Node)`. Here, `ref.current` refers to the DOM element of the dropdown container itself (obtained via `useRef`). If the clicked target (`e.target`) is not a descendant of the dropdown's container, `setOpen(false)` is called to close the dropdown.

3.  **Event Listener Management:**
    *   When the `open` state becomes `true`, `document.addEventListener("mousedown", handleDismiss)` and `document.addEventListener("keydown", handleDismiss)` are registered.
    *   The `useEffect` hook's cleanup function (`return () => { ... };`) is responsible for properly detaching these listeners: `document.removeEventListener("mousedown", handleDismiss)` and `document.removeEventListener("keydown", handleDismiss)`. This cleanup occurs when the component unmounts or when the `open` dependency changes (e.g., when the dropdown closes), preventing memory leaks and ensuring listeners are only active when needed.

4.  **Dependencies:** The `useEffect` hook now lists `open` as a dependency, ensuring that the effect re-runs and re-attaches/detaches listeners appropriately whenever the dropdown's visibility state changes.

## Technical Decisions

1.  **`mousedown` vs. `click` for Outside Detection:** We opted to use the `mousedown` event listener instead of `click` for detecting outside interactions. `mousedown` fires earlier in the event propagation cycle than `click`. This choice helps prevent potential race conditions or unintended side effects where a `click` event on an element outside the dropdown might trigger its own action *before* the dropdown has a chance to close, leading to a less predictable user experience.
2.  **Consolidated `handleDismiss` Function:** Grouping both keyboard and mouse dismissal logic into a single `handleDismiss` function within the `useEffect` hook promotes code readability and maintainability. It centralizes the "how to close" logic, making it easier to understand and modify.
3.  **Conditional `useEffect` Execution (`if (!open) return;`):** Attaching global event listeners only when the dropdown is open is a deliberate performance optimization. It minimizes the number of active listeners on the `document` object, reducing the overhead of event processing when the dropdown is not visible and preventing unnecessary checks.
4.  **Focus Restoration on Escape Key:** The decision to explicitly call `triggerRef.current?.focus()` after closing the dropdown with the Escape key is a critical accessibility enhancement. It ensures that keyboard users are returned to a logical and predictable focus point (the button that opened the dropdown), maintaining a consistent navigation flow and preventing them from losing their place on the page.

## How To Re-Implement (Contributor Reference)

To re-implement this "click outside to close" and enhanced "escape to close" behavior for a similar dropdown component in SahiDawa, a contributor would follow these steps:

1.  **Component Setup:**
    *   Ensure your component manages its open/closed state using `useState`, e.g., `const [open, setOpen] = useState(false);`.
    *   Create `useRef` hooks for both the dropdown's main container element and its trigger button:
        ```typescript
        const dropdownRef = useRef<HTMLDivElement>(null);
        const triggerRef = useRef<HTMLButtonElement>(null);
        ```
    *   Attach these refs to their respective JSX elements:
        ```jsx
        <button ref={triggerRef} onClick={() => setOpen(!open)}>Toggle Dropdown</button>
        {open && (
            <div ref={dropdownRef} className="dropdown-menu">
                {/* Dropdown content */}
            </div>
        )}
        ```

2.  **Implement the `useEffect` Hook:**
    *   Add a `useEffect` hook that depends on the `open` state.
    *   Inside the effect, add a guard clause to only proceed if the dropdown is `open`.
    *   Define the `handleDismiss` event handler function.
    *   Attach `mousedown` and `keydown` listeners to the `document`.
    *   Provide a cleanup function to remove these listeners.

    ```typescript
    import React, { useState, useEffect, useRef } from 'react';

    function MyDropdownComponent() {
        const [open, setOpen] = useState(false);
        const dropdownRef = useRef<HTMLDivElement>(null);
        const triggerRef = useRef<HTMLButtonElement>(null);

        useEffect(() => {
            // Only attach listeners when the dropdown is open
            if (!open) return;

            const handleDismiss = (e: MouseEvent | KeyboardEvent) => {
                // Handle Escape key press
                if (e instanceof KeyboardEvent && e.key === "Escape") {
                    setOpen(false);
                    // Return focus to the trigger button for accessibility
                    triggerRef.current?.focus();
                }
                // Handle click outside the dropdown
                else if (
                    e instanceof MouseEvent &&
                    dropdownRef.current &&
                    !dropdownRef.current.contains(e.target as Node)
                ) {
                    setOpen(false);
                }
            };

            // Attach global event listeners
            document.addEventListener("mousedown", handleDismiss);
            document.addEventListener("keydown", handleDismiss);

            // Cleanup function to remove listeners when component unmounts or 'open' changes
            return () => {
                document.removeEventListener("mousedown", handleDismiss);
                document.removeEventListener("keydown", handleDismiss);
            };
        }, [open]); // Re-run this effect whenever the 'open' state changes

        return (
            <div>
                <button ref={triggerRef} onClick={() => setOpen(!open)} aria-expanded={open}>
                    Select Language
                </button>
                {open && (
                    <div ref={dropdownRef} className="language-switcher-dropdown">
                        {/* Language options */}
                        <p>Option 1</p>
                        <p>Option 2</p>
                    </div>
                )}
            </div>
        );
    }
    ```

3.  **Key Considerations:**
    *   **Typing:** Ensure correct type assertions for event objects (e.g., `e.target as Node`) and event types (`MouseEvent | KeyboardEvent`).
    *   **Accessibility:** Always prioritize returning focus to a logical element after keyboard dismissal.
    *   **Performance:** The conditional listener attachment (`if (!open) return;`) is crucial for performance in components that might frequently open and close.

## Impact on System Architecture

This change primarily enhances the user experience and accessibility of our frontend. While not a fundamental shift in our system's architecture, it establishes a robust and idiomatic pattern for handling dropdown dismissals. This pattern can now be consistently applied to other interactive UI components across the SahiDawa platform, leading to a more predictable, intuitive, and accessible user interface. It reinforces our commitment to modern web development best practices, particularly regarding user interaction and accessibility standards. This improvement contributes to a higher overall quality of our frontend components without introducing new dependencies or complex architectural layers.

## Testing & Verification

This change was primarily verified through manual testing, as indicated by the "Proof of Work" requirement in the PR description.

**Test Cases:**

1.  **Click Outside:**
    *   Open the language switcher dropdown by clicking the globe icon.
    *   Click anywhere on the page *outside* the dropdown menu.
    *   **Expected Outcome:** The language switcher dropdown closes.
2.  **Escape Key Dismissal:**
    *   Open the language switcher dropdown.
    *   Press the `Escape` key on the keyboard.
    *   **Expected Outcome:** The language switcher dropdown closes, and keyboard focus is returned to the globe icon trigger button.
3.  **Click Inside Dropdown:**
    *   Open the language switcher dropdown.
    *   Click on any of the language options *inside* the dropdown.
    *   **Expected Outcome:** The dropdown remains open (until the language selection logic, which is outside the scope of this PR, closes it). The "click outside" logic should not trigger.
4.  **Toggle Button Click:**
    *   Open the language switcher dropdown.
    *   Click the globe icon trigger button again.
    *   **Expected Outcome:** The language switcher dropdown closes (this behavior is handled by existing toggle logic, not the new dismissal logic, but should still function correctly).
5.  **Rapid Interaction:**
    *   Repeatedly open and close the dropdown using various methods (click, escape).
    *   **Expected Outcome:** No console errors related to event listeners, and the dropdown behaves consistently.

**Edge Cases:**

*   **Multiple Global Listeners:** The `useEffect` cleanup mechanism ensures that only one set of `mousedown` and `keydown` listeners for the `LanguageSwitcher` is active at any given time, preventing conflicts or memory leaks if the component were to be mounted/unmounted frequently.
*   **Interaction with other UI elements:** The `!ref.current.contains(e.target as Node)` check is robust, ensuring that clicks on other interactive elements on the page do not inadvertently close the language switcher unless they are truly outside its boundaries.

**Automated Testing:** Not documented in this PR.