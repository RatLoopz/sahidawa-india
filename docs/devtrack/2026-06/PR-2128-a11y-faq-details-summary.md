# PR #2128 — A11y faq details summary

> **Merged:** 2026-06-19 | **Author:** @arushiranjan | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #1982

## What Changed

This pull request refactors the FAQ section on our web platform by replacing a custom, JavaScript-driven accordion implementation with native HTML `<details>` and `<summary>` elements. We removed the associated React state management and event handlers from `apps/web/app/[locale]/faq/page.tsx`, simplifying the component logic. The visual appearance and interactive behavior of the FAQ items, including the chevron icon rotation, were preserved using CSS, while significantly enhancing accessibility.

## The Problem Being Solved

Prior to this change, our FAQ section utilized a custom React component that managed the open/closed state of each FAQ item using the `useState` hook and custom click handlers. This approach required us to manually implement accessibility features such as `aria-expanded`, `aria-controls`, and keyboard navigation. This custom implementation was less robust, more prone to accessibility oversights, and added unnecessary JavaScript overhead compared to native browser capabilities. It also potentially created a less semantic structure for screen readers and assistive technologies, making the FAQ content harder to navigate for users relying on such tools.

## Files Modified

- `apps/web/app/[locale]/faq/page.tsx`

## Implementation Details

The core of this change is the migration of the FAQ item rendering logic within `apps/web/app/[locale]/faq/page.tsx`.
Previously, each FAQ item was rendered inside a `div` element, containing a `button` for the question and a conditionally rendered `div` for the answer. The `useState` hook, specifically `openIndex` and `setOpenIndex`, was used to manage which FAQ item was currently expanded. A `toggle` function handled the state updates on button clicks.

The refactor involved the following key steps:

1.  **Removal of React State:** We removed the `useState` import, the `openIndex` state variable, and the `toggle` function from the `FAQPage` component. This significantly reduced the component's client-side JavaScript logic.
2.  **Semantic HTML Adoption:** Each FAQ item's outer `div` was replaced with a `<details>` HTML element. The question and the chevron icon, previously wrapped in a `button`, are now encapsulated within a `<summary>` element, which is the first child of `<details>`. The answer content, previously a conditional `div` (rendered only when `openIndex === i`), is now a direct child of `<details>`, following the `<summary>`.
3.  **Accessibility Attributes Removal:** The manual `id`, `aria-expanded`, `aria-controls`, `role="region"`, and `aria-labelledby` attributes, which were necessary for the custom implementation's accessibility, were removed. The native `<details>` and `<summary>` elements provide these semantics inherently, handled directly by the browser.
4.  **Chevron Icon Management:** The `ChevronUp` icon from `lucide-react` was removed, as the `ChevronDown` icon is now dynamically rotated. The `ChevronDown` icon's parent `div` was updated with `transition-transform duration-200 group-open:rotate-180`. This CSS class leverages Tailwind CSS's `group` and `group-open` variants. The `group` class is applied to the parent `<details>` element, allowing the `group-open` variant on the `ChevronDown` to apply a `rotate-180` transformation when the `<details>` element is in its "open" state.
5.  **Native Disclosure Marker Hiding:** To maintain our custom chevron icon and styling, we added `list-none` and `[&::-webkit-details-marker]:hidden` utility classes to the `<summary>` element. `list-none` removes default list-item styling, and `[&::-webkit-details-marker]:hidden` specifically hides the browser's default disclosure triangle marker for `<details>` elements across WebKit-based browsers, ensuring only our custom `ChevronDown` is visible.
6.  **Styling Preservation:** Existing Tailwind CSS classes for borders, backgrounds, shadows, padding, and text styles were largely retained and applied to the new `<details>` and `<summary>` elements to ensure the visual appearance remained consistent with the previous implementation.

The `FAQPage` component now iterates through FAQ items using `map`, rendering a `<details>` element for each. Inside each `<details>`, a `<summary>` displays the question and a `ChevronDown` icon. The answer is then rendered directly after the `<summary>`.

