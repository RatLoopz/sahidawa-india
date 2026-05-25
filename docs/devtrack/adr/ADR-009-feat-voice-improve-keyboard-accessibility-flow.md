# ADR — feat(voice): improve keyboard accessibility flow

> **Date:** 2026-05-24 | **PR:** #498 | **Status:** Accepted

## Context

The Voice Triage flow within the SahiDawa platform exhibited significant keyboard accessibility deficiencies. Users navigating with keyboards or screen readers faced challenges including the absence of a "skip to main content" mechanism, inconsistent and weak visual focus indicators, unpredictable focus order, potential for keyboard traps, and `Escape` key handling that could interfere with unrelated UI elements. This hindered usability for a critical feature and presented compliance risks with web accessibility standards.

## Decision

A comprehensive set of keyboard accessibility improvements was implemented for the Voice Triage flow. This involved:

1.  **Structural Accessibility:** A "Skip to main content" link was added as the first tabbable element in the voice layout, programmatically linked to a focusable `main#main-content` landmark.
2.  **Visual Accessibility:** Visible focus states were standardized and strengthened across all interactive elements within the voice page and its header, utilizing a distinct "emerald" outline.
3.  **Behavioral Accessibility:**
    - `Escape` key handling was scoped to ensure voice-state exits (e.g., stopping listening, resetting panels) only triggered within the voice region, preventing interference with native form controls or other page elements.
    - Centralized accessibility helper functions were introduced for consistent programmatic focus management and screen-reader announcements.
    - Localized text for the skip link and screen-reader announcements was expanded for supported locales.
4.  **Documentation:** A new `KEYBOARD_NAV.md` file was created, detailing supported keyboard shortcuts, the expected focus order for all voice states (initial, listening, review, result, error), and a manual audit checklist.
5.  **Automated Testing:** Automated accessibility coverage was integrated using `axe-core` via a new `npm run test:a11y:voice` command. Existing regression tests were expanded to cover skip-link placement, focus behavior, and screen-reader announcement logic.

## Alternatives Considered

| Alternative | Why Rejected

## Consequences

**Positive:**

- Significantly improved accessibility for keyboard users and assistive technology users in the Voice Triage flow, aligning with WCAG standards.
- Enhanced user experience through predictable focus management, clear visual indicators, and logical navigation paths.
- Reduced risk of accessibility violations and improved platform inclusivity.
- Established clear documentation for keyboard navigation, aiding both developers and manual testers.
- Integrated automated accessibility testing into the CI/CD pipeline, enabling early detection of regressions and ensuring long-term accessibility compliance.

**Trade-offs:**

- Increased codebase size due to new accessibility helpers, documentation, and expanded test suites.
- Added development and maintenance overhead for accessibility features and their corresponding tests.
- Required careful implementation of scoped `Escape` key handling to avoid unintended side effects or conflicts with native browser behaviors outside the voice region.

## Related Issues & PRs

- PR #498: feat(voice): improve keyboard accessibility flow
- Issue #476
