# PR #1154 — Feature/i18n rtl urdu kashmiri

> **Merged:** 2026-06-03 | **Author:** @panditshubham766-dotcom | **Area:** Frontend | **Impact Score:** 11 | **Closes:** #634

## What Changed

This pull request introduces comprehensive Right-to-Left (RTL) layout direction support for the SahiDawa frontend, specifically targeting Urdu (`ur`) and Kashmiri (`ks`) locales. It dynamically sets the `dir="rtl"` attribute on the root `<html>` element for these languages, scaffolds a new translation bundle for Kashmiri, and refactors existing CSS properties to use logical properties for better internationalization.

## The Problem Being Solved

Prior to this PR, the SahiDawa frontend (`apps/web`) lacked proper support for Right-to-Left (RTL) languages. When users selected languages like Urdu or Kashmiri, the UI layout would break, with text alignment, spacing, and component flow remaining Left-to-Right (LTR). This resulted in a poor and often unusable experience for native speakers of these languages, directly addressing the internationalization UI breakage outlined in issue #634. Furthermore, Kashmiri (`ks`) was not yet supported with a dedicated translation bundle, requiring a new structural translation file.

## Files Modified

- `apps/web/app/[locale]/layout.tsx`
- `apps/web/messages/ks.json`
- `apps/web/package.json`
- `package-lock.json`

## Implementation Details

The core of this change resides in the `apps/web/app/[locale]/layout.tsx` file, which serves as the root layout for our Next.js application, wrapping all locale-specific pages.

1.  **Dynamic Layout Direction Switching**:
    *   Inside `apps/web/app/[locale]/layout.tsx`, we introduced a new constant `isRtl` which checks if the currently active `locale` (obtained from the URL segment) is either `'ur'` (Urdu) or `'ks'` (Kashmiri).
    *   The `<html>` tag's `dir` attribute is now conditionally set based on this `isRtl` flag: `<html lang={locale} dir={isRtl ? 'rtl' : 'ltr'} suppressHydrationWarning>`. This ensures that the browser's rendering engine correctly applies RTL layout rules globally for the entire document when an RTL language is active.
    *   The `suppressHydrationWarning` prop is retained on the `<html>` tag to prevent potential hydration mismatches between server-rendered and client-rendered HTML, particularly useful when dynamic attributes like `dir` are involved.
    *   The `getMessages()` function is called to load the appropriate translation messages for the current locale, which are then passed to the `NextIntlClientProvider`.

2.  **Kashmiri Translation File Scaffolding**:
    *   A new translation bundle, `apps/web/messages/ks.json`, was created. This file contains a comprehensive set of key-value pairs, with the keys mirroring those found in the `en.json` (English) translation file.
    *   The values for these keys are the corresponding Kashmiri translations, ensuring that all UI strings are available in Kashmiri. This includes translations for `Home`, `Navigation`, `Scan`, `BackToTopButton`, `VoicePage`, and `offline` sections of the application.
    *   Existing Urdu translations in `ur.json` were preserved and not altered by this PR.

3.  **Tailwind CSS Configuration for RTL (Evolution)**:
    *   Initially, the PR description indicates that `tailwindcss-rtl` plugin was integrated into the Tailwind configuration. This plugin typically provides utilities like `rtl:mr-4` or `ltr:ml-4` to handle directional styling.
    *   However, subsequent commit messages indicate that this plugin was later deemed "obsolete" and dropped in favor of "native v4 engines". This implies that the final merged state leverages Tailwind CSS v4's inherent support for logical properties (e.g., `margin-inline-start`, `padding-inline-end`) directly, or that the refactoring to logical properties (see below) made the plugin redundant.
    *   Specific changes to `apps/web/package.json` and `package-lock.json` related to the addition and subsequent removal of `tailwindcss-rtl` are not documented in this PR's provided diff, but the commit history suggests this evolution.

4.  **Logical Property Refactor**:
    *   Shared presentation classes and layout modules across various components were migrated from hardcoded physical directional properties (e.g., `ml-*` for `margin-left`, `mr-*` for `margin-right`, `text-left`) to CSS Logical Properties (e.g., `ms-*` for `margin-inline-start`, `me-*` for `margin-inline-end`, `text-start`).
    *   This refactoring ensures that spacing and text alignment automatically adapt to the document's `dir` attribute (`ltr` or `rtl`) without needing explicit `rtl:` prefixes or conditional logic in component styles.
    *   Specific file changes demonstrating this refactor are not documented in this PR's provided diff, beyond the root `layout.tsx` setting the `dir` attribute.

## Technical Decisions

1.  **Dynamic `dir` Attribute on `<html>`**: We chose to apply the `dir` attribute directly to the `<html>` tag in `apps/web/app/[locale]/layout.tsx`. This is the most robust and standard way to inform the browser's rendering engine about the document's base directionality. It ensures that all inherited layout properties, text direction, and block flow are correctly interpreted for RTL languages, providing a consistent experience across the entire application.
2.  **Leveraging CSS Logical Properties**: The decision to refactor from physical CSS properties (`margin-left`, `text-align: left`) to logical properties (`margin-inline-start`, `text-align: start`) is crucial for true i18n. Logical properties abstract away physical directions, instead referring to the "start" or "end" of a block or inline flow, which automatically flips based on the `dir` attribute. This significantly reduces the complexity of maintaining separate styles for LTR and RTL layouts.
3.  **Evolution of `tailwindcss-rtl` Usage**: The initial consideration and subsequent dropping of the `tailwindcss-rtl` plugin indicate a preference for native solutions. While `tailwindcss-rtl` can simplify RTL styling, the project likely found that Tailwind CSS v4 (or its development path) offers sufficient native support for logical properties, making an external plugin redundant and potentially reducing build complexity and dependency overhead. This aligns with a philosophy of using core framework features where possible.
4.  **Structured Translation Bundles**: Creating `ks.json` by mirroring the structure of `en.json` ensures consistency in translation keys across all locales. This approach simplifies the translation management process, makes it easier to identify missing translations, and provides a clear fallback mechanism if a specific string is not translated in a given locale.

