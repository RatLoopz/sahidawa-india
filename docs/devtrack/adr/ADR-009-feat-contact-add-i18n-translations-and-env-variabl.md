# ADR — feat(contact): add i18n translations and env variable for contact email

> **Date:** 2026-05-24 | **PR:** #539 | **Status:** Accepted

## Context

The existing contact page contained hardcoded text in English and a hardcoded administrative email address. This limited the platform's reach and usability for a diverse Indian audience and made deployment-specific configuration cumbersome. Additionally, the user experience for interacting with contact options was suboptimal, requiring users to click small buttons rather than intuitive card areas.

## Decision

The contact page was refactored to support internationalization (i18n) and externalize the contact email configuration.

1.  **Internationalization**: The `next-intl` library was integrated to manage translations for all static text on the contact page. Translation keys were added for English (en), Hindi (hi), Bengali (bn), Marathi (mr), Tamil (ta), and Telugu (te). The `useTranslations` hook was implemented to fetch locale-specific strings.
2.  **Configurable Contact Email**: The hardcoded `[ADMIN_EMAIL]` was replaced with `process.env.NEXT_PUBLIC_CONTACT_EMAIL`. A fallback value of `contact@sahidawa.in` was provided for environments where the variable is not set.
3.  **Enhanced Clickability**: Contact cards were refactored to wrap the entire card content within an `<a>` tag, making the entire card area clickable for improved user experience and accessibility.

## Alternatives Considered

| Alternative                                                          | Why Rejected                                                                                                                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use `react-i18next` or similar library for i18n                      | `next-intl` was chosen for its deeper integration with Next.js App Router, server components, and locale-based routing, which aligns better with the project's framework.                         |
| Store contact email in a static configuration file                   | A static configuration file would still require a rebuild or code modification for environment-specific changes, unlike an environment variable which can be set at runtime without code changes. |
| Implement `onClick` handlers on `div` elements for card clickability | Using semantic `<a>` tags for navigation is more accessible, performant, and semantically correct than programmatic navigation via `onClick` on non-link elements.                                |

## Consequences

**Positive:**

- **Improved Accessibility & Reach**: The platform is now accessible to a wider linguistic audience, enhancing user engagement across India.
- **Simplified Deployment**: The contact email can be configured via environment variables, streamlining deployment to different environments (e.g., staging, production) without code changes.
- **Enhanced User Experience**: Making entire contact cards clickable improves usability and intuitiveness for users.
- **Maintainability**: Centralized translation files and environment variables reduce hardcoding, making future updates easier.

**Trade-offs:**

- **Increased Bundle Size**: The addition of the `next-intl` library and translation files slightly increases the application's client-side bundle size.
- **Translation Management Overhead**: Requires ongoing management and maintenance of translation files for new features and supported languages.
- **Environment Variable Dependency**: Deployments now require explicit configuration of `NEXT_PUBLIC_CONTACT_EMAIL`.

## Related Issues & PRs

- PR #539: feat(contact): add i18n translations and env variable for contact email
