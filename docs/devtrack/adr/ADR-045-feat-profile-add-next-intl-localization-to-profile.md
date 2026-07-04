# ADR — feat(profile): add next-intl localization to profile page

> **Date:** 2026-07-04 | **PR:** #3089 | **Status:** Accepted

## Context

SahiDawa is an open-source medicine verification and rural health platform targeting a linguistically diverse user base across India. To ensure accessibility, the application must support regional languages. The profile page (`apps/web/app/[locale]/profile/page.tsx`) contained hardcoded English strings. Additionally, the token-parsing utility `readSessionFromToken` returned a hardcoded fallback string (`'Signed-in User'`). Because this utility runs outside the React component lifecycle, it could not access the localization context, preventing proper translation of fallback states.

## Decision

We integrated `next-intl` localization into the profile page and refactored the session-reading utility to support multi-locale fallbacks. 

Specifically, we:
1. Introduced the `useTranslations('Profile')` hook to the `ProfilePage` component.
2. Extracted all hardcoded UI strings (including page titles, subtitles, status messages, and error states) into a dedicated `Profile` namespace.
3. Added corresponding translation keys to all 19 regional Indian language locale files located in `apps/web/messages/`.
4. Refactored `readSessionFromToken` to return `null` instead of the hardcoded `'Signed-in User'` string when metadata is missing. This shifted the responsibility of fallback string resolution to the UI layer, where the localized `t("signedInUser")` token can be evaluated.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Dynamic Client-Side Translation API** | Relying on runtime translation APIs would introduce latency, increase operational costs, and fail in offline or low-connectivity rural environments. |
| **Passing Locale/Translation Functions to Utilities** | Passing the translation function `t` or the active locale directly into `readSessionFromToken` would tightly couple pure token-parsing logic with UI-layer localization concerns. |
| **Ad-hoc Custom Context Provider** | Implementing a custom translation context would reinvent features already optimized and provided out-of-the-box by `next-intl` within the Next.js App Router framework. |

## Consequences

**Positive:**
- **Linguistic Accessibility:** The profile page is now fully localized across 19 Indian languages, supporting rural deployment.
- **Separation of Concerns:** Utility functions remain pure and free of UI-specific fallback strings, returning `null` to let the rendering layer handle presentation.
- **Architectural Consistency:** Aligns the profile page with the project's established `next-intl` routing and namespacing patterns.

**Trade-offs:**
- **Maintenance Overhead:** Any future copy changes to the profile page now require updates across 19 separate JSON translation files.
- **Bundle Size:** Incremental increase in the static translation payload size across all supported locales.

## Related Issues & PRs

- PR #3089: feat(profile): add next-intl localization to profile page
- Issue #2906