## Technical Decisions

The primary technical decision was to leverage native HTML `<details>` and `<summary>` elements over a custom React-based accordion. This decision was driven by several factors:

1.  **Improved Accessibility (A11y):** Native `<details>` and `<summary>` elements come with built-in accessibility features. Browsers automatically handle keyboard navigation (e.g., Space/Enter to toggle, arrow keys to navigate), focus management, and expose appropriate ARIA roles and states to assistive technologies (like screen readers) without requiring manual implementation. This significantly reduces the risk of accessibility bugs and ensures a more robust user experience for all users, aligning with SahiDawa's mission for inclusive health access.
2.  **Reduced JavaScript Overhead:** By offloading the accordion logic to the browser's native implementation, we eliminated the need for `useState` and custom event handlers. This results in a smaller JavaScript bundle size and less client-side processing, potentially improving page load performance and responsiveness, which is crucial for users in rural areas with potentially limited bandwidth.
3.  **Code Simplification and Maintainability:** Removing state management and custom logic simplifies the `FAQPage` component, making it easier to read, understand, and maintain. Future developers will deal with standard HTML semantics rather than a custom React pattern, reducing the learning curve and potential for errors.
4.  **Browser Compatibility:** The `<details>` and `<summary>` elements are widely supported across modern browsers, ensuring broad compatibility for our user base.
5.  **Styling Flexibility:** While native, these elements are still highly stylable with CSS. The use of Tailwind CSS `group` and `group-open` variants demonstrates how custom visual cues (like the rotating chevron) can be seamlessly integrated while benefiting from native behavior.

Alternatives considered included continuing to refine the custom React component for accessibility, or using a third-party React accordion library. However, these options were deemed less ideal due to the added complexity, potential for larger bundle sizes, or the fact that a native HTML solution already perfectly fit the requirements with superior inherent accessibility and minimal overhead.

## How To Re-Implement (Contributor Reference)

To re-implement an accordion using the native HTML `<details>` and `<summary>` elements, following the pattern established in this PR, a contributor would:

1.  **Identify Accordion Structure:** Determine the content that serves as the "question" or "summary" and the content that serves as the "answer" or "details".
2.  **Wrap with `<details>`:** Enclose each complete accordion item (question + answer) within a `<details>` tag. Apply the `group` class to this `<details>` element if you intend to use `group-open` variants for styling child elements.
    ```html
    <details
        class="group overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md"
    >
        <!-- Question/Summary goes here -->
        <!-- Answer/Details goes here -->
    </details>
    ```
3.  **Define `<summary>`:** Place the "question" content inside a `<summary>` tag as the first child of `<details>`. Apply styling to hide the native disclosure marker and for the question's appearance.
    ```html
    <summary
        class="flex w-full list-none items-center justify-between px-6 py-5 text-left transition-colors duration-200 hover:bg-emerald-500/[0.01] [&::-webkit-details-marker]:hidden"
    >
        <!-- Question text and custom icon -->
    </summary>
    ```
    - `list-none`: Removes default list styling.
    - `[&::-webkit-details-marker]:hidden`: Hides the default disclosure triangle in WebKit browsers (e.g., Chrome, Safari).
4.  **Add Custom Disclosure Icon:** Include a custom icon (e.g., `ChevronDown` from `lucide-react`) within the `<summary>` element. Apply `transition-transform duration-200 group-open:rotate-180` to this icon to make it rotate when the `<details>` element is open.
    ```jsx
    <div className="ml-4 shrink-0 text-(--color-text-muted)">
        <ChevronDown
            size={20}
            className="transition-transform duration-200 group-open:rotate-180"
        />
    </div>
    ```
    - The `group-open:rotate-180` class requires the parent `<details>` element to have the `group` class.
