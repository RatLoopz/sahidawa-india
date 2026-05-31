# PR #498 — feat(voice): improve keyboard accessibility flow

> **Merged:** 2026-05-24 | **Author:** @shashank03-dev | **Area:** Frontend | **Impact Score:** 69 | **Closes:** #476

## What Changed

This pull request significantly enhances the keyboard accessibility of our Voice Triage flow within the `apps/web` frontend. We have implemented a "Skip to main content" link, standardized visible focus states, refined keyboard navigation, added scoped `Escape` key handling, and introduced automated accessibility testing for the voice page.

## The Problem Being Solved

Prior to this PR, the Voice Triage flow (accessible at `/en/voice`) suffered from several keyboard accessibility deficiencies, as detailed in issue #476. Users relying on keyboard navigation or screen readers faced challenges including:

1.  **Lack of a skip-navigation mechanism**: Keyboard users had to tab through the entire page header and navigation elements before reaching the main voice content, leading to inefficiency and frustration.
2.  **Inconsistent and weak focus states**: Interactive elements within the voice flow did not always provide clear visual indicators when focused, making it difficult for users to track their position.
3.  **Unpredictable focus management**: Programmatic focus was not consistently applied to active panels (e.g., review, result, error states), forcing users to manually tab to find the relevant content.
4.  **Global `Escape` key handling**: The `Escape` key might have had unintended side effects, potentially interfering with native form controls or exiting the voice flow prematurely from unrelated contexts.
5.  **Insufficient accessibility testing**: There was a lack of automated and documented manual audit procedures to ensure ongoing accessibility compliance for this critical feature.

These issues collectively hindered the usability of the Voice Triage platform for users with motor impairments or those who prefer keyboard navigation, failing to meet our commitment to inclusive design.

## Files Modified

- `KEYBOARD_NAV.md`
- `apps/web/app/[locale]/components/PageHeader.tsx`
- `apps/web/app/[locale]/voice/VoiceAnimationToggle.tsx`
- `apps/web/app/[locale]/voice/VoicePanels.tsx`
- `apps/web/app/[locale]/voice/layout.tsx`
- `apps/web/app/[locale]/voice/lib/accessibility.ts`
- `apps/web/app/[locale]/voice/page.tsx`
- `apps/web/messages/bn.json`
- `apps/web/messages/en.json`
- `apps/web/messages/mr.json`
- `apps/web/messages/ta.json`
- `apps/web/messages/te.json`
- `apps/web/package.json`
- `apps/web/scripts/voice-a11y-audit.mjs`
- `apps/web/tests/voice-accessibility.test.tsx`
- `apps/web/tests/voice-helpers.test.ts`
- `apps/web/tests/voice-page-accessibility.test.tsx`
- `package-lock.json`
- `package.json`

## Implementation Details

This PR introduces a suite of changes to bolster the keyboard accessibility of the Voice Triage flow:

1.  **Skip-Navigation Link**:
    - A `Skip to main content` link has been added to `apps/web/app/[locale]/voice/layout.tsx`. This ensures it is the very first tabbable element when the voice page loads, allowing keyboard users to bypass repetitive header navigation.
    - The link targets a `main` HTML element with the ID `main-content` (e.g., `<main id="main-content" tabIndex={-1}>`) within `apps/web/app/[locale]/voice/page.tsx`. The `tabIndex={-1}` attribute makes the `main` element programmatically focusable without being part of the natural tab order, ensuring that activating the skip link correctly moves focus to the primary content region.

2.  **Standardized Focus States**:
    - We introduced a new CSS utility class, `pageHeaderFocusRingClass`, in `apps/web/app/[locale]/components/PageHeader.tsx` and `VOICE_FOCUS_RING_CLASS` in `apps/web/app/[locale]/voice/lib/accessibility.ts`. These classes leverage `focus-visible` pseudo-class to apply a consistent, strong emerald-colored outline (`focus-visible:outline-[3px] focus-visible:outline-emerald-600 focus-visible:outline-offset-2 focus-visible:ring-[3px] focus-visible:ring-emerald-600 focus-visible:ring-offset-2`) to interactive elements when focused via keyboard.
    - This class is now applied to the back button in `PageHeader.tsx` and to the `VoiceAnimationToggle.tsx` component, ensuring a clear visual indication of focus. It is also intended for other interactive elements within `VoicePanels.tsx` as indicated by the diff, although the full application isn't shown in the provided diff snippet.

