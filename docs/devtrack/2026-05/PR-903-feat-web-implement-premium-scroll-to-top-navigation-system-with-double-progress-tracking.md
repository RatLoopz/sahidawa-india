# PR #903 — feat(web): implement premium scroll-to-top navigation system with double progress tracking

> **Merged:** 2026-05-31 | **Author:** @Pranav-chaudhari-2006 | **Area:** Frontend | **Impact Score:** 8 | **Closes:** #363

## What Changed

This pull request introduces a new `BackToTopButton` component to the SahiDawa web application. This component provides users with a floating button that appears after scrolling down a certain distance, allowing them to smoothly navigate back to the top of the page. It features two synchronized scroll progress indicators (a fixed top bar and a circular ring around the button), robust accessibility features including reduced motion support and focus management, and precise responsive positioning relative to the existing chatbot launcher.

## The Problem Being Solved

Before this PR, SahiDawa lacked a dedicated, accessible, and visually engaging scroll-to-top mechanism. Users navigating long content pages had to manually scroll back to the top, which could be cumbersome. The native browser `scrollTo({ behavior: 'smooth' })` was identified as potentially unreliable on certain OS/browser combinations (e.g., Windows/Chrome with system animations disabled), leading to abrupt jumps instead of smooth transitions. Furthermore, there was no visual feedback on scroll progress, and the button's positioning needed careful engineering to co-exist harmoniously with the chatbot launcher across various screen sizes while maintaining accessibility standards.

## Files Modified

- `apps/web/app/[locale]/components/BackToTopButton.tsx`
- `apps/web/tests/back-to-top-button.test.tsx`

## Implementation Details

The `BackToTopButton` component is a client-side React component (`"use client"`) that manages its visibility and scroll behavior.

1.  **State Management**:
    - `isVisible`: A boolean state (`useState(false)`) controls the button's visibility based on scroll position.
    - `isScrollingBack`: A boolean state (`useState(false)`) indicates if the page is currently scrolling back to top, used to adjust button shadow.
    - `prefersReducedMotion`: A boolean state (`useState(false)`) tracks the user's system preference for reduced motion, detected via `window.matchMedia`.

2.  **Scroll Event Handling (`useEffect`)**:
    - A `handleScroll` function is registered as a passive scroll event listener (`window.addEventListener("scroll", handleScroll, { passive: true })`).
    - To optimize performance and prevent layout thrashing, `handleScroll` uses `requestAnimationFrame` to debounce updates, ensuring UI changes occur efficiently.
    - **Visibility Hysteresis**: The `isVisible` state is updated using two distinct thresholds: `SHOW_THRESHOLD` (300px) and `HIDE_THRESHOLD` (200px). This hysteresis prevents the button from flickering rapidly when the scroll position hovers around a single threshold.
    - **Scroll Progress Calculation**: The current scroll progress is calculated as `(y / docH) * 100`, where `y` is `window.scrollY` and `docH` is the total scrollable height (`document.documentElement.scrollHeight - window.innerHeight`).
    - **CSS Variable Updates**: The calculated `progress` value is directly applied as a CSS custom property (`--scroll-progress`) to the `buttonRef.current` and `progressBarRef.current` elements using `element.style.setProperty()`. This allows CSS to react to scroll changes without triggering React re-renders for every scroll tick.

3.  **Reduced Motion Detection (`useEffect`)**:
    - On mount, `window.matchMedia("(prefers-reduced-motion: reduce)")` is used to initialize `prefersReducedMotion`.
    - A listener (`mqListener`) is added to the media query list to update `prefersReducedMotion` dynamically if the user's system settings change.

4.  **Scroll-to-Top Logic (`handleScrollToTop`)**:
    - When the button is clicked, `window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" })` is called. This uses the native browser smooth scroll behavior, falling back to instant scroll if the user prefers reduced motion.
    - The `isScrollingBack` state is set to `true` during the scroll and reset to `false` when `window.scrollY` reaches `0`.
    - Immediately after initiating the scroll, `shiftFocus()` is called for accessibility.

