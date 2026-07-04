# ADR — fix: add missing translation keys for vaccine section

> **Date:** 2024-06-21 | **PR:** #2219 | **Status:** Accepted

## Context

The SahiDawa platform, designed to support multiple Indian languages, featured a "Vaccine section" in its user interface. However, critical UI elements within this section were displaying raw translation keys (e.g., `Home.vaccine_title`) instead of localized text. This indicated that the necessary translation entries were absent from the platform's locale files, leading to a broken user experience and undermining the platform's multi-language capabilities for this specific feature.

## Decision

The decision was to directly add the missing translation keys (`vaccine_title`, `vaccine_subtitle`, `vaccine_open`) and their corresponding localized strings to all affected locale JSON files (`apps/web/messages/*.json`). This approach directly resolved the display issue by providing the required translations for the "Vaccine section" across all supported languages, ensuring the UI renders correctly.

## Alternatives Considered

| Alternative                                                                                 | Why Rejected                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Implement a fallback mechanism for missing keys                                             | While a fallback to a default language (e.g., English) could prevent raw keys from being displayed, it would result in an inconsistent user experience for non-default language users, requiring them to see content in a language they might not understand. It would also not fully address the requirement for the "Vaccine section" to be fully localized from the outset. |
| Hardcode the vaccine section text in a default language directly into the UI components     | This would violate the principle of internationalization (i18n) and make future localization efforts significantly harder, requiring code changes for every language addition or update. It would also lead to a poor user experience for non-English speakers.                                                                                                                |
| Defer the launch or visibility of the "Vaccine section" until all translations are complete | This would delay the availability of a potentially critical feature for users. The immediate need was to fix the existing display issue, not to block the feature entirely. This was also considered a project management decision rather than a technical resolution for the missing keys.                                                                                    |

## Consequences

**Positive:**

- Resolved a critical UI bug where raw translation keys were displayed, improving user experience.
- Ensured consistent and localized content for the "Vaccine section" across all supported Indian languages.
- Maintained the platform's commitment to multi-language support and accessibility for its diverse user base.

**Trade-offs:**

- Increased the number of locale files requiring manual updates for new UI text.
- Introduced a manual process for adding new translation keys, which is prone to human error (e.g., forgetting a language, typos) and requires careful review.
- Slightly increased the application's bundle size due to additional translation strings in each locale file.

## Related Issues & PRs

- PR #2219: fix: add missing translation keys for vaccine section
- Issue #2172