3.  **Scoped `Escape` Key Handling**:
    - The `Escape` key's behavior has been refined to be context-aware. Instead of a global listener, `Escape` key events are now handled specifically within the voice region. This prevents the `Escape` key from inadvertently closing modals or resetting states in other parts of the application or interfering with native browser form controls.
    - The implementation for this likely involves `useEffect` hooks within `apps/web/app/[locale]/voice/page.tsx` or its child components, attaching and detaching event listeners for the `keydown` event, and conditionally executing logic (e.g., stopping speech, stopping listening, or resetting panels) only when the voice flow is in an appropriate state (e.g., listening, review, result, error). Not documented in this PR are the specific function names or exact file locations for the `Escape` key event listener.

4.  **Centralized Accessibility Helpers**:
    - A new utility file, `apps/web/app/[locale]/voice/lib/accessibility.ts`, has been created. This file centralizes functions related to accessibility, such as programmatically managing focus (e.g., `focusElement` to move focus to a specific element after a state change) and making screen-reader announcements (e.g., `announceForScreenReader` to provide dynamic updates to assistive technologies). This promotes code reusability and maintainability for accessibility features. Not documented in this PR are the specific function signatures or full implementations within this file.

5.  **Localized Accessibility Copy**:
    - The text for the "Skip to main content" link and other screen-reader announcements has been added or updated across multiple locale message files: `apps/web/messages/bn.json`, `apps/web/messages/en.json`, `apps/web/messages/mr.json`, `apps/web/messages/ta.json`, and `apps/web/messages/te.json`. This ensures that accessibility features are fully localized for our diverse user base.

6.  **Keyboard Navigation Documentation**:
    - A new markdown document, `KEYBOARD_NAV.md`, has been added to the repository root. This document explicitly outlines the supported keyboard keys (`Tab`, `Shift + Tab`, `Enter`, `Space`, `Escape`), the expected focus order for various voice states (Initial, Listening, Review, Result, Error), and provides a detailed manual audit checklist for verifying keyboard accessibility.

7.  **Automated Accessibility Testing**:
    - We've introduced automated accessibility testing for the voice page. A new `npm` script, `npm run test:a11y:voice`, has been added to `apps/web/package.json`. This script executes an `axe-core` audit against the real `/en/voice` page using `apps/web/scripts/voice-a11y-audit.mjs`. This provides continuous integration for accessibility, catching common issues early in the development cycle.
    - Expanded regression tests in `apps/web/tests/voice-accessibility.test.tsx`, `apps/web/tests/voice-helpers.test.ts`, and `apps/web/tests/voice-page-accessibility.test.tsx` now cover skip-link placement, focus behavior, and screen-reader announcement logic, ensuring that these accessibility improvements are not regressed in future changes.

## Technical Decisions

Our decisions were driven by a commitment to WCAG (Web Content Accessibility Guidelines) principles, specifically focusing on perceivable, operable, and robust content.

- **Skip Link Implementation**: We chose to implement a standard "Skip to main content" link as it is a widely recognized and effective pattern for keyboard users to bypass repetitive navigation. Placing it in `layout.tsx` ensures it's the first element in the tab order, and targeting a `main` element with `tabIndex={-1}` provides a semantically correct and focusable landmark for the main content.
- **`focus-visible` for Focus States**: Instead of relying solely on the default browser `outline` or a simple `:focus` style, we adopted `focus-visible`. This CSS pseudo-class ensures that focus outlines are only shown when the user is navigating with a keyboard or other non-mouse input, providing a cleaner visual experience for mouse users while retaining critical feedback for keyboard users. The use of a strong emerald color aligns with our brand identity and provides high contrast.
- **Scoped `Escape` Handling**: The decision to scope `Escape` key handling to the voice region was crucial for preventing accessibility anti-patterns. A global `Escape` listener can create unexpected behavior, especially if it interferes with native browser functions (like closing a select dropdown) or other application-level modals. By making it context-aware, we ensure that the `Escape` key performs its expected function within the voice flow (e.g., stopping listening, resetting panels) without negatively impacting other parts of the UI.
- **Centralized Accessibility Utilities**: Creating `apps/web/app/[locale]/voice/lib/accessibility.ts` promotes a modular and maintainable approach to accessibility. It allows us to encapsulate common accessibility patterns (like programmatic focus management and screen reader announcements) in one place, reducing duplication and making it easier to apply consistent accessibility practices across the voice feature.
- **Automated `axe-core` Integration**: Integrating `axe-core` via a dedicated `npm` script (`test:a11y:voice`) was a strategic decision to shift accessibility testing left in our development process. `axe-core` is an industry-standard accessibility testing engine that can catch a significant percentage of common accessibility violations automatically, providing a safety net against regressions and ensuring a baseline level of accessibility without requiring extensive manual audits for every change.

