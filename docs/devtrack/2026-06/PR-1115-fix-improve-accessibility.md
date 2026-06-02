# PR #1115 — fix: improve accessibility

> **Merged:** 2026-06-02 | **Author:** @Aryan-Agarwal-creator | **Area:** Frontend | **Impact Score:** 10

## What Changed

This pull request significantly improves the accessibility of the SahiDawa `apps/web` Next.js frontend by addressing critical WCAG compliance issues. We have added descriptive `aria-label` attributes to icon-only buttons, enhanced color contrast for various text elements, and corrected the semantic heading hierarchy on key pages using visually hidden `H2` tags. These changes ensure better compatibility with assistive technologies and improved readability for all users.

## The Problem Being Solved

Before this PR, our `apps/web` frontend exhibited several accessibility deficiencies, primarily identified through Lighthouse audits. Specifically:

1.  **Missing Accessible Names for Buttons:** Icon-only buttons within the chatbot component lacked descriptive `aria-label` attributes. This meant screen readers could not properly convey the purpose of these interactive elements to users, failing WCAG 2.4.4 (Link Purpose).
2.  **Insufficient Color Contrast:** Various text elements, particularly in the footer and the chatbot's status message, had low color contrast against their backgrounds. This made content difficult to read for users with low vision or color blindness, violating WCAG 1.4.3 (Contrast Minimum).
3.  **Incorrect Heading Hierarchy:** The main homepage (`/`) and the "How It Works" page (`/how-it-works`) lacked proper semantic `H2` headings for major content sections. This impaired the ability of assistive technologies to understand the document structure and provide effective navigation, failing WCAG 1.3.1 (Info and Relationships).

These issues collectively hindered the usability of the SahiDawa platform for a significant portion of our user base, impacting our commitment to inclusivity.

## Files Modified

- `apps/web/app/[locale]/components/Chatbot.tsx`
- `apps/web/app/[locale]/components/Footer.tsx`
- `apps/web/app/[locale]/how-it-works/page.tsx`
- `apps/web/app/[locale]/page.tsx`
- `package-lock.json`

## Implementation Details

The changes were implemented across the `apps/web` Next.js application, focusing on specific component and page files:

1.  **Fixed Button Accessibility Names (`apps/web/app/[locale]/components/Chatbot.tsx`):**
    - We added `aria-label` attributes to the icon-only `<button>` elements within the `Chatbot` component.
    - The button responsible for closing the chat, containing the `<X size={20} />` icon, now includes `aria-label="Close chat"`.
    - The button used to send messages, containing the `<Send size={18} />` icon, now includes `aria-label="Send message"`.
    - The main chatbot toggle button, which switches between `<X size={28} />` and `<MessageSquare size={28} />` icons, now dynamically sets its `aria-label` based on its `isOpen` state: `aria-label={isOpen ? "Close AI chat" : "Open AI chat"}`. This ensures the button's purpose is clearly communicated regardless of its current visual state.

2.  **Fixed Color Contrast Issues (`apps/web/app/[locale]/components/Chatbot.tsx`, `apps/web/app/[locale]/components/Footer.tsx`):**
    - In `Chatbot.tsx`, the status text within the chatbot header was updated from `text-white/80` to `text-white/95` to improve its contrast against the dark background.
    - In `Footer.tsx`, several text elements had their Tailwind CSS color classes adjusted to meet WCAG contrast requirements:
        - The main descriptive paragraph text was changed from `text-slate-600` to `text-slate-700`.
        - Navigation links within the footer, previously `text-slate-600`, were updated to `text-slate-700`.
        - External links and the contact email link, also `text-slate-600`, were updated to `text-slate-700`.
        - The copyright and "Built with" text in the bottom bar was changed from `text-xs text-slate-500` to `text-xs text-slate-700` (while retaining `dark:text-slate-400` for dark mode). These adjustments ensure a minimum contrast ratio of 4.5:1 for normal text.

