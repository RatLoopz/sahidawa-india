# ADR — Bug/responsive chat and dark mode

> **Date:** 2026-05-31 | **PR:** #941 | **Status:** Accepted

## Context

The AI Chat component within the SahiDawa platform exhibited significant user experience deficiencies on mobile devices, including layout, spacing, and overflow issues. Furthermore, the component lacked dark mode compatibility, leading to visual inconsistencies when the platform's global theme or user's system preference was set to dark mode. This hindered the goal of a polished, responsive, and visually integrated AI Chat experience.

## Decision

The `apps/web` frontend was updated to implement responsive design principles for the AI Chat component (`Chatbot.tsx`). This involved adjusting Tailwind CSS classes to ensure proper layout, spacing, and overflow handling across various screen sizes, particularly mobile. Concurrently, dark mode support was integrated into the `Chatbot.tsx` component by applying `dark:` variants to relevant Tailwind CSS classes for the chat panel header, user messages, and action buttons, ensuring visual consistency with dark themes.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Implement a separate, dedicated mobile-only chat interface. | This approach would introduce significant development and maintenance overhead by requiring two distinct UI implementations for the same feature. It would also increase the bundle size and complexity of state management across different views, rather than leveraging responsive CSS for a unified codebase. |
| Defer dark mode implementation for the AI Chat, or rely on a future global theme system to automatically handle it. | Deferring would result in an immediate inconsistent user experience, especially if other parts of the platform already support dark mode or if users expect system-wide theme adherence. Relying on a future global system without explicit integration now risks the chat component being overlooked or requiring a more complex retrofit later. |

## Consequences

**Positive:**
- Significantly improved user experience and accessibility of the AI Chat on mobile devices.
- Achieved visual consistency and integration of the AI Chat with potential global dark mode themes.
- Eliminated critical UI/UX bugs related to layout and overflow on smaller screens.

**Trade-offs:**
- Increased complexity in the `Chatbot.tsx` component's styling due to the addition of responsive and dark mode-specific Tailwind CSS classes.
- Requires careful consideration during future UI updates to ensure continued responsiveness and dark mode compatibility.

## Related Issues & PRs

- PR #941: Bug/responsive chat and dark mode
- Issue #820