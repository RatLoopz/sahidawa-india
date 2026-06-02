# ADR — Fix/#767-i18n missing translation about us

> **Date:** 2026-05-31 | **PR:** #934 | **Status:** Accepted

## Context

The "About Us" page in the `apps/web` frontend lacked multilingual support, presenting content only in the default language (English). This limited accessibility and user experience for SahiDawa's target global audience, particularly within India's diverse linguistic landscape, hindering non-English speaking users from fully understanding the platform's mission and features.

## Decision

Multilingual support was implemented for the "About Us" page using the `next-intl` library. This decision involved:

1.  Creating a new `about` object within `apps/web/messages/en.json` to define structured JSON translation keys.
2.  Populating corresponding translation keys and text values across all supported locale JSON files (e.g., `bn.json`, `hi.json`, `ta.json`, etc.) located under `apps/web/messages/`.
3.  Integrating the `useTranslations` hook from `next-intl` into `apps/web/app/[locale]/about/page.tsx`.
4.  Replacing all static text on the "About Us" page with dynamic translation calls using `t("key_name")`, including rich text formatting for specific elements.

## Alternatives Considered

| Alternative | Why Rejected  
| Server-side translation (e.g., dedicated API or proxy) | Introduces additional latency for content delivery, adds complexity to the backend, and is less suitable for static content like an "About Us" page compared to client-side rendering with pre-loaded translations.  
| Server-side translation (e.g., dedicated API or proxy) | Introduces additional latency for content delivery, adds complexity to the backend, and is less suitable for static content like an "About Us" page compared to client-side rendering with pre-loaded translations. |
| Server-side translation (e.g., dedicated API or proxy) | Introduces additional latency for content delivery, adds complexity to the backend, and is less suitable for static content like an "About Us" page compared to client-side rendering with pre-loaded translations. |
| Server-side translation (e.g., dedicated API or proxy) | Introduces additional latency for content delivery, adds complexity to the backend, and is less suitable for static content like an "About Us" page compared to client-side rendering with pre-loaded translations. |
| Server-side translation (e.g., dedicated API or proxy) | Introduces additional latency for content delivery, adds complexity to the backend, and is less suitable for static content like an "About Us" page compared to client-side rendering with pre-loaded translations. |
| Server-side translation (e. |
| Server-side translation (e.g., dedicated API or proxy) | Introduces additional latency for content delivery, adds complexity to the backend, and is less suitable for static content like an "About Us" page compared to client-side rendering with pre-loaded translations. |
| Server-side translation (e.g., dedicated API or proxy) | Introduces additional latency for content delivery, adds complexity to the backend, and is less suitable for static content like an "About Us" page compared to client-side rendering with pre-loaded translations. |
| Server-side translation (e.g., dedicated API or proxy) | Introduces additional latency for content delivery, adds complexity to the backend, and is less suitable for static content like an "About Us" page compared to client-side rendering with pre-loaded translations. |
| Server-side translation (e.g., dedicated API or proxy) | Introduces additional latency for content delivery, adds complexity to the backend, and is less suitable for static content like an "About Us" page compared to client-side rendering with pre-loaded translations. |
| Server-side translation (e.g., dedicated API or proxy) | Introduces additional latency for content delivery, adds complexity to the backend, and is less suitable for static content like an "About Us" page compared to client-side rendering with pre-loaded translations. |
| Server-side translation (e. |
| Server-side translation (e.g., dedicated API or proxy) | Introduces additional latency for content delivery, adds complexity to the backend, and is less suitable for static content like an "About Us" page compared to client-side rendering with pre-loaded translations. |
| Server-side translation (e.g., dedicated API or proxy) | Introduces additional latency for content delivery, adds complexity to the backend, and is less suitable for static content like an "About Us" page compared to client-side rendering with pre-loaded translations. |
| Server-side translation (e.g., dedicated API or proxy) | Introduces additional latency for content delivery, adds complexity to the backend, and is less suitable for static content like an "About Us" page compared to client-side rendering with pre-loaded translations. |
| Server-side translation (e.g., dedicated |
| Server-side translation (e.