## How To Re-Implement (Contributor Reference)

To re-implement or extend this RTL and i18n functionality for a new language:

1.  **Add a New Translation File**:
    *   Create a new JSON file in `apps/web/messages/` named after the new locale's ISO 639-1 code (e.g., `hi.json` for Hindi).
    *   Copy the entire structure (all keys) from `apps/web/messages/en.json` into the new file.
    *   Populate the values with the translations for the new language. Ensure all keys have corresponding translated strings.

2.  **Configure Root Layout for RTL**:
    *   If the new language is an RTL language, modify `apps/web/app/[locale]/layout.tsx`.
    *   Update the `isRtl` array to include the new locale's code:
        ```typescript
        const isRtl = ['ur', 'ks', 'your_new_rtl_locale'].includes(locale);
        ```
    *   No further changes are needed for the `<html>` tag, as it already uses the `isRtl` variable.

3.  **Refactor Component Styles to Logical Properties**:
    *   Review existing components in `apps/web` for hardcoded physical directional CSS properties (e.g., `margin-left`, `padding-right`, `text-align: left`).
    *   Replace these with their logical property equivalents:
        *   `margin-left` -> `margin-inline-start` (or Tailwind `ms-*`)
        *   `margin-right` -> `margin-inline-end` (or Tailwind `me-*`)
        *   `padding-left` -> `padding-inline-start` (or Tailwind `ps-*`)
        *   `padding-right` -> `padding-inline-end` (or Tailwind `pe-*`)
        *   `border-left` -> `border-inline-start` (or Tailwind `border-s-*`)
        *   `border-right` -> `border-inline-end` (or Tailwind `border-e-*`)
        *   `left: 0` -> `inset-inline-start: 0` (or Tailwind `start-0`)
        *   `right: 0` -> `inset-inline-end: 0` (or Tailwind `end-0`)
        *   `text-align: left` -> `text-align: start` (or Tailwind `text-start`)
    *   Pay special attention to icons or elements that might need to be flipped horizontally in RTL contexts. This might require specific CSS transforms or conditional rendering based on the `dir` attribute (e.g., `[dir='rtl'] .icon { transform: scaleX(-1); }`).

4.  **Verify `package.json`**:
    *   Ensure that no RTL-specific Tailwind plugins (like `tailwindcss-rtl`) are present in `apps/web/package.json` if the intention is to rely on native Tailwind v4 capabilities. If a new plugin is needed for specific advanced RTL features, add it and configure it in `tailwind.config.js`.

## Impact on System Architecture

This change significantly enhances the internationalization capabilities of the SahiDawa frontend.

1.  **Improved User Experience**: It directly addresses a critical UX barrier for users of RTL languages, making the platform accessible and usable for a broader audience, particularly in regions where Urdu and Kashmiri are spoken.
2.  **Scalability for i18n**: The architectural pattern of dynamically setting the `dir` attribute and using logical properties provides a scalable foundation for adding more RTL languages in the future with minimal UI refactoring.
3.  **Frontend Consistency**: By standardizing on logical properties, we ensure a more consistent and maintainable codebase for styling, reducing the likelihood of layout bugs when new languages are introduced or existing ones are updated.
4.  **Foundation for Localization**: The addition of the Kashmiri translation bundle expands our content localization efforts, paving the way for deeper integration of local languages into all aspects of the platform.
5.  **Reduced Technical Debt**: By moving away from physical properties, we reduce the technical debt associated with managing separate LTR/RTL stylesheets or complex conditional styling logic.

## Testing & Verification

The changes were verified through manual testing, as evidenced by the provided screenshot in the PR description.

1.  **Visual Inspection**: The screenshot demonstrates the SahiDawa homepage rendered in an RTL language (likely Kashmiri, given the `ks.json` addition), showing correct text alignment (right-to-left), navigation flow, and component positioning.
2.  **Locale Switching**: The primary verification involved switching the application's locale to `ur` and `ks` and observing that the entire UI correctly adopted the RTL layout. This includes:
    *   Text flowing from right to left.
    *   Navigation items aligning to the right.
    *   Icons and interactive elements positioned appropriately for RTL.
    *   Spacing (margins, paddings) correctly applied from the inline-start/inline-end.
3.  **Translation Accuracy**: The new `ks.json` file was checked to ensure that the Kashmiri translations were present and correctly displayed in the UI.
4.  **Edge Cases**:
    *   **Mixed Content**: Verification would include ensuring that LTR text embedded within an RTL layout (e.g., English product names) still renders correctly. (Not explicitly documented in this PR, but standard i18n testing).
    *   **New Components**: Any new components added after this PR will need to adhere to the logical property styling convention to maintain RTL compatibility.
    *   **Browser Compatibility**: The `dir` attribute and CSS logical properties are widely supported, but cross-browser testing would confirm consistent rendering. (Not explicitly documented in this PR).