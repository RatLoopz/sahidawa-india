# ADR — fix: localize alerts log and compare grid

> **Date:** 2026-06-04 | **PR:** #1237 | **Status:** Accepted

## Context

The SahiDawa platform, designed for a diverse Indian audience, required its user interface to be accessible in multiple regional languages. Specifically, the "CDSCO Alerts Log" page and the "Comparison Grid" functionality contained hardcoded English strings, hindering usability and inclusivity for non-English speaking users and limiting the platform's reach.

## Decision

The `next-intl` library was adopted to implement localization for the CDSCO Alerts Log page and the Comparison Grid. This involved:

1.  Integrating `useTranslations` hooks into `apps/web/app/[locale]/alerts/page.tsx`, `apps/web/app/[locale]/compare/page.tsx`, and `apps/web/src/components/ComparisonGrid.tsx`.
2.  Establishing dedicated message namespaces, `Alerts` and `Compare`, within the `messages/*.json` locale bundles.
3.  Replacing all hardcoded UI strings on these pages and components with corresponding translation keys (e.g., `t("backHome")`, `t("title")`).
4.  Ensuring all 14 supported locale bundles (`bn.json`, `en.json`, `gu.json`, `hi.json`, `kn.json`, `ks.json`, `ml.json`, `mr.json`, `or.json`, `pa.json`, `sa.json`, `ta.json`, `te.json`, `ur.json`) contained the new translation keys, including fallback keys to prevent lookup failures.

## Alternatives Considered

| Alternative                                                                        | Why Rejected                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Client-side-only translation library (e.g., `i18next` without Next.js integration) | Would result in poorer SEO due to lack of server-side rendering of translated content and potential flash of untranslated content (FOUC) on initial load. `next-intl` integrates with Next.js SSR for better performance and SEO.                            |
| Manual string management without a dedicated library                               | Would introduce significant boilerplate, increase the risk of missing translations or key mismatches, and lack built-in features like pluralization, formatting, and namespace management, making maintenance and scalability challenging across 14 locales. |
| Using a single global message namespace                                            | Would lead to a flat, unorganized structure in JSON files, increasing the likelihood of key collisions and complicating management and delegation of translation tasks for specific application sections. Dedicated namespaces provide better modularity.    |

## Consequences

**Positive:**

- Enabled full localization of the CDSCO Alerts Log page and the Comparison Grid across 14 Indian languages, significantly improving accessibility and user experience.
- Established a clear, modular pattern for future localization efforts using `next-intl` namespaces, promoting consistency and maintainability.
- Reduced the likelihood of untranslated strings appearing in critical user-facing sections due to comprehensive key coverage and fallback mechanisms.

**Trade-offs:**

- Increased bundle size due to the inclusion of the `next-intl` library and all 14 locale bundles.
- Added complexity to the development workflow, requiring developers to manage translation keys and ensure their presence across multiple JSON files for every new localized string.
- Introduced a dependency on `next-intl` and its ecosystem, requiring developers to learn and adhere to its conventions.

## Related Issues & PRs

- PR #1237: fix: localize alerts log and compare grid
- Issue #1201
