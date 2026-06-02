# PR #1125 — SEO-FIX

> **Merged:** 2026-06-02 | **Author:** @Aryan-Agarwal-creator | **Area:** Frontend | **Impact Score:** 34

## What Changed

This pull request significantly enhances the SahiDawa frontend's Search Engine Optimization (SEO) by addressing several Lighthouse audit failures. We corrected an invalid ISO language code for Odia, implemented dynamic `robots.txt` and XML sitemap generation using Next.js MetadataRoute API, and added proper `hreflang` alternate tags to improve multilingual indexing and discoverability.

## The Problem Being Solved

Before this PR, our `apps/web` frontend suffered from several critical SEO deficiencies that negatively impacted our search engine discoverability and internationalization efforts. Specifically:
1.  **Invalid Language Code**: We were using `od` for Odia, which is not a recognized ISO 639-1 language code. This caused Lighthouse SEO audits to fail and could lead to incorrect language targeting by search engines.
2.  **Missing `robots.txt`**: The absence of a `robots.txt` file meant we had no control over how search engine crawlers indexed our site, potentially leading to inefficient crawling or indexing of undesirable paths.
3.  **Missing XML Sitemap**: Without an `sitemap.xml`, search engines had to discover our pages organically, which is less efficient, especially for new or deep links. This also hindered proper indexing of our localized content.
4.  **Lack of `hreflang` Alternates**: Our multilingual pages lacked `hreflang` alternate tags, which are crucial for informing search engines about equivalent content in different languages. This resulted in poor international SEO and potential duplicate content issues across locales.
These issues collectively contributed to a low Lighthouse SEO score (50-60) and hindered our platform's reach to users searching in various Indian languages.

## Files Modified

-   `apps/web/app/[locale]/LanguageSwitcher.tsx`
-   `apps/web/app/[locale]/layout.tsx`
-   `apps/web/app/api/chat/route.ts`
-   `apps/web/app/robots.ts` (New File)
-   `apps/web/app/sitemap.ts` (New File)
-   `apps/web/i18n/routing.ts`
-   `apps/web/messages/or.json` (Renamed from `od.json`)
-   `apps/web/proxy.ts`
-   `package-lock.json`

## Implementation Details

We implemented a comprehensive set of changes to resolve the identified SEO issues:

1.  **Invalid Language Code Fix (`od` to `or`)**:
    *   The incorrect ISO 639-1 language code `od` for Odia was globally replaced with the correct code `or`.
    *   In `apps/web/app/[locale]/LanguageSwitcher.tsx`, the `languages` array was updated to reflect `{ code: "or", label: "Odia", native: "ଓଡ଼ିଆ" }`.
    *   The `supportedLocales` array and `localeMap` object within `apps/web/app/api/chat/route.ts` were updated from `od` to `or` to ensure our chat API correctly handles Odia.
    *   The `locales` array in `apps/web/i18n/routing.ts`, which defines our internationalization routing, was updated from `od` to `or`.
    *   The translation file `apps/web/messages/od.json` was renamed to `apps/web/messages/or.json` to match the new language code.
    *   The `matcher` regex in `apps/web/proxy.ts` was updated to include `or` instead of `od` for internationalized pathnames, ensuring correct routing for Odia.

2.  **Dynamic `robots.txt` Generation**:
    *   A new file, `apps/web/app/robots.ts`, was created to leverage Next.js's MetadataRoute API for dynamic `robots.txt` generation.
    *   The `robots()` function exports a `MetadataRoute.Robots` object.
    *   It defines `rules` for `userAgent: "*"` allowing all crawlers (`allow: "/"`) but disallowing access to the `/admin` path (`disallow: "/admin"`).
    *   Crucially, it includes a `sitemap` directive pointing to `https://sahidawa.in/sitemap.xml`, instructing crawlers where to find our sitemap.
    *   Next.js automatically prerenders this file as `robots.txt` at the root of our domain.

3.  **XML Sitemap Generation**:
    *   A new file, `apps/web/app/sitemap.ts`, was created, also utilizing Next.js's MetadataRoute API for dynamic sitemap generation.
    *   The `sitemap()` function exports a `MetadataRoute.Sitemap` array.
    *   It imports `routing.locales` from `@/i18n/routing` to get all supported language codes.
    *   A `baseUrl` constant (`https://sahidawa.in`) is defined.
    *   We defined a `routes` array containing all primary non-locale-specific paths (e.g., `""` for home, `/about`, `/scan`, etc.).
    *   The implementation iterates through each `locale` and then through each `route`, constructing the full localized URL.
    *   For the default locale (`routing.defaultLocale`), the URL is `baseUrl + route`. For other locales, it's `baseUrl + '/' + locale + route`.
    *   Each entry in `sitemapEntries` includes `url`, `changeFrequency: "weekly"`, `priority` (1 for home, 0.8 for others), and `lastModified` set to the current date.
    *   This dynamic generation ensures all ~130 localized URLs are included and kept up-to-date.