3.  **Fixed Heading Hierarchy Issues (`apps/web/app/[locale]/page.tsx`, `apps/web/app/[locale]/how-it-works/page.tsx`):**
    - On the main homepage (`apps/web/app/[locale]/page.tsx`), a new `<h2>` element with the text "Featured Services" was added immediately preceding the `<section>` containing the "Vaccine Hub & Tracker" link. This `<h2>` element was styled with the `sr-only` utility class, making it visually hidden but accessible to screen readers.
    - On the "How It Works" page (`apps/web/app/[locale]/how-it-works/page.tsx`), a new `<h2>` element with the text "How It Works Steps" was added immediately preceding the main timeline `<section>`. This also utilizes the `sr-only` utility class.
    - These additions provide a logical and semantic document outline for assistive technologies without altering the existing visual design of the pages.

4.  **`package-lock.json` Update:**
    - The `package-lock.json` file was updated. This involved removing the `peer: true` property from several dependency entries, including `ajv`, `babel-jest`, `jest`, `jest-cli`, `@redis/client`, `@supabase/supabase-js`, `@types/node`, `@typescript-eslint/eslint-plugin`, and `@upstash/redis`. This is a standard update to the dependency lock file, likely a result of running `npm install` or `npm update` with a newer version of npm, which adjusts how peer dependencies are recorded. It does not represent a functional code change.

## Technical Decisions

Our technical decisions were guided by the need to achieve WCAG compliance while maintaining our existing UI/UX design and leveraging our current technology stack (Next.js, Tailwind CSS).

- **`aria-label` for Buttons:** We opted for `aria-label` attributes on icon-only buttons as it is the most direct and effective method to provide an accessible name for interactive elements that do not have visible text. This approach directly addresses WCAG 2.4.4 without requiring visual changes, preserving the minimalist design of our chatbot. Dynamic `aria-label` for the toggle button was chosen to accurately reflect its current function to screen reader users.
- **Tailwind CSS for Color Contrast:** Instead of introducing custom CSS or new styling paradigms, we leveraged our existing Tailwind CSS utility classes to adjust color contrast. This ensures consistency with our design system, simplifies maintenance, and directly maps to the required contrast ratios for WCAG 1.4.3. Incrementally increasing the shade number (e.g., `slate-600` to `slate-700`) is a straightforward way to achieve higher contrast.
- **`sr-only` for Heading Hierarchy:** To address WCAG 1.3.1 regarding heading structure without altering the visual layout, we utilized the `sr-only` utility class. This is a widely accepted and robust pattern in modern web development for providing semantic structure to assistive technologies while keeping content visually hidden. This allows us to improve accessibility without compromising the carefully crafted visual design of our pages.

## How To Re-Implement (Contributor Reference)

Should a contributor need to implement similar accessibility features from scratch, the following steps outline our approach:

1.  **Implement Accessible Button Names:**
    - **Identify:** Scan UI components for `<button>` elements that contain only icons (e.g., `<X />`, `<Send />`) and lack visible text.
    - **Add `aria-label`:** For each identified button, add an `aria-label` attribute. The value should be a concise, action-oriented description of the button's function (e.g., `<button aria-label="Close dialog">`).
    - **Dynamic `aria-label`:** If a button's function changes based on its state (e.g., a toggle), use conditional logic to set the `aria-label` dynamically (e.g., `<button aria-label={isActive ? "Deactivate" : "Activate"}>`).
    - **Verify:** Use browser developer tools' accessibility inspectors or a screen reader (e.g., NVDA, VoiceOver) to confirm that the button's accessible name is correctly announced.

2.  **Resolve Color Contrast Issues:**
    - **Audit:** Use an accessibility auditing tool (e.g., Lighthouse in Chrome DevTools, WebAIM Contrast Checker) to identify text elements that fail WCAG 1.4.3 (Contrast Minimum).
    - **Adjust Tailwind Classes:** For failing text elements, modify their Tailwind CSS `text-` color classes. For example, if `text-slate-500` fails against a given background, try `text-slate-600`, `text-slate-700`, or `text-slate-800` until the contrast ratio (at least 4.5:1 for normal text, 3:1 for large text) is met.
    - **Dark Mode Consideration:** Ensure that color adjustments are also made for dark mode styles (e.g., `dark:text-slate-400`) if applicable, and re-verify contrast in both themes.
    - **Re-verify:** Rerun the contrast checker or accessibility audit to confirm compliance.

