# ADR — fix(web): enable Kannada and Punjabi locales

> **Date:** 2026-05-27 | **PR:** #773 | **Status:** Accepted

## Context

The SahiDawa web application had existing translation message files for Kannada (`kn`) and Punjabi (`pa`), but these locales were not fully integrated into the application's internationalization (i18n) system. Specifically, users could not select these languages via the in-app language switcher, direct URL routing (e.g., `/kn`), or receive localized responses from the chat API for Punjabi. This represented a functional bug preventing users from accessing the platform in these languages despite the translation assets being available.

## Decision

The web application was updated to fully enable Kannada (`kn`) and Punjabi (`pa`) locales. This involved:
- Modifying the `next-intl` routing configuration to include `kn` and `pa` in the list of supported locales.
- Updating the `LanguageSwitcher` component to display Kannada (`ಕನ್ನಡ`) and Punjabi (`ਪੰਜਾਬੀ`) as selectable options.
- Adjusting the application's proxy matcher to correctly handle direct URL access for `/kn` and `/pa` routes.
- Extending the chat API's `supportedLocales` and `localeMap` to include Punjabi (`pa`), ensuring AI responses can be localized.
- Adding a new Jest regression test to validate the correct behavior of routing, proxy matching, and language switcher labels for the newly enabled locales.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Implement partial support (e.g., UI only, no chat API)** | Rejected as it would lead to an inconsistent user experience where the UI is translated but core functionalities like the AI chat are not, diminishing the value of multi-language support. |
| **Delay implementation until all message files are fully complete and reviewed** | Rejected to prioritize immediate user access to available translations. The current approach allows for incremental improvement of translation quality while providing basic functionality. |
| **Use client-side only language detection/switching without URL routing** | Rejected as it would not leverage `next-intl`'s server-side rendering (SSR) capabilities for locale-specific content, potentially impacting SEO and initial page load performance for translated content. |

## Consequences

**Positive:**
- Expanded accessibility for Kannada and Punjabi speaking users, improving user experience and platform reach.
- Enhanced consistency across the application by integrating existing translation assets into the UI, routing, and chat API.
- Improved test coverage with new regression tests for i18n routing and locale handling.
- Aligns with SahiDawa's mission to serve diverse linguistic communities in India.

**Trade-offs:**
- Increased complexity in i18n configuration and routing logic due to additional locales.
- Ongoing maintenance for new locales, including ensuring translation quality and completeness for all features.

## Related Issues & PRs

- PR #773: fix(web): enable Kannada and Punjabi locales
- Issue #755: Enable Kannada and Punjabi locales in web app