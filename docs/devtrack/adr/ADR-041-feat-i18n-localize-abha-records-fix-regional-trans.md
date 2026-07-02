# ADR — feat(i18n): localize ABHA Records & fix regional translation JSON structures

> **Date:** 2026-07-02 | **PR:** #2991 | **Status:** Accepted

## Context

SahiDawa is a rural health platform in India that requires comprehensive localization across 19 regional languages to ensure accessibility. The ABHA (Ayushman Bharat Digital Health Account) Records page (`apps/web/app/[locale]/abha-records/page.tsx`) contained hardcoded English strings, preventing non-English speaking users from navigating their digital health records. 

Additionally, several regional translation JSON files in `apps/web/messages/` contained syntax errors (specifically, missing closing braces and commas before the `"NotFound"` and `"Settings"` blocks). These syntax errors caused upstream parsing failures and threatened build stability.

## Decision

We localized the ABHA Records page and repaired the broken translation structures by:
1. **Implementing `next-intl` on the ABHA Records Page:** Extracted all hardcoded UI strings (page title, back links, loading states, empty states, and errors) and wrapped them using the `useTranslations` hook with a new `"AbhaRecords"` namespace.
2. **Synchronizing Regional Translation Files:** Added the `"AbhaRecords"` namespace and its corresponding localized keys to all 19 regional language JSON files.
3. **Fixing Upstream JSON Syntax Errors:** Resolved the malformed JSON structures by inserting the missing closing braces and commas before the `"NotFound"` and `"Settings"` blocks across the affected regional translation files.
4. **Validating via Automated Scripting:** Integrated a Node.js-based JSON parsing validation step to ensure all 19 translation files are syntactically valid before production builds.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Dynamic Runtime Translation (e.g., Bhashini or Google Translate API)** | Rejected due to network latency, API costs, and the risk of inaccurate machine translations for critical medical and health record terminology. |
| **Component-Level Inline Translation Dictionaries** | Rejected because it bypasses the centralized `next-intl` structure, leading to code duplication and making it difficult for external translators to manage localization assets. |

## Consequences

**Positive:**
- **Improved Accessibility:** Users can now access and manage their ABHA records in 19 regional Indian languages.
- **Build Stability:** Fixed syntax errors in the translation files, preventing compilation failures during production builds (`next build`).
- **Centralized Schema:** Maintained a clean, unified translation schema across all supported locales.

**Trade-offs:**
- **Maintenance Overhead:** Any future UI changes to the ABHA Records page will require updating and translating keys across 19 separate JSON files, increasing the risk of translation drift if not automated.

## Related Issues & PRs

- PR #2991: feat(i18n): localize ABHA Records & fix regional translation JSON structures
- Issue #2907