3.  **Correct Heading Hierarchy:**
    - **Structure Analysis:** Review page layouts to identify major content sections that are visually distinct but are not preceded by a semantic `<h2>` heading (assuming `<h1>` is already present for the main page title).
    - **Add `sr-only` `<h2>`:** Insert an `<h2>` element at the beginning of each such section. Apply the `sr-only` utility class (defined in our Tailwind CSS configuration) to this `<h2>` to hide it visually while keeping it accessible to screen readers.
        - Example: `<h2 className="sr-only">Section Title Description</h2>`
    - **Descriptive Text:** Ensure the text within the `<h2>` accurately describes the content of the section.
    - **Verify:** Use browser developer tools' accessibility tree or an outline generator to confirm that the document's heading structure is logical and complete.

## Impact on System Architecture

This PR primarily impacts the user-facing layer of the SahiDawa `apps/web` frontend. It does not introduce new architectural patterns, modify backend services, or alter data flow. The changes are confined to the presentation layer, specifically improving the semantic structure and interactive element accessibility.

The impact is significant for:

- **User Experience:** It makes the SahiDawa platform more inclusive and usable for individuals relying on assistive technologies, such as screen readers, and those with visual impairments.
- **Compliance & Quality:** By resolving critical Lighthouse accessibility issues and adhering to WCAG standards (2.4.4, 1.4.3, 1.3.1), we enhance the overall quality and robustness of our frontend. This is crucial for a public-facing platform and sets a higher standard for future development.
- **Maintainability:** The chosen implementation methods (Tailwind CSS utility classes, standard `aria-label` attributes, `sr-only` pattern) integrate seamlessly with our existing codebase, ensuring these accessibility improvements are maintainable and scalable.

This change reinforces our commitment to building an accessible platform, laying a stronger foundation for future feature development to incorporate accessibility considerations from the outset.

## Testing & Verification

The changes introduced in this PR were thoroughly tested and verified through the following methods:

- **Automated Accessibility Audits:** Lighthouse audits were performed on the affected pages and components. The PR description explicitly states that "All reported Lighthouse accessibility issues have been resolved," confirming that:
    - "Button elements now have accessible names"
    - "Color contrast violations resolved"
    - "Heading order hierarchy corrected"
- **Visual Inspection:** The UI/UX improvements were visually inspected to ensure that the color contrast changes were effective and that the addition of `sr-only` headings did not introduce any unintended visual alterations.
- **Screenshots:** Proof-of-work screenshots were provided in the PR, demonstrating the implemented fixes and verification results, likely showing improved Lighthouse scores or visual confirmation of contrast.
- **Implied Manual Testing:** While not explicitly documented in detail, the PR description mentions "Screen reader compatibility enhanced" and "Better keyboard navigation support," implying that manual testing with screen readers and keyboard-only navigation was performed to validate the `aria-label` and heading structure changes.

**Edge Cases Considered (or to be considered for future enhancements):**

- **Localization of `aria-label`:** The `aria-label` values for buttons are currently hardcoded strings (e.g., "Close chat", "Send message"). While the chatbot itself uses `t("title")` for internationalization, these specific `aria-label`s are not currently localized. For a truly global platform, these should ideally be integrated into our internationalization framework.
- **Dynamic Content Contrast:** For components with dynamic content or user-configurable themes, ensuring contrast remains sufficient under all possible conditions is an ongoing consideration.
- **Complex Interactions:** For more complex interactive components, a deeper dive into ARIA roles, states, and properties might be necessary beyond simple `aria-label`s. This PR focused on basic button interactions.