5.  **Accessibility Features**:
    - **Focus Preservation (`shiftFocus`)**: After scrolling to the top, the browser's focus is programmatically shifted to the main content area (prioritizing `#main-content`, then `main`, then `body`). This prevents screen readers from being stranded on the button. A `tabindex="-1"` is temporarily added to the target element if it doesn't have one, and removed on blur.
    - **Keyboard Navigation (`handleKeyDown`)**: Pressing the `Escape` key while the button is focused will shift focus back to the main content area.
    - **Reduced Motion Support**: The `prefersReducedMotion` state directly influences the `behavior` of `window.scrollTo` and also conditionally applies different Tailwind CSS classes (`motionClasses`) for entry/exit animations, ensuring a non-animated experience for users who prefer it.
    - `aria-label`, `aria-hidden`, and `tabIndex` attributes are dynamically managed based on `isVisible` for screen reader compatibility.

6.  **Visual Elements**:
    - **Top Progress Bar (`progressBarRef`)**: A `div` element fixed at the top of the viewport, styled with `h-[3px]` and a linear gradient. Its width is controlled by `transform: scaleX(calc(var(--scroll-progress, 0) / 100))` via the CSS variable.
    - **Circular Progress Ring**: An SVG `circle` element nested within the button. The `strokeDashoffset` property is dynamically updated using `calc(${circumference}px - (${circumference}px * var(--scroll-progress, 0) / 100))` and a `transition: stroke-dashoffset 80ms ease-out` for smooth visual feedback.
    - **Custom Arrow Glyph**: A handcrafted SVG arrow icon replaces standard icon library components, using thick rounded capsule lines (`strokeWidth="3.5"`, `strokeLinecap="round"`, `strokeLinejoin="round"`) to match SahiDawa's design language.
    - **Responsive Positioning**: Tailwind CSS classes (`bottom-[152px] right-[28px] md:bottom-24 md:right-6`) are precisely calculated to ensure the button is visually centered and correctly positioned above the chatbot launcher on both mobile and desktop, maintaining a consistent gap.
    - **Styling**: Uses Tailwind CSS for all styling, including background gradients, box shadows, and transition effects (`transition-all duration-300 ease-out`, `hover:scale-108`, `active:scale-92`).

7.  **Localization**: The button's `aria-label` and `title` attributes are localized using `useTranslations("BackToTopButton")`, ensuring accessibility across all supported Indian languages.

## Technical Decisions

1.  **Native `window.scrollTo` with Reduced Motion Fallback**: We opted to use the browser's native `window.scrollTo({ behavior: 'smooth' })` for the scroll-to-top action. While the PR description mentioned a "custom JavaScript scroll engine," the implemented code leverages the native browser functionality, which is generally highly optimized. A critical decision was to respect `prefers-reduced-motion` by switching `behavior` to `"auto"` for users who have this system setting enabled, ensuring an accessible experience.
2.  **CSS Variables for Real-time Progress Updates**: Instead of relying on React state updates for every scroll tick, which can be performance-intensive, we chose to update CSS custom properties (`--scroll-progress`) directly on the DOM elements (`buttonRef.current`, `progressBarRef.current`) within a `requestAnimationFrame` loop. This allows CSS `transform` and `strokeDashoffset` properties to react to scroll changes with high performance and without triggering unnecessary React re-renders.
3.  **Hysteresis for Button Visibility**: Implementing separate `SHOW_THRESHOLD` (300px) and `HIDE_THRESHOLD` (200px) prevents the scroll-to-top button from rapidly appearing and disappearing when the user scrolls slightly above and below a single threshold. This significantly improves the user experience by reducing visual flicker.
4.  **`requestAnimationFrame` for Scroll Listener**: Using `requestAnimationFrame` within the scroll event handler ensures that UI updates related to scroll position (like button visibility and progress indicators) are synchronized with the browser's rendering cycle. This prevents jank and provides a smoother visual experience compared to direct updates within the scroll event.
5.  **Comprehensive Accessibility (WCAG 2.2 AA)**:
    - **Focus Management**: The decision to programmatically shift focus to the main content area after scrolling is crucial for screen reader users, preventing them from being trapped on the button. Temporarily adding `tabindex="-1"` is a standard pattern for making non-interactive elements focusable for this purpose.
    - **Reduced Motion**: Explicitly checking `prefers-reduced-motion` and adjusting both scroll behavior and CSS transitions ensures that users with motion sensitivities have a comfortable experience.
    - **Keyboard Interaction**: Adding an `Escape` key handler provides an intuitive way for keyboard users to exit button focus.
