# PR #539 — feat(contact): add i18n translations and env variable for contact email

> **Merged:** 2026-05-24 | **Author:** @ANISHA-RAWAT | **Area:** i18n | **Impact Score:** 20

## What Changed

This pull request significantly enhances the `contact` page (`apps/web/app/[locale]/contact/page.tsx`) by integrating internationalization (i18n) using `next-intl` for all textual content. It also externalizes the administrative contact email into an environment variable, `NEXT_PUBLIC_CONTACT_EMAIL`, for improved configurability. Furthermore, the interactive contact cards on the page were refactored to make the entire card area clickable, improving user experience.

## The Problem Being Solved

Prior to this PR, the `contact` page suffered from several limitations:

1.  **Lack of Internationalization:** All text on the `contact` page was hardcoded in English, preventing our SahiDawa platform from effectively serving our diverse Indian user base in their native languages, as identified in issue #505.
2.  **Inflexible Contact Email:** The administrative contact email was hardcoded within the `apps/web/app/[locale]/contact/page.tsx` file. This meant that any change to the contact email required a code modification and a redeployment, hindering agility and environment-specific configurations.
3.  **Suboptimal User Experience:** The interactive contact cards (Email, Discord, Bug Report, Contribute) only had their internal buttons as clickable elements. This is a less intuitive UI pattern, as users often expect the entire card area to be interactive for such components.

## Files Modified

- `apps/web/app/[locale]/contact/page.tsx`
- `apps/web/messages/bn.json`
- `apps/web/messages/en.json`
- `apps/web/messages/mr.json`
- `apps/web/messages/ta.json`
- `apps/web/messages/te.json`

## Implementation Details

Our system implemented the following changes within the `apps/web/app/[locale]/contact/page.tsx` file and related translation message files:

1.  **Internationalization Integration:**
    - We imported the `useTranslations` hook from the `next-intl` library: `import { useTranslations } from "next-intl";`.
    - Inside the `ContactPage` functional component, we initialized the translation hook, scoping it to a new `contact` namespace: `const t = useTranslations("contact");`.
    - All hardcoded English strings on the page were systematically replaced with calls to the `t` function, referencing specific keys within the `contact` namespace. Examples include `t("badge")`, `t("heroTitle.prefix")`, `t("heroTitle.highlight")`, `t("heroSubtitle")`, and various keys for card titles, descriptions, and call-to-action texts (e.g., `t("cards.email.title")`, `t("cards.discord.cta")`).
    - Corresponding translation keys and their values were added to the `messages/*.json` files for Bengali (`bn`), English (`en`), Marathi (`mr`), Tamil (`ta`), and Telugu (`te`). The `contact` object was introduced at the root level of these JSON files to house all contact page specific translations.

2.  **Environment Variable for Contact Email:**
    - The `CONTACT_EMAIL` constant, previously hardcoded as `"[ADMIN_EMAIL]"`, was updated to dynamically fetch its value from an environment variable: `const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contact@sahidawa.in";`.
    - We utilized Next.js's convention of prefixing environment variables with `NEXT_PUBLIC_` to ensure they are exposed to the client-side bundle where this page component renders.
    - A robust fallback value, `"contact@sahidawa.in"`, was provided using the nullish coalescing operator (`??`), ensuring that the application remains functional even if `NEXT_PUBLIC_CONTACT_EMAIL` is not explicitly set in the deployment environment.

3.  **Enhanced Card Clickability:**
    - The `div` elements that previously wrapped each contact card (Email, Discord, Bug Report, Contribute) were replaced with semantic `<a>` (anchor) tags.
    - The `href` attributes, which previously resided on inner `<a>` elements (acting as buttons), were moved to these new outer `<a>` tags. For example, the Email card's `href={"mailto:" + CONTACT_EMAIL}` is now on the wrapping `<a>`.
    - The `className` attributes were adjusted to leverage Tailwind CSS's `group` utility on the outer `<a>` tag, allowing inner elements (like the call-to-action `<span>`) to respond to the parent's hover state using `group-hover:bg-green-600`.
    - The inner `<a>` tags that previously served as buttons were converted into `<span>` elements to prevent nested interactive elements, which is an accessibility and semantic HTML best practice.

## Technical Decisions

1.  **`next-intl` for Internationalization:** We chose `next-intl` as our primary i18n library for the Next.js frontend due to its strong integration with Next.js's App Router, support for locale-based routing, and its `useTranslations` hook which simplifies translation management in both client and server components. This aligns with our existing i18n strategy.
2.  **`NEXT_PUBLIC_` Prefix for Environment Variables:** The decision to use `process.env.NEXT_PUBLIC_CONTACT_EMAIL` adheres to Next.js's standard practice for exposing environment variables to the client-side. This is crucial because the `contact` page is a client component, and its logic needs access to this variable during rendering in the browser.
3.  **Fallback Value for `CONTACT_EMAIL`:** Providing `"contact@sahidawa.in"` as a fallback ensures the application's resilience. It prevents potential runtime errors if the `NEXT_PUBLIC_CONTACT_EMAIL` environment variable is not configured, offering a default, functional contact point.
4.  **Entire Card Clickability with `<a>` Tags:** This design choice was made to improve the user experience by increasing the target area for interaction, making it easier and more intuitive for users to click on contact options. Using `<a>` tags for the entire card is semantically correct for navigation/action elements and enhances accessibility by clearly indicating interactive regions. The use of `group` and `group-hover` in Tailwind CSS facilitates applying hover styles to the entire card while keeping the HTML structure clean.