## How To Re-Implement (Contributor Reference)

To re-implement or extend the keyboard accessibility features for the Voice Triage flow, a contributor would follow these steps:

1.  **Define Focus Ring Styles**:
    - Create a reusable CSS class (e.g., `VOICE_FOCUS_RING_CLASS` in `apps/web/app/[locale]/voice/lib/accessibility.ts` or a global utility file) that applies `focus-visible` styles.
    - Example: `const VOICE_FOCUS_RING_CLASS = "focus-visible:outline-[3px] focus-visible:outline-emerald-600 focus-visible:outline-offset-2 focus-visible:ring-[3px] focus-visible:ring-emerald-600 focus-visible:ring-offset-2";`
    - Apply this class to all interactive elements (buttons, links, switches) within the voice components (e.g., `VoiceAnimationToggle.tsx`, `VoicePanels.tsx`, `PageHeader.tsx`).

2.  **Implement Skip-Navigation Link**:
    - In `apps/web/app/[locale]/voice/layout.tsx`, add an `<a>` tag as the very first child of the main layout container.
    - Set its `href` to `"#main-content"` and provide an `sr-only` class for visual hiding until focused.
    - In `apps/web/app/[locale]/voice/page.tsx`, wrap the primary content of the voice page within a `<main>` element and assign it `id="main-content"`. Crucially, add `tabIndex={-1}` to this `main` element to make it programmatically focusable.

3.  **Manage Programmatic Focus**:
    - Create helper functions in `apps/web/app/[locale]/voice/lib/accessibility.ts` for managing focus.
    - Example: `export function focusElement(selector: string) { const element = document.querySelector(selector); if (element instanceof HTMLElement) { element.focus(); } }`
    - Use these helpers within `useEffect` hooks in `apps/web/app/[locale]/voice/page.tsx` or `VoicePanels.tsx` to programmatically move focus to the relevant panel or control when the voice state changes (e.g., from initial to review, or to an error state).

4.  **Implement Scoped `Escape` Key Handling**:
    - In `apps/web/app/[locale]/voice/page.tsx` or a parent component that manages the voice state, use a `useEffect` hook to add and remove an event listener for the `keydown` event.
    - Inside the event handler, check `event.key === 'Escape'`.
    - Implement conditional logic to perform actions (e.g., `stopListening()`, `resetVoiceFlow()`) only if the current voice state is appropriate and the event target is not a native form control that should handle `Escape` itself. Remember to call `event.preventDefault()` if the default browser behavior needs to be suppressed.

5.  **Add Screen Reader Announcements**:
    - In `apps/web/app/[locale]/voice/lib/accessibility.ts`, create a function (e.g., `announceForScreenReader(message: string)`) that dynamically adds an `aria-live` region to the DOM and updates its content.
    - Use this function to announce important state changes or feedback to screen reader users (e.g., "Listening started," "Review panel loaded").

6.  **Localize Accessibility Text**:
    - Add new keys for accessibility-specific strings (e.g., `voice.skipToMainContent`, `voice.listeningStarted`) to all relevant `apps/web/messages/*.json` files.
    - Use our `useTranslations` hook to retrieve these localized strings in the UI.

7.  **Document Keyboard Navigation**:
    - Create or update `KEYBOARD_NAV.md` with a clear outline of supported keys, expected focus order for all states, and a manual audit checklist.

8.  **Integrate Automated Accessibility Testing**:
    - Add `axe-core` as a development dependency to `apps/web/package.json`.
    - Create a script like `apps/web/scripts/voice-a11y-audit.mjs` that uses a headless browser (e.g., Playwright or Puppeteer) to navigate to `/en/voice`, inject `axe-core`, and run an audit.
    - Add an `npm` script (e.g., `"test:a11y:voice": "node scripts/voice-a11y-audit.mjs"`) to `apps/web/package.json`.
    - Write Playwright/Cypress tests in `apps/web/tests/voice-page-accessibility.test.tsx` to assert specific accessibility behaviors like skip-link functionality, focus trapping, and `aria-live` announcements.