6.  **Precise Responsive Co-location**: The specific `bottom` and `right` Tailwind CSS values (`bottom-[152px] right-[28px]` for mobile, `md:bottom-24 md:right-6` for desktop) were mathematically calculated to ensure the scroll-to-top button maintains a consistent visual gap and vertical alignment with the SahiDawa chatbot launcher across different screen sizes. This prevents UI overlap and maintains visual harmony.
7.  **Custom SVG Arrow**: Instead of using an off-the-shelf icon library component (like Lucide's `ChevronUp`), a custom SVG was designed and implemented. This decision ensures the arrow's `strokeWidth`, `strokeLinecap`, and `strokeLinejoin` precisely match SahiDawa's established design language, contributing to a cohesive brand experience.
8.  **No `framer-motion`**: While the PR description mentioned `framer-motion` for physics-driven springs, the actual implementation in the diff uses direct CSS transitions (`transition: stroke-dashoffset 80ms ease-out`) for the progress ring and standard Tailwind CSS transition classes for the button's entry/exit/hover animations. This approach leverages native browser capabilities for performance and avoids adding an external animation library dependency for these specific effects.

## How To Re-Implement (Contributor Reference)

To re-implement a similar premium scroll-to-top system:

1.  **Component Structure**: Create a React client component (e.g., `BackToTopButton.tsx`).
2.  **State Initialization**:
    - `isVisible`: `useState(false)` for button visibility.
    - `isScrollingBack`: `useState(false)` to track active scroll-to-top.
    - `prefersReducedMotion`: `useState(false)` for accessibility.
    - `useRef` for the button (`buttonRef`) and the top progress bar (`progressBarRef`) to directly manipulate their styles.
3.  **Scroll Listener Setup**:
    - In a `useEffect`, define a `handleScroll` function.
    - Inside `handleScroll`, use `window.requestAnimationFrame` to debounce updates.
    - Calculate `window.scrollY` and `document.documentElement.scrollHeight - window.innerHeight`.
    - Implement hysteresis for `isVisible`: `if (y > SHOW_THRESHOLD) setIsVisible(true); else if (y <= HIDE_THRESHOLD) setIsVisible(false);`. Define `SHOW_THRESHOLD` (e.g., 300) and `HIDE_THRESHOLD` (e.g., 200).
    - Calculate scroll progress as a percentage: `progress = (y / docH) * 100`.
    - Update CSS variables on the refs: `buttonRef.current.style.setProperty("--scroll-progress", progressStr);` and `progressBarRef.current.style.setProperty("--scroll-progress", progressStr);`.
    - Attach `window.addEventListener("scroll", handleScroll, { passive: true })` and clean up on unmount.
4.  **Reduced Motion Detection**:
    - In the same `useEffect`, use `window.matchMedia("(prefers-reduced-motion: reduce)")` to detect user preference.
    - Add a `change` listener to the media query list to update `prefersReducedMotion` dynamically.
5.  **Scroll-to-Top Function (`handleScrollToTop`)**:
    - Call `window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" })`.
    - Implement `shiftFocus()` to move focus to the main content after scroll. This involves finding a target element (`main-content`, `main`, or `body`), temporarily setting `tabindex="-1"` if needed, calling `focus({ preventScroll: true })`, and cleaning up `tabindex` on blur.
6.  **Keyboard Accessibility (`handleKeyDown`)**:
    - Add an `onKeyDown` handler to the button. If `e.key === "Escape"`, shift focus away from the button using `target?.focus({ preventScroll: true })`.
7.  **Render JSX**:
    - **Top Progress Bar**: A `div` with `ref={progressBarRef}`, `fixed top-0 left-0 right-0 z-50 h-[3px] origin-left bg-linear-to-r from-green-400 to-green-600 pointer-events-none`. Apply `style={{ transform: "scaleX(calc(var(--scroll-progress, 0) / 100))" }}`.
    - **Scroll-to-Top Button**: A `button` with `ref={buttonRef}`, `type="button"`, `aria-label`, `aria-hidden={!isVisible}`, `tabIndex={isVisible ? 0 : -1}`, `onClick={handleScrollToTop}`, `onKeyDown={handleKeyDown}`.
    - **Responsive Positioning**: Use Tailwind classes like `fixed bottom-[152px] right-[28px] md:bottom-24 md:right-6`.
    - **Conditional Animations**: Apply Tailwind `transition-all` classes. Use conditional classes based on `prefersReducedMotion` for entry/exit animations (e.g., `translate-y-5 scale-90` vs. `translate-y-0 scale-100`).
    - **Circular Progress Ring (SVG)**: Inside the button, an SVG with two `circle` elements. One for the track (`stroke="rgba(255,255,255,0.18)"`) and one for the progress arc (`stroke="rgba(255,255,255,0.78)"`). Calculate `radius` and `circumference`. Apply `strokeDasharray={circumference}` and `style={{ strokeDashoffset: \`calc(${circumference}px - (${circumference}px \* var(--scroll-progress, 0) / 100))\`, transition: "stroke-dashoffset 80ms ease-out" }}` to the progress arc.
    - **Custom Arrow (SVG)**: Another SVG for the arrow icon, with `strokeWidth`, `strokeLinecap`, `strokeLinejoin` matching design guidelines.
8.  **Localization**: Integrate `useTranslations` for button labels.

## Impact on System Architecture

This change primarily impacts the frontend user experience and accessibility.

- **Enhanced UX**: Provides a modern, visually rich, and intuitive way for users to navigate long content, improving overall site usability. The double progress indicators offer continuous feedback, which can reduce perceived loading times or disorientation.
- **Accessibility Standard**: Sets a high bar for accessibility features in interactive components, including robust focus management, reduced motion support, and keyboard navigation. This establishes a pattern for future component development to adhere to WCAG 2.2 AA standards.
- **Performance Optimization**: The use of `requestAnimationFrame` for scroll handling and direct CSS variable manipulation for progress indicators demonstrates a commitment to high-performance frontend development, minimizing re-renders and leveraging native browser capabilities.
- **Design System Consistency**: The custom SVG arrow and precise responsive positioning reinforce SahiDawa's visual design language and ensure new components integrate seamlessly with existing UI elements like the chatbot.
- **Localization Readiness**: The integration with `useTranslations` ensures that the component is immediately ready for SahiDawa's multi-lingual platform, supporting our mission in diverse Indian communities.

## Testing & Verification

The functionality introduced by this PR was verified through both manual testing and an automated Jest test.

1.  **Automated Jest Test**:
    - A new test file, `apps/web/tests/back-to-top-button.test.tsx`, was added.
    - The test specifically asserts the correct responsive positioning of the button:
        - `expect(markup).toContain("bottom-[152px]");` for mobile.
        - `expect(markup).toContain("md:bottom-24");` for desktop.
        - `expect(markup).toContain("right-6");` for consistent horizontal alignment.
    - This test ensures that the button remains visible and correctly aligned above the chatbot launcher across different screen sizes, as per the design specifications.

2.  **Manual Verification**:
    - The PR description includes a reference video demonstrating the visual behavior, including the double progress tracking, smooth scroll, and responsive alignment.
    - Manual testing would have involved:
        - Scrolling down and up to verify button appearance/disappearance and progress indicator functionality.
        - Clicking the button to confirm smooth scroll to top.
        - Testing on various screen sizes (desktop, mobile) to confirm correct co-location with the chatbot.
        - Verifying accessibility features such as keyboard navigation (Tab, Escape), focus management after scroll, and behavior with `prefers-reduced-motion` enabled in system settings.
        - Checking localization by switching language settings.

**Edge Cases**:

- **Very short pages**: The button should not appear if the page content is not long enough to scroll past the `SHOW_THRESHOLD`.
- **Rapid scrolling**: The `requestAnimationFrame` and hysteresis thresholds are designed to handle rapid scrolling gracefully without flickering.
- **Zero scroll height**: The progress calculation handles `docH > 0` to prevent division by zero.
- **Accessibility settings changes**: The `mqListener` ensures dynamic adaptation to `prefers-reduced-motion` changes.
