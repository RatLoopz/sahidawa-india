# ADR — fix(map): resolve pharmacy map control overlap

> **Date:** 2026-05-19 | **PR:** #342 | **Status:** Accepted

## Context

The SahiDawa map interface suffered from significant UI control overlap, particularly affecting the pharmacy list, risk layers control, and the chatbot. These persistent controls were previously positioned in a right-side overlay stack, leading to a poor user experience and obscuring map content, especially on mobile devices. This issue was tracked as #224.

## Decision

A comprehensive refactoring of the map's UI layout and component structure was implemented to resolve the control overlap.

1.  **Consolidated Pharmacy UI:** The pharmacy results UI was extracted and refactored into a new, shared `PharmacyPanels` component.
2.  **Responsive Layout for PharmacyPanels:** This `PharmacyPanels` component was designed to adapt responsively:
    *   On mobile devices, it renders as a bottom sheet/drawer.
    *   On `md+` (tablet and desktop) screens, it transforms into a dedicated left sidebar.
3.  **Relocation of Controls:**
    *   The floating risk-layers card was removed from the main map pane, and its controls were integrated directly into the `PharmacyPanels` component.
    *   The chatbot's positioning logic was made route-aware, specifically on the map page, to anchor it away from the problematic overlap zone and prevent competition for screen space with the new `PharmacyPanels` layout.
4.  **Accessibility and Testing:** Explicit `aria-label`s were added to icon-only map controls, and focused Jest coverage was introduced for the chatbot's route-aware positioning, the shared `PharmacyPanels` component rendering, and the responsive map layout shell.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Dynamic Resizing/Hiding of Overlapping Elements:** Attempt to dynamically shrink, collapse, or hide overlapping elements based on screen size or user interaction within their existing floating positions. | This approach often leads to a cramped and inconsistent UI, requiring complex state management for visibility and size. It would likely not fully resolve overlap without making elements unusable and would fail to provide dedicated, persistent access to key information like a sidebar. |
| **Tabbed Interface within Existing Right-Side Overlay:** Keep all persistent controls (pharmacy list, risk layers, chatbot) within the existing right-side overlay, but introduce a tabbed navigation system to switch between them. | While consolidating space, this forces users to constantly switch contexts, reducing discoverability and quick access to information. It would still occupy a significant portion of the map and might feel cramped, especially on smaller screens, without offering the persistent visibility of a sidebar. |

## Consequences

**Positive:**
- Resolved critical UI overlap bug (Issue #224) across all screen sizes, significantly improving the user experience on the map page.
- Enhanced usability and intuitiveness by providing dedicated and consistent spaces for the pharmacy list and risk layers.
- Improved accessibility through the addition of explicit `aria-label`s to map controls.
- Increased code reusability and maintainability with the introduction of the shared `PharmacyPanels` component.
- Strengthened test coverage for critical UI components and layout logic, reducing the likelihood of future regressions.
- The map itself has more unobstructed space, improving focus on geographical data.

**Trade-offs:**
- Increased complexity in the frontend's responsive layout logic to manage the conditional rendering and styling of the bottom sheet versus the left sidebar.
- The chatbot component now has a direct dependency on `next/navigation` (`usePathname`) for its route-aware positioning, coupling it more tightly to the Next.js routing system.
- Required a substantial refactor of existing UI components, which inherently carries a risk of introducing new bugs if not thoroughly tested.

## Related Issues & PRs

- PR #342: fix(map): resolve pharmacy map control overlap
- Issue #224