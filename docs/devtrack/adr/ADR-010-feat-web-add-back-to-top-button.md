# ADR — feat(web): add back to top button

> **Date:** 2026-05-27 | **PR:** #744 | **Status:** Accepted

## Context

Users navigating long pages within the SahiDawa web application experienced friction when attempting to return to the top of the content. The only available method was manual scrolling, which could be cumbersome and time-consuming, particularly on mobile devices or for users with motor impairments. This impacted overall user experience and efficiency.

## Decision

A reusable "Back to Top" button component (`BackToTopButton.tsx`) was implemented and integrated into the global web application layout (`layout.tsx`). This component dynamically appears only after a user scrolls down a predefined distance (400 pixels), providing a clear visual cue for navigation. Upon activation, the button smoothly scrolls the user back to the top of the page. The implementation includes accessible labeling (`aria-label`, `title`) and keyboard navigation support (`tabIndex`), ensuring compliance with accessibility standards. The button is positioned as a floating UI element, designed not to interfere with existing components like the chatbot, and supports internationalization (i18n) for its label.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Rely on native browser scroll behavior (manual scrolling, Home key) | Less convenient for mouse/touch users on very long pages. Lacks smooth animation and a clear visual affordance for returning to the top. |
| Implement a fixed header with a "Scroll to Top" link/button | Would consume valuable screen real estate at the top of the page, potentially conflicting with existing header elements or navigation. Less dynamic than a floating button that appears only when needed. |
| Implement pagination or "load more" functionality for long content | Not universally applicable for all types of long pages (e.g., articles, detailed reports). Requires significant content restructuring and potential backend changes, which was out of scope for a UI navigation improvement. |

## Consequences

**Positive:**
- Significantly improved user experience for navigating long content by providing a quick and intuitive way to return to the top.
- Enhanced accessibility through explicit ARIA labeling, keyboard focus management, and smooth scrolling.
- Consistent navigation element across the entire web application due to global mounting in the layout.
- Supports multiple languages, aligning with SahiDawa's internationalization strategy.

**Trade-offs:**
- Introduced additional client-side JavaScript and a new component to the web application bundle, slightly increasing initial load time and memory footprint.
- Added a new floating UI element, requiring careful positioning and Z-index management to prevent conflicts with other UI components.

## Related Issues & PRs

- PR #744: feat(web): add back to top button
- Issue #623