## Impact on System Architecture

This PR significantly strengthens the accessibility foundation of the SahiDawa platform, particularly for our interactive Voice Triage feature.

- **Enhanced User Experience**: By making the Voice Triage flow fully keyboard-navigable and screen-reader friendly, we are expanding our reach to a broader user base, including individuals with motor disabilities or those who prefer assistive technologies. This aligns with our mission to provide inclusive health solutions.
- **Accessibility as a First-Class Concern**: The introduction of `KEYBOARD_NAV.md` and automated `axe-core` testing establishes accessibility as a formal and continuous part of our development lifecycle. This sets a precedent for future feature development, encouraging developers to consider accessibility from the outset rather than as an afterthought.
- **Modular Accessibility Utilities**: The creation of `apps/web/app/[locale]/voice/lib/accessibility.ts` promotes a modular approach to accessibility code. This pattern can be extended to other complex interactive components across the SahiDawa platform, leading to more consistent and maintainable accessibility implementations.
- **Improved Code Quality and Maintainability**: Standardizing focus styles and centralizing accessibility logic reduces code duplication and makes it easier to update or extend accessibility features in the future.
- **Reduced Technical Debt**: Addressing these accessibility issues proactively reduces potential future technical debt and the risk of non-compliance with accessibility standards.

This change positions SahiDawa to deliver a more robust and universally accessible user experience, reinforcing our commitment to serving all members of the community.

## Testing & Verification

The changes introduced in this PR were thoroughly tested through both manual and automated methods:

**Manual Verification**:
The following steps were performed manually, as detailed in `KEYBOARD_NAV.md` and the PR description:

1.  The web app was started locally using `npm run dev -w web`.
2.  The `/en/voice` page was accessed at `http://127.0.0.1:3000/en/voice`.
3.  Pressing `Tab` once confirmed that the "Skip to main content" link appeared as the first tabbable element.
4.  Activating the skip link (by pressing `Enter` or `Space`) confirmed that focus correctly landed on the `main#main-content` element.
5.  Tabbing through the initial controls (Header back button, Voice language selector, Voice animation toggle, Voice mic button) confirmed the presence of the visible emerald focus outline (`focus-visible:outline-emerald-600`).
6.  The voice flow was driven into Listening, Review, Result, and Error states, and focus behavior was confirmed to be logical, with the active panel receiving programmatic focus and no keyboard traps observed.
7.  Pressing `Escape` in supported voice states (e.g., during listening, or in review/result/error panels) confirmed that the flow exited cleanly or reset to the initial state without affecting unrelated controls or creating unexpected side effects.

**Automated Verification**:
Automated tests were executed to ensure accessibility compliance and prevent regressions:

1.  **Automated `axe-core` Audit**: The command `npm run test:a11y:voice` was executed, which runs `apps/web/scripts/voice-a11y-audit.mjs`. This script performs an `axe-core` audit on the `/en/voice` page, identifying common accessibility violations. The terminal output screenshots provided in the PR confirm successful execution with no critical `axe-core` violations.
2.  **Expanded Regression Tests**: The following test suites were run:
    - `npm test -w web -- --runInBand apps/web/tests/voice-accessibility.test.tsx`
    - `npm test -w web -- --runInBand apps/web/tests/voice-page-accessibility.test.tsx`
    - `npm test -w web -- --runInBand apps/web/tests/voice-helpers.test.ts`
    - `npm test -w web -- --runInBand apps/web/tests/voice-audio-visualizer.test.tsx` (This test suite was included in the verification commands, but its direct relevance to keyboard accessibility improvements is not explicitly documented in the PR description, so its specific contribution to this PR's testing is "Not documented in this PR").
      These tests specifically cover skip-link placement, programmatic focus behavior, and screen-reader announcement logic, ensuring that the new accessibility features function as expected and are protected against future regressions.

**Edge Cases**:

- The `KEYBOARD_NAV.md` explicitly notes that the voice visualizer is not focusable, preventing it from trapping keyboard users.
- It also clarifies that the current voice flow uses inline panels rather than modal dialogs, simplifying focus management by avoiding complex dialog focus loops.
- The `Escape` key handling is scoped to prevent interference with native form controls, addressing a common edge case where global listeners can cause issues.
