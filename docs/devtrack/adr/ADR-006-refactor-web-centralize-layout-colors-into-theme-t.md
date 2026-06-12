# ADR — refactor(web): centralize layout colors into theme tokens

> **Date:** 2026-05-21 | **PR:** #377 | **Status:** Accepted

## Context

The `apps/web` frontend contained numerous hardcoded hexadecimal color values for layout elements, scattered across various CSS files and components. This practice led to inconsistencies in the user interface's visual appearance, made global color changes difficult, and increased the risk of visual regressions during development and maintenance. Maintaining a consistent design language was challenging without a centralized system for managing these fundamental visual properties.

## Decision

A decision was made to centralize layout-related color definitions into CSS custom properties (theme tokens). These tokens were defined in `apps/web/app/[locale]/globals.css`. All identified instances of hardcoded layout color literals across global styles, print styles, and specific UI components (e.g., map surfaces, health cards, chat bubbles, login page background) were subsequently replaced with references to these newly established theme tokens.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Continue using hardcoded hex values | Perpetuated existing issues of visual inconsistency, increased maintenance burden for global style changes, and hindered future theming efforts. |
| Implement a full utility-first CSS framework (e.g., Tailwind CSS) | Represented a significantly larger architectural shift, introducing a new dependency and styling paradigm that was beyond the scope of merely centralizing color definitions. The overhead was deemed too high for the immediate problem. |
| Use a CSS preprocessor (e.g., SASS variables) for color management | While effective, it would introduce an additional build step and dependency for a problem that could be solved natively with CSS custom properties, which offer similar benefits for variable management without the compilation overhead. |

## Consequences

**Positive:**
- Achieved consistent visual styling for layout colors across the `apps/web` frontend.
- Streamlined future maintenance and global updates of layout color schemes.
- Reduced the likelihood of visual regressions by enforcing a single source of truth for these colors.
- Established a foundational pattern for broader design token implementation and potential theming capabilities (e.g., dark mode).

**Trade-offs:**
- Required an initial refactoring effort to identify and replace all existing hardcoded color instances.
- Developers must now adhere to the new token system for all new or modified layout color applications.

## Related Issues & PRs

- PR #377: refactor(web): centralize layout colors into theme tokens
- Issue #250