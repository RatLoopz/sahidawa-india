# PR #744 — feat(web): add back to top button

> **Merged:** 2026-05-27 | **Author:** @Dushyantcoder07 | **Area:** i18n | **Impact Score:** 46 | **Closes:** #623

## What Changed

This pull request introduces a new, reusable "Back to Top" button component to our `apps/web` Next.js frontend. The button dynamically appears after a user scrolls down a predefined distance on any page and, when clicked, smoothly scrolls the viewport back to the top of the page. It includes full internationalization (i18n) support for its label and is designed to be accessible and visually consistent with our existing UI.

## The Problem Being Solved

Before this change, users navigating long pages within the SahiDawa web application had no quick or convenient way to return to the top of the page without manually scrolling. This could lead to a frustrating user experience, especially on content-heavy pages like articles, search results, or detailed information views. The absence of such a common UI element made navigation less efficient and less user-friendly, particularly for those using touch devices or trackpads.

## Files Modified

- `apps/web/app/[locale]/components/BackToTopButton.tsx`
- `apps/web/app/[locale]/layout.tsx`
- `apps/web/messages/bn.json`
- `apps/web/messages/en.json`
- `apps/web/messages/gu.json`
- `apps/web/messages/hi.json`
- `apps/web/messages/kn.json`
- `apps/web/messages/mr.json`
- `apps/web/messages/od.json`
- `apps/web/messages/pa.json`
- `apps/web/messages/ta.json`
- `apps/web/messages/te.json`
- `apps/web/messages/ur.json`
- `apps/web/package.json`
- `package-lock.json`

## Implementation Details

The core of this feature is the new client-side React component, `BackToTopButton.tsx`, located in `apps/web/app/[locale]/components/`.

1.  **`BackToTopButton.tsx` Component:**
    *   It is declared as a client component using `"use client";` at the top, which is necessary for using browser-specific APIs like `window.scrollY` and `window.addEventListener`.
    *   A `useState` hook, `isVisible`, manages the button's visibility state, initialized to `false`.
    *   A constant `SCROLL_THRESHOLD` is defined as `400` pixels. This value determines how far a user must scroll down before the button becomes visible.
    *   An `useEffect` hook is used to manage scroll event listeners:
        *   It defines `handleScroll`, a function that updates `isVisible` based on `window.scrollY` exceeding `SCROLL_THRESHOLD`.
        *   `handleScroll()` is called once on mount to set the initial visibility.
        *   `window.addEventListener("scroll", handleScroll, { passive: true });` registers the scroll event listener. The `{ passive: true }` option is used for performance optimization, indicating that the listener will not call `preventDefault()`.
        *   A cleanup function `return () => window.removeEventListener("scroll", handleScroll);` is provided to remove the event listener when the component unmounts, preventing memory leaks.
    *   Internationalization (i18n) is handled using `next-intl`'s `useTranslations` hook. It fetches the `label` for the button from the `BackToTopButton` namespace in our message files.
    *   The component renders a `<button>` element with `type="button"`.
    *   Accessibility attributes are included: `aria-label`, `aria-hidden`, `tabIndex`, and `title` are dynamically set based on the `isVisible` state and the translated `label`. `aria-hidden="true"` is added to the `ChevronUp` icon to prevent screen readers from announcing it redundantly.
    *   The `onClick` handler for the button uses `window.scrollTo({ top: 0, behavior: "smooth" })` to smoothly animate the scroll position to the top of the page.
    *   Styling is applied using Tailwind CSS classes. The `clsx` utility library is used to conditionally apply classes based on the `isVisible` state, controlling opacity, `translate-y` for a subtle slide-in/out effect, and `pointer-events-none` when hidden to prevent interaction. The button is `fixed` positioned at `bottom-24 right-6` with a `z-50` index to float above other content, including the existing chatbot.

2.  **Integration into `layout.tsx`:**
    *   The `BackToTopButton` component is imported into `apps/web/app/[locale]/layout.tsx`.
    *   It is rendered within the `div` element that has the `no-print` class, alongside the `Chatbot` component. This ensures the button is available globally across all pages of the web application and is not included in print layouts.

3.  **Internationalization (i18n) Updates:**
    *   New entries for `"BackToTopButton": { "label": "..." }` have been added to all existing language message files: `bn.json`, `en.json`, `gu.json`, `hi.json`, `kn.json`, `mr.json`, `od.json`, `pa.json`, `ta.json`, `te.json`, and `ur.json`. This ensures the button's label is correctly translated for all supported SahiDawa languages.

