# ADR — feat(voice): improve accessibility and assistive feedback

> **Date:** 2026-05-23 | **PR:** #469 | **Status:** Accepted

## Context

The Voice Triage feature within the SahiDawa platform lacked comprehensive accessibility support, hindering its usability for individuals relying on assistive technologies such as screen readers, keyboard navigation, or those with motion sensitivities. This deficiency was identified as a critical barrier to equitable access, tracked in issue #442, and required significant improvements to align with the platform's mission of inclusive rural health.

## Decision

A comprehensive set of accessibility enhancements was implemented for the Voice Triage flow within the `apps/web` frontend. The decision involved:

1.  **Screen Reader Announcements:** Integrated a hidden `role="status"` live region to provide dynamic, polite announcements for key states (listening, processing, review, result, error) to assistive technologies.
2.  **Keyboard Focus Management:** Implemented logic to programmatically manage keyboard focus, ensuring users are automatically directed to the active voice panel as the flow progresses, maintaining a logical navigation sequence.
3.  **Visible Focus States:** Added `focus-visible` rings to interactive elements, including the microphone button and action buttons, to clearly indicate keyboard focus.
4.  **Reduced Motion Support:** Incorporated `motion-reduce:animate-none` CSS utility to disable animated panels and processing indicators for users who have a preference for reduced motion.
5.  **Accessible Progressbar Semantics:** Enhanced the audio visualizer volume meter with `role="progressbar"`, `aria-label`, `aria-valuemin`, `aria-valuemax`, and dynamically updated `aria-valuenow` attributes to convey volume levels to screen readers.

These changes were applied across `VoiceAudioVisualizer.tsx`, `VoicePanels.tsx`, and `page.tsx`, supported by new accessibility helper functions and validated by dedicated accessibility tests.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Partial Accessibility Implementation** | Addressing only the most critical accessibility issues (e.g., screen reader announcements) and deferring others (keyboard focus, motion reduction) to future iterations would have left significant accessibility gaps, failing to fully meet the requirements of issue #442 and potentially necessitating more complex refactoring later. |
| **Third-party Accessibility Library/Framework** | Integrating a dedicated, comprehensive accessibility library or framework was considered. However, the required improvements were specific to the Voice Triage flow and could be effectively implemented using native ARIA attributes and existing CSS utilities without introducing a new dependency, which might have added unnecessary bundle size or integration complexity. |

## Consequences

**Positive:**
-   Significantly improved user experience and navigability for individuals using assistive technologies (screen readers, keyboard).
-   Enhanced compliance with web accessibility standards (e.g., WCAG), making the SahiDawa platform more inclusive.
-   Reduced cognitive load and improved comfort for users with motion sensitivities due to explicit `motion-reduce` support.
-   Increased robustness and reliability of the Voice Triage feature, aligning with the platform's goal of equitable health access.
-   Established a strong precedent for prioritizing and implementing comprehensive accessibility features in future development.

**Trade-offs:**
-   Introduced a slight increase in frontend code complexity due to the addition of ARIA attributes, CSS classes for focus states, and programmatic focus management logic.
-   Requires ongoing diligence during future UI changes to ensure these accessibility standards are maintained.
-   Incurred an initial development and testing time investment dedicated to these specific accessibility features.

## Related Issues & PRs

-   PR #469: feat(voice): improve accessibility and assistive feedback
-   Issue #442