4.  **`hreflang` Alternate Tags**:
    *   The static `export const metadata: Metadata` object in `apps/web/app/[locale]/layout.tsx` was converted into an `export async function generateMetadata()` function. This allows us to dynamically generate metadata based on the current `locale` parameter.
    *   Inside `generateMetadata()`, we retrieve the `locale` from `params`.
    *   We construct an `alternates` object. The `languages` property is populated by mapping over `routing.locales`. For each language, we generate a URL (`${baseUrl}/${lang}`) which correctly points to the localized version of the current page.
    *   An `x-default` entry is explicitly added to `alternates.languages` pointing to the `baseUrl` (our default locale URL) to handle users whose language is not explicitly listed.
    *   This `alternates` object is then included in the returned `Metadata` object, ensuring that `hreflang` tags are correctly rendered in the HTML `<head>` for every localized page.

5.  **`package-lock.json` Updates**:
    *   The `package-lock.json` file was updated. The specific changes involve the removal of the `"peer": true` flag from several dependency entries (e.g., `ajv`, `babel-jest`, `@redis/client`, `@supabase/supabase-js`, `@types/node`, `@typescript-eslint/eslint-plugin`, `@upstash/redis`, `@zxing/library`). The exact reason for these `peer: true` flag removals is not documented in this PR, but it typically indicates changes in how npm resolves or records dependency types, possibly due to an npm version upgrade or a change in the dependency's own `package.json` definition.

## Technical Decisions

1.  **Next.js MetadataRoute API for `robots.txt` and `sitemap.xml`**: We chose Next.js's built-in MetadataRoute API (`app/robots.ts`, `app/sitemap.ts`) because it provides a first-party, integrated, and efficient way to generate these critical SEO files. This approach is dynamic, allowing us to programmatically define rules and routes, which is ideal for our internationalized application. It avoids the need for external libraries or manual file management, simplifying deployment and maintenance.
2.  **`generateMetadata()` for `hreflang`**: Converting `metadata` to `generateMetadata()` in `app/[locale]/layout.tsx` was essential because `hreflang` tags are locale-dependent. `generateMetadata()` allows us to access the current `locale` from the `params` object, enabling dynamic generation of the `alternates` object with correct URLs for each language. This ensures that every page correctly advertises its localized counterparts to search engines.
3.  **ISO 639-1 Compliance**: The decision to fix the `od` to `or` language code was driven by the need for strict adherence to web standards (ISO 639-1). Non-standard language codes confuse search engines and can lead to misinterpretation of content language, hindering proper indexing and ranking. This fix directly addresses a Lighthouse SEO audit failure.
4.  **Canonical URL Structure**: By generating `hreflang` tags and ensuring correct localized URLs, we implicitly reinforce a proper canonical URL structure, helping search engines understand the primary version of content and avoid duplicate content penalties.

## How To Re-Implement (Contributor Reference)

To re-implement or extend these SEO features, a contributor would follow these steps:

1.  **Correcting Invalid Language Codes**:
    *   **Identify**: Use tools like Lighthouse or W3C validators to identify non-ISO 639-1 language codes.
    *   **Update `LanguageSwitcher`**: In `apps/web/app/[locale]/LanguageSwitcher.tsx`, update the `code` property in the `languages` array to the correct ISO code.
    *   **Update API Endpoints**: In `apps/web/app/api/chat/route.ts` (or similar API routes), update any `supportedLocales` arrays or `localeMap` objects to use the correct code.
    *   **Update i18n Routing**: Modify `apps/web/i18n/routing.ts` to update the `locales` array with the correct code.
    *   **Rename Translation Files**: Rename the corresponding translation file (e.g., `messages/od.json` to `messages/or.json`).
    *   **Update Proxy Matcher**: In `apps/web/proxy.ts`, update the `matcher` regex to include the new language code.

2.  **Implementing `robots.txt`**:
    *   **Create File**: Create `apps/web/app/robots.ts`.
    *   **Define `robots` function**:
        ```typescript
        import type { MetadataRoute } from "next";

        export default function robots(): MetadataRoute.Robots {
            return {
                rules: [
                    {
                        userAgent: "*",
                        allow: "/",
                        disallow: "/admin", // Example: disallow admin paths
                    },
                ],
                sitemap: "https://yourdomain.com/sitemap.xml", // Reference your sitemap
            };
        }
        ```
    *   **Customize Rules**: Adjust `allow` and `disallow` directives as needed for specific paths.