5.  **Place Answer Content:** Directly after the `<summary>` tag, place the "answer" content within a `div` or other appropriate element. This content will be shown/hidden by the browser's native `<details>` functionality.
    ```html
    <div
        class="border-t border-(--color-border-muted) px-6 pt-4 pb-5 text-sm leading-relaxed font-medium text-(--color-text-secondary)"
    >
        {t(`items.${key}.answer`)}
    </div>
    ```
6.  **Remove JavaScript Logic:** Ensure no `useState` hooks or custom event handlers are used for managing the open/closed state of these accordion items. The browser handles this natively.
7.  **Internationalization:** If using `next-intl` as in SahiDawa, retrieve translated content for both the summary and detail sections using `useTranslations` and `t()` as demonstrated in the `FAQPage` component.

**Gotchas:**

- Remember to add the `group` class to the `<details>` element for `group-open` variants to work on child elements.
- The `[&::-webkit-details-marker]:hidden` class is crucial for hiding the native disclosure triangle if you want to use a custom icon.
- Ensure your CSS transitions are smooth for the icon rotation.

## Impact on System Architecture

This change primarily impacts the frontend architecture of the SahiDawa web application, specifically within the `apps/web` project.

1.  **Reduced Frontend Complexity:** By offloading accordion logic to native HTML, we reduce the complexity of our React components. This aligns with a philosophy of "using the platform" when possible, leading to simpler, more robust, and potentially more performant frontend code.
2.  **Enhanced Accessibility Standard:** This refactor raises the baseline accessibility standard for interactive components across our platform. It sets a precedent for prioritizing native, semantic HTML solutions for common UI patterns, which inherently offer better accessibility than custom JavaScript implementations. This can guide future frontend development decisions.
3.  **Improved Maintainability:** The `FAQPage` component is now simpler and easier to maintain, as less custom logic needs to be understood or debugged. This frees up developer time for more complex, domain-specific features.
4.  **Potential for Performance Gains:** While the impact score is low (5/30), removing client-side JavaScript for basic UI interactions contributes to a leaner bundle and faster time-to-interactive, especially on lower-end devices or slower networks, which is critical for our rural health platform.
5.  **No Backend Impact:** This change is purely a frontend refactor and has no impact on our backend services, database, or API layers.

This change reinforces our commitment to building an accessible and performant platform for all users, including those in rural areas with varying network conditions and those using assistive technologies.

## Testing & Verification

This change was primarily verified through manual inspection and interaction in the browser.

1.  **Visual Accordion Behavior:**
    - We confirmed that clicking on an FAQ question correctly expands and collapses the corresponding answer.
    - We verified that the `ChevronDown` icon correctly rotates 180 degrees when an item is expanded and rotates back when collapsed, using the `group-open:rotate-180` class.
    - We ensured that the overall styling, including borders, shadows, and text appearance, remained consistent with the previous implementation.
2.  **Keyboard Navigation:**
    - We tested navigating the FAQ items using the Tab key to ensure focus moves correctly between questions.
    - We verified that pressing the Spacebar or Enter key while an FAQ question is focused correctly toggles its expanded state, demonstrating native browser handling.
3.  **Accessibility (Implicit):**
    - While not explicitly documented with screen reader tests in this PR, the use of native `<details>` and `<summary>` elements inherently provides correct ARIA roles and states, which are automatically announced by screen readers. This was the primary driver for the change.
4.  **ESLint Check:**
    - An ESLint check was performed, confirming no new errors or warnings were introduced, indicating adherence to our code quality standards.

**Edge Cases:**

- **No JavaScript:** The `<details>` element functions natively even if JavaScript is disabled, providing a basic, functional accordion experience (items can still be expanded/collapsed). This is a significant improvement over the previous JS-dependent implementation, which would have been non-functional without JavaScript.
- **Browser Compatibility:** While widely supported, older browsers might not fully support `<details>`. However, SahiDawa targets modern browsers, and the graceful degradation (content might just be always visible) is acceptable for the FAQ section.
- **Dynamic Content:** The current FAQ content is static. If FAQ items were to be dynamically loaded, the `<details>` pattern would still apply without issue, as it's a standard HTML element.