4.  **Dependency Updates:**
    *   The `clsx` library, version `^2.1.1`, was added to `apps/web/package.json` and `package-lock.json` to facilitate conditional class name management.
    *   A minor version update for `express-rate-limit` from `^8.5.1` to `^8.5.2` was also recorded in `package-lock.json`, likely as a side effect of dependency resolution during the PR's development.

## Technical Decisions

1.  **Client Component (`"use client"`):** We chose to implement `BackToTopButton` as a client component because its core functionality relies on browser-specific APIs (`window.scrollY`, `window.addEventListener`) and React hooks (`useState`, `useEffect`) that manage client-side state and side effects. This is a fundamental requirement for interactive UI elements that respond to user actions or browser events.
2.  **Scroll Threshold (`SCROLL_THRESHOLD`):** A `SCROLL_THRESHOLD` of 400 pixels was chosen to ensure the button only appears when it's genuinely useful. Displaying it immediately on page load, or after a very short scroll, would be distracting and unnecessary. 400px provides a good balance, indicating that the user has scrolled a meaningful distance down the page.
3.  **Smooth Scrolling (`window.scrollTo({ behavior: "smooth" })`):** The `behavior: "smooth"` option for `window.scrollTo` was selected to provide a pleasant and modern user experience. A sudden jump to the top can be jarring, whereas a smooth animation makes the transition intuitive and less disorienting.
4.  **Accessibility (`aria-label`, `tabIndex`, `aria-hidden`):** Implementing robust accessibility attributes was a critical decision. `aria-label` and `title` provide clear, translated descriptions for screen readers and hover tooltips. `tabIndex={isVisible ? 0 : -1}` ensures the button is only focusable via keyboard navigation when it's visible, preventing confusing interactions. `aria-hidden` on the icon prevents redundant announcements. This aligns with our commitment to making SahiDawa usable for all individuals.
5.  **`clsx` for Conditional Styling:** The `clsx` library was chosen for its lightweight nature and efficiency in conditionally joining CSS class names. This allows for clean and readable application of Tailwind CSS classes to control the button's appearance and animation based on its `isVisible` state.
6.  **Global Integration in `layout.tsx`:** Mounting the `BackToTopButton` in the root `apps/web/app/[locale]/layout.tsx` ensures that it is available on every page of the web application without needing to be manually added to individual page components. This promotes reusability and consistency.
7.  **Fixed Positioning and `z-index`:** The button is positioned using `fixed bottom-24 right-6 z-50`. This ensures it floats consistently in the bottom-right corner of the viewport, regardless of scroll position. The `z-50` value is intentionally high to guarantee it appears above other elements, including our existing `Chatbot` component, preventing UI overlap or interaction issues.
8.  **`next-intl` for Localization:** Leveraging `next-intl` for the button's label (`useTranslations("BackToTopButton")`) was a natural choice, consistent with SahiDawa's existing i18n strategy. This ensures the button is fully localized and accessible to our diverse user base across India.

## How To Re-Implement (Contributor Reference)

To re-implement a similar "Back to Top" functionality in our SahiDawa web application, follow these steps:

1.  **Create a Client Component:**
    *   Create a new `.tsx` file (e.g., `MyBackToTopButton.tsx`) within `apps/web/app/[locale]/components/`.
    *   Add `"use client";` at the very top of the file to mark it as a client component.
    *   Define a functional React component, e.g., `export default function MyBackToTopButton() { ... }`.

2.  **Manage Visibility State:**
    *   Inside your component, use `const [isVisible, setIsVisible] = useState(false);` to track whether the button should be shown.

3.  **Implement Scroll Listener:**
    *   Define a scroll threshold constant, e.g., `const SCROLL_THRESHOLD = 400;`.
    *   Use a `useEffect` hook to add and remove a scroll event listener:
        ```typescript
        useEffect(() => {
            const handleScroll = () => {
                setIsVisible(window.scrollY > SCROLL_THRESHOLD);
            };
            handleScroll(); // Set initial visibility
            window.addEventListener("scroll", handleScroll, { passive: true });
            return () => window.removeEventListener("scroll", handleScroll);
        }, []); // Empty dependency array means this runs once on mount and cleans up on unmount
        ```

4.  **Add Internationalization (i18n):**
    *   Import `useTranslations` from `next-intl`.
    *   Call `const t = useTranslations("MyButtonNamespace");` to get your translation function.
    *   Define a label, e.g., `const label = t("label");`.
    *   Add a new namespace (e.g., `"MyButtonNamespace": { "label": "My Button Text" }`) to all `apps/web/messages/*.json` files, providing translations for each language.