## How To Re-Implement (Contributor Reference)

To re-implement or extend similar functionality for a new page or component:

1.  **Prepare Translation Messages:**
    - Create a new namespace (e.g., `yourPage`) within the `messages/{locale}.json` files (e.g., `messages/en.json`, `messages/hi.json`).
    - Define all static text strings for your page as key-value pairs within this namespace, structuring them hierarchically for clarity (e.g., `"yourPage": { "heroTitle": "Your Title", "description": "Your description" }`).

2.  **Integrate `next-intl` into Your Component:**
    - In your React component file (e.g., `app/[locale]/yourPage/page.tsx`), import the `useTranslations` hook: `import { useTranslations } from "next-intl";`.
    - Inside your functional component, initialize the hook with your chosen namespace: `const t = useTranslations("yourPage");`.
    - Replace all hardcoded strings in your JSX with calls to the `t` function, referencing the keys you defined: `<h1>{t("heroTitle")}</h1>`, `<p>{t("description")}</p>`.

3.  **Externalize Environment-Specific Values:**
    - Identify any values that might change between deployment environments (e.g., API keys, external URLs, contact information).
    - Define these as environment variables in your `.env.local` (for local development) or deployment configuration, ensuring client-side variables are prefixed with `NEXT_PUBLIC_` (e.g., `NEXT_PUBLIC_YOUR_API_KEY=your_value`).
    - Access these variables in your component using `process.env.NEXT_PUBLIC_YOUR_API_KEY`. Always provide a robust fallback using the nullish coalescing operator: `const API_KEY = process.env.NEXT_PUBLIC_YOUR_API_KEY ?? "default_fallback_key";`.

4.  **Enhance UI Interactivity (e.g., Clickable Cards):**
    - If you have a block-level element that should act as a single clickable unit, wrap the entire content of that block in an `<a>` tag.
    - Move the `href` attribute to this outer `<a>` tag.
    - Apply styling to the `<a>` tag to make it visually distinct and indicate interactivity (e.g., `className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"`).
    - If there were previously inner `<a>` tags acting as buttons, convert them to `<span>` elements to avoid nested interactive elements.
    - Use Tailwind CSS's `group` utility on the parent `<a>` and `group-hover:` prefixes on child elements' classes to create unified hover effects (e.g., `group-hover:bg-green-600`).

## Impact on System Architecture

This change has a positive impact on our system architecture:

- **Enhanced Internationalization Foundation:** By fully internationalizing the `contact` page, we further solidify our commitment to supporting multiple Indian languages. This PR serves as a strong example and pattern for future i18n implementations across the platform, making it easier to localize new and existing pages.
- **Improved Configurability and Maintainability:** Decoupling the contact email from the codebase into an environment variable significantly improves the platform's configurability. Administrators can now update the contact email without requiring code changes or redeployments, enhancing operational flexibility and reducing maintenance overhead.
- **Standardization of Best Practices:** This PR reinforces the use of `next-intl` for i18n and environment variables for configuration as standard development practices within SahiDawa, promoting consistency and maintainability across the codebase.
- **Better User Experience:** The improved clickability of interactive elements contributes to a more intuitive and accessible user interface, aligning with modern web design principles and enhancing overall user satisfaction.

## Testing & Verification

The following testing and verification steps were performed:

- **Language Switching:** We verified that language switching functions correctly by navigating to the `contact` page with different locale prefixes in the URL (e.g., `/en/contact`, `/hi/contact`). All textual content on the page, including the hero section, card titles, descriptions, CTAs, and quick links, correctly rendered in the selected language.
- **Email Card Functionality:** We confirmed that clicking anywhere on the Email contact card correctly triggered the `mailto:` protocol, opening the user's default email client with the configured `CONTACT_EMAIL` pre-filled in the recipient field. This also implicitly verified that the `NEXT_PUBLIC_CONTACT_EMAIL` environment variable was correctly picked up and used.
- **General Card Clickability:** We tested all four contact cards (Email, Discord, Bug Report, Contribute) to ensure that clicking anywhere within their respective card boundaries correctly activated their associated links, navigating to the `mailto:` address, Discord server, GitHub Issues page, or Contributing Guide, respectively.
- **Environment Variable Configuration:** Not documented in this PR how the environment variable itself was tested in different environments (e.g., by setting it locally and verifying it's picked up), but the functional test of the email card implies it was working.
