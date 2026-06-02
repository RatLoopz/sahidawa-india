# ADR — Enhance landing page UI and mobile responsiveness

> **Date:** 2026-06-02 | **PR:** #1072 | **Status:** Accepted

## Context

The existing landing page UI/UX for the SahiDawa frontend exhibited inconsistencies in layout, visual hierarchy, and mobile responsiveness. This hindered overall usability and the professional presentation of the platform, necessitating a comprehensive update to align with a cleaner, healthcare-focused design while preserving the established dark medical aesthetic.

## Decision

A significant UI/UX enhancement was implemented for the `apps/web` landing page. This involved a holistic refinement of the layout, spacing, and typography hierarchy, alongside a substantial improvement in mobile responsiveness across all primary sections. Specific changes included:

- Optimizing the hero section's spacing and typography.
- Improving the responsiveness and alignment of the navigation bar.
- Updating feature cards and Call-to-Action (CTA) sections for enhanced readability and visual impact.
- Adjusting the positioning of the chatbot and back-to-top buttons for better mobile user experience.
- Addressing and fixing missing translation/message keys across locale files to ensure internationalization consistency.
  The existing dark medical-themed UI aesthetic was intentionally preserved throughout these improvements.

## Alternatives Considered

| Alternative                                                               | Why Rejected                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Incremental, piecemeal UI fixes                                           | Would have resulted in slower overall improvement, potential for inconsistent design language across disparate fixes, and failed to achieve a cohesive "cleaner healthcare-focused design" holistically.                                   |
| Adoption of a new third-party UI framework (e.g., Material UI, Chakra UI) | Required significant refactoring effort to integrate into the existing Next.js/TailwindCSS setup, introducing a new dependency and potentially deviating from the current custom design philosophy.                                        |
| Full redesign with a completely new aesthetic/theme                       | Was outside the scope of this enhancement, which aimed to improve usability while explicitly preserving the existing dark medical-themed aesthetic. Would have required extensive stakeholder review and a much larger development effort. |

## Consequences

**Positive:**

- Significantly improved user experience and accessibility across various devices, particularly on mobile.
- Enhanced visual appeal and professional presentation of the SahiDawa platform, reinforcing its healthcare focus.
- Achieved greater consistency in layout, spacing, and typography across the entire landing page.
- Resolved minor internationalization issues by fixing missing translation keys.

**Trade-offs:**

- Required careful and extensive testing to prevent regressions in existing functionality and ensure UI stability across different breakpoints.
- Involved modifications to multiple UI components and locale files, increasing the overall scope and complexity of the pull request.

## Related Issues & PRs

- PR #1072: Enhance landing page UI and mobile responsiveness
- Issue #793
