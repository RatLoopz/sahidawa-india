# ADR — fix(bug): improve mobile responsiveness across pages (closes #355)

> **Date:** 2026-05-23 | **PR:** #479 | **Status:** Accepted

## Context

The SahiDawa web application exhibited significant UI/UX layout issues on mobile viewports, including unintended horizontal scrolling, overlapping elements, and misaligned components. These issues led to a degraded user experience, making the application difficult to navigate and read on smaller screens. A consistent and polished mobile experience was critical for the platform's accessibility and usability in rural health contexts.

## Decision

A comprehensive mobile-first responsive design strategy was implemented across the `apps/web` frontend. This involved:

1.  Applying `overflow-hidden` and other appropriate overflow constraints to prevent horizontal scrolling on pages such as Report Incident and Scanner.
2.  Refining header elements on the Home screen using mobile-first Tailwind CSS utility classes (e.g., `sm:h-10`, `sm:w-10`, `sm:px-4`, `sm:py-2`) to ensure brand text and button touch targets scaled appropriately across different viewports.
3.  Adjusting padding on the desktop Map dashboard (`md:pb-0`) to eliminate unintended blank gaps and ensure the map sat flush against the viewport bottom.
    This approach leveraged Tailwind's utility-first and mobile-first capabilities to build adaptable UI components.

## Alternatives Considered

| Alternative                                             | Why Rejected                                                                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom CSS/SCSS with explicit media queries             | Would introduce more verbose and potentially less maintainable stylesheets compared to Tailwind's utility-first approach, increasing development time for granular adjustments and diverging from the existing framework. |
| JavaScript-driven dynamic layout adjustments            | Could introduce performance overhead, potential for layout shifts (FOUC), and make the UI dependent on client-side JS execution, which is less robust and performant than CSS-based responsiveness for core layout.       |
| Implementing separate mobile and desktop component sets | Would significantly increase development and maintenance overhead due to code duplication and the need to manage two distinct UI implementations for the same features.                                                   |

## Consequences

**Positive:**

- Significantly improved user experience and accessibility on mobile devices, ensuring the platform is fully functional and readable across various screen sizes.
- Eliminated critical UI/UX bugs such as horizontal scrolling, element overlaps, and misalignments, enhancing application polish.
- Established a consistent and maintainable pattern for responsive design using mobile-first Tailwind CSS, facilitating future UI development.

**Trade-offs:**

- Required meticulous application and testing of responsive utility classes across multiple components, increasing initial development effort.
- Potential for increased CSS bundle size due to the comprehensive nature of Tailwind CSS, though optimized builds mitigate this.

## Related Issues & PRs

- PR #479: fix(bug): improve mobile responsiveness across pages (closes #355)
- Issue #355: improve mobile responsiveness across pages
