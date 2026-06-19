# ADR — feat(web): replace custom back buttons with PageHeader

> **Date:** 2026-06-16 | **PR:** #1939 | **Status:** Accepted

## Context

Prior to this decision, various auxiliary pages within the `apps/web` application implemented custom back button logic and styling. This led to inconsistencies in user interface (UI) presentation, varied navigation behavior, and increased code duplication across different pages. The lack of a standardized approach for common navigation elements like back buttons hindered maintainability and the enforcement of a cohesive design system.

## Decision

The decision was to standardize back button implementations by replacing all custom back button logic and styling with the existing, reusable `PageHeader` component. This component already encapsulates the desired visual and functional requirements for page headers, including back navigation.

Implementation involved:

- Modifying `apps/web/app/[locale]/alerts/page.tsx`, `apps/web/app/[locale]/settings/page.tsx`, `apps/web/app/[locale]/interaction-checker/page.tsx`, and `apps/web/app/[locale]/profile/page.tsx`.
- Removing specific imports such as `ArrowLeft` and `Link` that were previously used for custom back button rendering.
- Integrating the `PageHeader` component with the `backHref="/" `prop to ensure consistent navigation back to the home page.
- Ensuring the alignment and styling of the back button now conform to the standardized layout provided by `PageHeader`.

## Alternatives Considered

| Alternative                                             | Why Rejected                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Maintain custom back button implementations             | This approach was the root cause of the problem, leading to UI inconsistency, code duplication, and increased maintenance overhead. It did not align with the goal of establishing a standardized design system.                                                                                                                |
| Create a new dedicated `BackButton` component           | While this would improve reusability, it would introduce another component for a function already handled by `PageHeader`. `PageHeader` already provides the necessary styling and navigation logic for header-level back buttons, making a separate component redundant and potentially fragmenting header-related components. |
| Standardize only the styling of existing custom buttons | This would address visual inconsistency but would not resolve the underlying code duplication or the maintenance burden of disparate navigation logic. Each page would still manage its own back button implementation, just with a shared stylesheet, failing to fully leverage component reusability.                         |

## Consequences

**Positive:**

- **Improved UI Consistency:** Ensures a uniform look, feel, and behavior for back navigation across key auxiliary pages, enhancing the overall user experience.
- **Reduced Code Duplication:** Eliminates redundant back button logic and styling from individual pages, leading to a leaner and more maintainable codebase.
- **Simplified Maintenance:** Future updates or changes to back button functionality or styling can be managed centrally within the `PageHeader` component, reducing the effort required for system-wide changes.
- **Enforced Design System:** Reinforces the adoption and use of a standardized component library for common UI elements, promoting architectural coherence.

**Trade-offs:**

- **Initial Refactoring Effort:** Required modifications to multiple existing pages to adopt the new component, incurring a one-time development cost.
- **Increased Component Dependency:** Pages now rely on the `PageHeader` component for their back navigation, meaning changes to `PageHeader` could potentially impact these pages.

## Related Issues & PRs

- PR #1939: feat(web): replace custom back buttons with PageHeader
- Issue #1544