3.  **Implementing XML Sitemap Generation**:
    *   **Create File**: Create `apps/web/app/sitemap.ts`.
    *   **Import Dependencies**: `import type { MetadataRoute } from "next";` and `import { routing } from "@/i18n/routing";`.
    *   **Define `sitemap` function**:
        ```typescript
        import type { MetadataRoute } from "next";
        import { routing } from "@/i18n/routing";

        export default function sitemap(): MetadataRoute.Sitemap {
            const locales = routing.locales;
            const baseUrl = "https://sahidawa.in"; // Your base URL

            const routes = [
                "", // Home page
                "/about",
                "/contact",
                // Add all other primary routes here
            ];

            const sitemapEntries: MetadataRoute.Sitemap = [];

            locales.forEach((locale) => {
                routes.forEach((route) => {
                    const url =
                        locale === routing.defaultLocale
                            ? `${baseUrl}${route || "/"}`
                            : `${baseUrl}/${locale}${route || ""}`;

                    sitemapEntries.push({
                        url,
                        changeFrequency: "weekly", // Or "daily", "monthly"
                        priority: route === "" ? 1 : 0.8, // Adjust priority as needed
                        lastModified: new Date().toISOString(),
                    });
                });
            });

            return sitemapEntries;
        }
        ```
    *   **Maintain `routes`**: Ensure the `routes` array is kept up-to-date with all public pages.

4.  **Adding `hreflang` Alternate Tags**:
    *   **Convert `metadata` to `generateMetadata`**: In `apps/web/app/[locale]/layout.tsx`, change `export const metadata: Metadata = { ... }` to `export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> { ... }`.
    *   **Access Locale**: Destructure `locale` from `params`.
    *   **Construct `alternates` Object**:
        ```typescript
        import { routing } from "@/i18n/routing"; // Ensure routing is imported

        const baseUrl = "https://sahidawa.in"; // Your base URL

        const alternates = {
            languages: Object.fromEntries(
                routing.locales.map((lang) => [
                    lang,
                    `${baseUrl}/${lang}`, // Construct URL for each locale
                ])
            ),
        };
        // Add x-default for users whose language is not explicitly listed
        (alternates.languages as Record<string, string>)["x-default"] = baseUrl;

        return {
            // ... existing metadata properties
            alternates,
        };
        ```
    *   **Ensure `baseUrl` is correct**: This should be your production domain.

## Impact on System Architecture

This PR significantly strengthens the SahiDawa frontend's foundation for internationalization and web presence.
1.  **Improved Discoverability**: By providing `robots.txt` and `sitemap.xml`, we explicitly guide search engines, leading to more efficient crawling and better indexing of our content across all supported languages.
2.  **Enhanced Multilingual SEO**: The implementation of `hreflang` tags ensures that search engines correctly understand the relationship between our localized pages, preventing duplicate content issues and serving the most appropriate language version to users based on their location and language preferences. This is crucial for our mission to serve diverse Indian communities.
3.  **Standards Compliance**: Adhering to ISO 639-1 for language codes and best practices for SEO files improves our overall web health and Lighthouse scores, signaling to search engines that SahiDawa is a well-maintained and authoritative source.
4.  **Scalability for i18n**: The dynamic nature of the sitemap and `hreflang` generation means that as we add more languages or routes, these SEO features will automatically scale without requiring manual updates to static files.
5.  **No Backend Impact**: These changes are entirely frontend-focused within the `apps/web` Next.js application, requiring no modifications to our backend services.

## Testing & Verification

We performed thorough local validation and testing to ensure the effectiveness of these SEO fixes:

1.  **Language Code Validation**: We manually verified that all instances of `od` were replaced with `or` across the codebase, specifically checking `LanguageSwitcher.tsx`, `route.ts`, `routing.ts`, and `proxy.ts`. The `messages/od.json` file was successfully renamed to `messages/or.json`.
2.  **TypeScript Compilation**: The project successfully compiled with TypeScript, indicating no type errors introduced by the changes.
3.  **`robots.txt` Verification**: We accessed `https://localhost:3000/robots.txt` locally and confirmed that the generated file contained the specified `userAgent`, `allow`, `disallow` rules, and the correct `sitemap` reference.
4.  **`sitemap.xml` Verification**: We accessed `https://localhost:3000/sitemap.xml` locally and confirmed that the generated XML file contained entries for all defined routes across all supported locales, including correct `url`, `changeFrequency`, `priority`, and `lastModified` attributes. We confirmed approximately 130 URLs were generated.
5.  **`hreflang` Tag Verification**: We inspected the HTML source of localized pages (e.g., `https://localhost:3000/en`, `https://localhost:3000/hi`) and confirmed that the `<head>` section contained the correct `<link rel="alternate" hreflang="..." href="..." />` tags for all supported locales, including the `x-default` entry.
6.  **Lighthouse Audit**: Post-implementation, local Lighthouse audits showed a significant improvement in the SEO score, moving from 50-60 to 85-95, with all previously identified SEO failures resolved.

**Edge Cases**:
*   The `sitemap.ts` currently defines a static list of `routes`. If new top-level pages are added, they must be manually added to this `routes` array to be included in the sitemap. A future enhancement could involve dynamic route discovery if the application grows significantly.
*   The `baseUrl` is hardcoded in `sitemap.ts` and `layout.tsx`. While appropriate for production, this would need to be configurable for different deployment environments (e.g., staging, development) if those environments require their own SEO indexing. For SahiDawa, our focus is primarily on the production `sahidawa.in` domain.