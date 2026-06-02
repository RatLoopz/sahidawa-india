# ADR — fixes White flash on Pharmacy Map page navigation in dark theme

> **Date:** 2026-06-01 | **PR:** #1095 | **Status:** Accepted

## Context

The Pharmacy Map page (`/map`) exhibited a noticeable "white flash" when navigated to while the application was in dark theme. This occurred during the initial rendering of the `PharmacyMap` component and its associated loading states, where elements briefly displayed a light-themed background before the dark theme styles were fully applied, resulting in a jarring user experience.

## Decision

The architectural decision was to resolve the dark theme white flash by applying theme-aware styling directly to the `PharmacyMap` component and its loading state. This was implemented by:

1.  Replacing hardcoded light-theme background and text colors (e.g., `bg-slate-100`, `text-slate-400`, `bg-white`) with CSS variables that dynamically resolve based on the active theme (e.g., `bg-(--color-surface-muted)`, `text-(--color-text-muted)`, `bg-(--color-surface-page)`).
2.  Explicitly adding `dark:bg-[#0d1117]` to critical container elements within `PharmacyMap.tsx` and `loading.tsx` to ensure an immediate dark background is present during initial render when the dark theme is active, preventing the white flash.

## Alternatives Considered

| Alternative                                                        | Why Rejected                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dynamic Import / Client-Side Rendering (CSR) for Map Component** | An earlier attempt to dynamically import `PharmacyMap` was reverted. While this could address SSR-related theme mismatches, it was likely deemed an over-engineered solution for this specific visual bug, potentially introducing other complexities like increased client-side bundle size, delayed initial content render, or SEO implications for map data, without directly addressing the root cause of inconsistent styling. |
| **Global CSS Overrides / Theme Provider Refinement**               | Attempting to fix the issue solely through global CSS overrides or by refining the theme provider's root application might not have been granular enough to target the specific elements causing the flash during their initial render. Direct component-level styling was chosen for its immediate and precise impact on the problematic areas without requiring broader theme system refactoring.                                 |

## Consequences

**Positive:**

- Eliminated the jarring "white flash" bug, significantly improving the user experience when navigating to the Pharmacy Map page in dark theme.
- Ensured consistent visual presentation of the map component's loading and error states across both light and dark themes from the initial render.
- Improved overall UI/UX consistency and polish for the `apps/web` frontend.

**Trade-offs:**

- The direct application of a hardcoded dark background color (`dark:bg-[#0d1117]`) introduces a magic number for a specific dark theme background. While effective, this value is less flexible than a CSS variable and would require manual updates if the primary dark theme background color changes in the future.

## Related Issues & PRs

- PR #1095: fixes White flash on Pharmacy Map page navigation in dark theme
- Issue #1087