5.  **Render the Button with Styling and Accessibility:**
    *   Return a `<button>` element from your component.
    *   Set `type="button"`.
    *   Implement the `onClick` handler: `onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}`.
    *   Apply accessibility attributes: `aria-label={label}`, `aria-hidden={!isVisible}`, `tabIndex={isVisible ? 0 : -1}`, `title={label}`.
    *   Use Tailwind CSS for styling. For conditional classes, install `clsx` (`npm install clsx` in `apps/web`) and import it: `import clsx from "clsx";`.
    *   Apply classes like:
        ```html
        <button
            // ... other attributes
            className={clsx(
                "fixed bottom-24 right-6 z-50 /* ... other base styles ... */",
                isVisible
                    ? "opacity-100 translate-y-0"
                    : "pointer-events-none opacity-0 translate-y-4"
            )}
        >
            {/* Add an icon, e.g., <ChevronUp size={22} aria-hidden="true" /> */}
        </button>
        ```
    *   Ensure `z-index` is high enough (e.g., `z-50`) to float above other UI elements.

6.  **Integrate into Root Layout:**
    *   Import your new component into `apps/web/app/[locale]/layout.tsx`.
    *   Render it within the main content area, typically inside a `div` that wraps the `children` prop, to ensure it's present on all pages. Consider placing it within a `no-print` container if it shouldn't appear in printouts.

7.  **Update Dependencies:**
    *   If `clsx` or any other new library is used, ensure it's added to `apps/web/package.json` and `package-lock.json`.

## Impact on System Architecture

This change primarily impacts the frontend user experience and component library of the `apps/web` application.

*   **Enhanced User Experience:** It significantly improves navigation on long pages, making the SahiDawa platform more user-friendly and efficient, especially for content consumption.
*   **Reusable UI Component:** The `BackToTopButton` is a self-contained, reusable component that can be easily integrated or adapted for other parts of the application if similar functionality is needed elsewhere. This promotes modularity in our frontend architecture.
*   **Reinforced i18n Strategy:** The implementation demonstrates and reinforces our commitment to full internationalization, ensuring that all user-facing text, even for small UI elements, is localized.
*   **Minimal Core Architecture Impact:** This feature is a pure frontend enhancement and does not introduce changes to our backend `apps/api` or ML `apps/ml` services, nor does it alter our data models or database schema. It integrates seamlessly with the existing Next.js app router and `next-intl` setup.
*   **Accessibility Standards:** By incorporating `aria-label`, `tabIndex`, and `aria-hidden`, we continue to uphold and improve the accessibility standards of the SahiDawa platform, making it more inclusive.

## Testing & Verification

The implementation of the "Back to Top" button was verified through comprehensive manual testing, as indicated by the provided screenshots and the "Contributor Checklist."

Specific verification steps included:

1.  **Visibility Control:**
    *   Navigating to a short page: Verified the button does not appear.
    *   Navigating to a long page: Verified the button is initially hidden.
    *   Scrolling down past `SCROLL_THRESHOLD` (400px): Verified the button smoothly appears.
    *   Scrolling back up above `SCROLL_THRESHOLD`: Verified the button smoothly disappears.
2.  **Functionality:**
    *   Clicking the visible button: Verified the page smoothly scrolls back to the very top (`top: 0`).
3.  **User Interface & Experience:**
    *   Checked for smooth animation on appearance/disappearance and on click.
    *   Verified the button's fixed position (`bottom-24 right-6`) remains consistent across different scroll positions and page layouts.
    *   Confirmed the button does not overlap or interfere with other fixed UI elements, specifically the `Chatbot` component.
    *   Tested responsiveness across various screen sizes to ensure proper positioning and sizing.
4.  **Internationalization:**
    *   Switched the application language to several supported locales (e.g., Hindi, Bengali, English): Verified the button's `aria-label` and `title` attributes correctly displayed the translated "Back to top" text.
5.  **Accessibility:**
    *   Keyboard navigation: Verified the button is only focusable (`tabIndex=0`) when visible and not focusable (`tabIndex=-1`) when hidden.
    *   Screen reader compatibility: Verified the `aria-label` provides a meaningful description and the `ChevronUp` icon is correctly hidden from screen readers.

**Edge Cases Considered:**
*   **Very short pages:** The `SCROLL_THRESHOLD` correctly prevents the button from appearing on pages where it's not needed.
*   **Pages with existing floating elements:** The `z-50` ensures the button layers correctly above other UI elements like the chatbot.
*   **Rapid scrolling:** The event listener is debounced by the browser and the state updates are efficient enough to handle rapid scroll events without performance degradation.