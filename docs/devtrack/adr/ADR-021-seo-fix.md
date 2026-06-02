# ADR — SEO-FIX

> **Date:** 2026-06-02 | **PR:** #1125 | **Status:** Accepted

## Context

The SahiDawa web platform experienced significant search engine optimization (SEO) deficiencies, resulting in poor discoverability and international indexing. Lighthouse audits identified critical failures, including the use of an invalid ISO 639-1 language code (`od` for Odia), absence of a `robots.txt` file, lack of an XML sitemap, and missing `hreflang` alternate tags for multilingual content. These issues collectively hindered the platform's ability to reach its target audience effectively and provide a robust user experience for non-English speakers.

## Decision

A comprehensive SEO overhaul was implemented on the `apps/web` Next.js frontend. This involved:
1.  **Language Code Correction:** The invalid `od` locale code for Odia was replaced with the ISO 639-1 compliant `or` across all relevant frontend components, routing configurations, API endpoints, and translation files.
2.  **Dynamic `robots.txt` Implementation:** A dynamic `robots.txt` file was generated using Next.js MetadataRoute API, including essential crawler directives and a reference to the sitemap.
3.  **XML Sitemap Generation:** An automatic XML sitemap was generated to cover all approximately 130 localized routes, incorporating route priorities and supporting multilingual indexing.
4.  **`hreflang` Alternate Tag Integration:** The `app/[locale]/layout.tsx` metadata was converted to `generateMetadata()` to dynamically include `hreflang` alternate tags for all supported locales, alongside a proper canonical URL structure, enhancing international search engine indexing.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Manual `robots.txt` and Sitemap Files | Manually creating and maintaining `robots.txt` and `sitemap.xml` files would introduce significant overhead, especially with a growing number of localized routes (~130). This approach would be prone to errors, difficult to scale, and require manual updates for every new page or language, contradicting the goal of efficient, maintainable SEO. |
| Third-party SEO Plugin/Service | Integrating a third-party SEO plugin or service could offer quicker initial setup but might introduce external dependencies, increase bundle size, incur subscription costs, and potentially limit customization for specific Indian language requirements. The chosen approach leverages Next.js's built-in capabilities, providing a more integrated and cost-effective solution. |
| Partial SEO Fixes (e.g., only language code) | Addressing only the most critical issues, like the language code, would have provided marginal improvement but would not have resolved the fundamental structural SEO problems. The absence of a sitemap, `robots.txt`, and `hreflang` tags would still leave the platform poorly indexed and discoverable, failing to achieve a high Lighthouse SEO score and comprehensive internationalization. |

## Consequences

**Positive:**
-   Significantly improved search engine discoverability and indexing for SahiDawa, reflected in a Lighthouse SEO score increase from 50-60 to 85-95.
-   Enhanced multilingual SEO support through correct ISO language codes and `hreflang` alternate tags, facilitating better international search engine indexing for all supported Indian languages.
-   Improved adherence to web standards with a valid `robots.txt` and comprehensive XML sitemap, providing clear directives to search engine crawlers.
-   Reduced manual maintenance for SEO-related files due to dynamic generation of `robots.txt` and sitemap.

**Trade-offs:**
-   Increased complexity in the `app/[locale]/layout.tsx` file due to the conversion to `generateMetadata()` for dynamic `hreflang` tag generation.
-   Minor increase in build time due to the dynamic generation logic for sitemap and metadata.

## Related Issues & PRs

- PR #1125: SEO-FIX