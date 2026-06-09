# ADR — feat: add home navigation to chat interface

> **Date:** 2026-06-08 | **PR:** #1510 | **Status:** Accepted

## Context

The SahiDawa platform's chat interfaces, including the dedicated health chat UI and the floating chatbot panel, lacked a direct and consistent mechanism for users to navigate back to the application's home page. Users engaged in chat sessions were required to rely on browser back functionality or navigate through other menu items, leading to an inconsistent and potentially inefficient user experience. This absence of a clear "home" entry point could hinder user flow and platform exploration.

## Decision

A comprehensive approach was implemented to integrate home navigation across key user interfaces. This decision involved three specific changes:
1.  The "SahiDawa" title within the `ChatUI.tsx` header was made clickable, redirecting users to the application's home page.
2.  A dedicated "Home" button, represented by a house icon and text label, was added to the desktop `Navbar.tsx`.
3.  A "Home" icon button was incorporated into the header of the floating `Chatbot.tsx` panel, positioned alongside the close button.
These modifications ensure multiple, intuitive access points to the home page from within and around the chat interfaces, utilizing standard UI patterns for navigation.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Rely solely on existing navigation or browser back functionality | This was the status quo and was deemed insufficient due to its inconsistency and lack of directness, leading to a suboptimal user experience. |
| Implement a single, global "Home" button/link in a fixed, universal position (e.g., always top-left logo) | While centralizing navigation, this approach would not provide context-specific access points within the chat interfaces, potentially requiring users to look outside their immediate focus area. It also wouldn't address the desire for the main chat UI title to be a home link. |
| Add "Back to Dashboard" or "Exit Chat" buttons instead of "Home" | These options might not consistently lead to the *home* page specifically and could imply different navigational contexts (e.g., returning to a previous view rather than the primary entry point). "Home" is a more universally understood and direct concept for returning to the application's root. |

## Consequences

**Positive:**
-   Significantly improved user experience by providing clear, consistent, and easily accessible navigation back to the home page from all chat interfaces.
-   Reduced cognitive load for users by eliminating the need to search for alternative navigation methods or rely on browser history.
-   Enhanced adherence to common UI/UX patterns, where application titles/logos and dedicated home buttons serve as primary navigation anchors.
-   Increased user efficiency by allowing quick context switching between chat and other platform features.

**Trade-offs:**
-   Slight increase in UI complexity due to the addition of new navigation elements in multiple locations.
-   Minor increase in bundle size due to the inclusion of new icons and routing logic in additional components.

## Related Issues & PRs

-   PR #1510: feat: add home navigation to chat interface
-   Issue #977