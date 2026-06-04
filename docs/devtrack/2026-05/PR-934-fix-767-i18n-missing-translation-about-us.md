# PR #934 — Fix/#767-i18n missing translation about us

> **Merged:** 2026-05-31 | **Author:** @Vartika2903 | **Area:** i18n | **Impact Score:** 41 | **Closes:** #767

## What Changed

This pull request significantly enhances the internationalization (i18n) of our `apps/web` frontend by adding comprehensive multilingual translations for the "About Us" page. We have integrated the `useTranslations` hook from `next-intl` into `apps/web/app/[locale]/about/page.tsx` and replaced all static text with dynamic translation calls, ensuring the page content is available in all supported Indian languages. This involved creating a new `about` object within our locale JSON files to house the structured translation keys.

## The Problem Being Solved

Prior to this PR, the "About Us" page (`apps/web/app/[locale]/about/page.tsx`) was only available in the default language, English. This posed a significant accessibility barrier for a large segment of our target audience in India, where multiple languages are spoken. Our mission is to serve "Bharat, not just India," which necessitates supporting all 22 official Indian languages. The lack of translation for a core informational page like "About Us" directly contradicted this goal, hindering user experience and limiting the platform's reach and inclusivity for non-English speakers, as highlighted in issue #767.

## Files Modified

- `apps/web/app/[locale]/about/page.tsx`
- `apps/web/messages/bn.json`
- `apps/web/messages/en.json`
- `apps/web/messages/gu.json`
- `apps/web/messages/hi.json`
- `apps/web/messages/kn.json`
- `apps/web/messages/mr.json`
- `apps/web/messages/od.json`
- `apps/web/messages/pa.json`
- `apps/web/messages/sa.json`
- `apps/web/messages/ta.json`
- `apps/web/messages/te.json`
- `apps/web/messages/ur.json`

## Implementation Details

The core of this implementation involved two main steps: updating the "About Us" page component to use `next-intl`'s translation capabilities and populating the necessary translation keys across all our supported locale JSON files.

1.  **`apps/web/app/[locale]/about/page.tsx` Modifications:**
    - We imported the `useTranslations` hook from `next-intl` at the top of the file: `import { useTranslations } from "next-intl";`.
    - Inside the `AboutPage` functional component, we initialized the translation function by calling `const t = useTranslations("about");`. This tells `next-intl` to load translations from the `about` namespace within our message files.
    - All static text strings within the JSX were systematically replaced with dynamic translation calls using the `t()` function. For example:
        - `GSSoC 2026 Open Source Project` became `{t("badge")}`.
        - The main hero title `About <span className="text-emerald-600 dark:text-emerald-400">SahiDawa</span>` was converted to use `t.rich()` to preserve the inline styling for "SahiDawa": `{t.rich('heroTitle',{ highlight:(chunks)=>( <span className="text-emerald-600 dark:text-emerald-400">{chunks}</span> ) })}`. This allows us to define the "SahiDawa" part as a rich text component within the translation string.
        - The hero subtitle `India's first open-source citizen medicine verifier & rural health bridge. Built for Bharat. Not just India.` became `{t("heroSubtitle")}`.
        - Feature badges like `100% Free. Forever.` became `<Lock size={14} /> {t("features.free")}`.
        - Section titles and descriptions, such as `The Problem We're Solving` and its accompanying paragraph, were replaced with `{t("problemSection.title")}` and `{t("problemSection.description")}` respectively.
        - The content for the problem cards (Fake Medicines, Rural Healthcare Gap, Language Barrier) was also dynamically translated using keys like `t("cards.fakeMedicines.title")` and `t("cards.fakeMedicines.description")`.
        - The "Real Incident" section also utilized `t.rich()` for its main text to highlight specific phrases: `{t.rich('realIncident.text',{ highlight:(chunks)=>( <span className="font-bold text-orange-600 dark:text-orange-400">{chunks}</span> )})}`.
        - Mission, Vision, and Core Values sections followed the same pattern, using keys like `t("mission.title")`, `t("vision.description")`, `t("coreValues.cards.openSource.title")`, etc.

2.  **Locale JSON Files (`apps/web/messages/*.json`) Updates:**
    - In `apps/web/messages/en.json`, a new top-level `about` object was created. This object encapsulates all translation keys specific to the "About Us" page, providing a clear and organized structure.
    - Example structure in `en.json`:
        ```json
        {
            "about": {
                "badge": "GSSoC 2026 Open Source Project",
                "heroTitle": "About <highlight>SahiDawa</highlight>",
                "heroSubtitle": "India's first open-source citizen medicine verifier & rural health bridge. Built for Bharat. Not just India.",
                "features": {
                    "free": "100% Free. Forever.",
                    "languages": "22 Indian Languages",
                    "license": "Open Source MIT License"
                },
                "problemSection": {
                    "title": "The Problem We're Solving",
                    "description": "India has a three-layer healthcare crisis that no existing platform solves simultaneously."
                },
                "cards": {
                    "fakeMedicines": {
                        "title": "Fake Medicines",
                        "description": "12–25% of medicines in India are fake or substandard — putting 1.4 billion people at risk with zero citizen-facing verification tool."
                    }
                    // ... other cards
                },
                "realIncident": {
                    "title": "Real Incident — July 2025",
                    "text": "Delhi Police busted a counterfeit medicine ring supplying fake Johnson & Johnson and GSK medicines — made of chalk powder and starch — all the way into government hospitals. Patients had <highlight>zero way to verify</highlight> these medicines before consuming them.",
                    "highlight": "SahiDawa fixes this. For free. Forever. Open source."
                },
                "mission": {
                    "title": "Our Mission",
                    "description": "To empower every Indian citizen — regardless of language, location, or literacy — with the ability to instantly verify medicines, access qualified health guidance, and report counterfeit drugs in their community."
                },
                "vision": {
                    "title": "Our Vision",
                    "description": "A Bharat where no child dies from a fake medicine, no farmer's family is misdiagnosed for lack of a doctor, and no language is a barrier to healthcare. Free. Open. Forever."
                },
                "coreValues": {
                    "title": "Our Core Values",
                    "cards": {
                        "openSource": {
                            "title": "Open Source",
                            "description": "MIT Licensed. Always."
                        }
                        // ... other core value cards
                    }
                }
            }
        }
        ```
    - Corresponding `about` objects with translated values were added to all other locale JSON files: `bn.json`, `gu.json`, `hi.json`, `kn.json`, `mr.json`, `od.json`, `pa.json`, `sa.json`, `ta.json`, `te.json`, and `ur.json`. The translations for these files were generated with the assistance of Google Translate and AI-supported tools, with efforts made to ensure accuracy and consistency.

This approach ensures that the "About Us" page dynamically renders content based on the user's selected locale, leveraging `next-intl`'s robust i18n capabilities.

## Technical Decisions

1.  **Leveraging `next-intl` for i18n:** We chose to continue using `next-intl` as it is our established and robust solution for internationalization within the `apps/web` Next.js frontend. Its `useTranslations` hook provides a clean and efficient way to fetch localized strings within React components, integrating seamlessly with Next.js's app router and locale-based routing.
2.  **Structured JSON Keys:** The decision to create a nested `about` object within our locale JSON files (e.g., `about.heroTitle`, `about.problemSection.title`) was made to maintain a clear, organized, and scalable translation structure. This prevents key collisions, improves readability, and makes it easier for future contributors to locate and manage translations for specific pages or components.
3.  **`t.rich()` for Rich Text:** For elements like the main hero title and the "Real Incident" description, we opted to use `t.rich()` instead of simple `t()`. This is a critical decision because it allows us to embed React components or HTML tags (like `<span>` for styling) directly within our translation strings without breaking the translation mechanism. This maintains the visual fidelity and branding of the SahiDawa name and specific highlighted phrases across all languages, which would be difficult or impossible with plain string replacements.
4.  **Centralized Translation Files:** Keeping all locale-specific translations in dedicated JSON files under `apps/web/messages/` ensures that all translation content is centralized and easily manageable, separate from the application logic.

## How To Re-Implement (Contributor Reference)

If you need to implement internationalization for a new page or component within `apps/web` from scratch, follow these steps:

1.  **Identify the Component/Page:** Determine which React component or Next.js page (`page.tsx`) requires internationalization. For this PR, it was `apps/web/app/[locale]/about/page.tsx`.
2.  **Choose a Namespace:** Decide on a logical namespace for your translations (e.g., `about`, `home`, `dashboard`). This will be the top-level key in your JSON files.
3.  **Import `useTranslations`:** In your `page.tsx` or component file, import the `useTranslations` hook:
    ```typescript
    import { useTranslations } from "next-intl";
    ```
4.  **Initialize the Translation Function:** Inside your functional component, call `useTranslations` with your chosen namespace:
    ```typescript
    export default function MyPage() {
        const t = useTranslations("yourNamespace");
        // ... rest of your component
    }
    ```
5.  **Define Translation Keys in `en.json`:**
    - Open `apps/web/messages/en.json`.
    - Add a new top-level object with your chosen namespace (if it doesn't exist).
    - Define all the necessary translation keys and their English values within this object. Use nested objects for better organization (e.g., `yourNamespace.section.title`).
    - For text that requires inline styling or components, use `t.rich()` syntax in your JSON value, e.g., `"myKey": "This is <highlight>important</highlight> text."`.
    ```json
    {
        "yourNamespace": {
            "pageTitle": "My Awesome Page",
            "welcomeMessage": "Welcome to <bold>SahiDawa</bold>!",
            "section": {
                "heading": "Section Heading",
                "description": "This is a description for the section."
            }
        }
    }
    ```
6.  **Add Translations to Other Locale Files:**
    - For _every_ other locale file in `apps/web/messages/` (e.g., `hi.json`, `bn.json`, `ta.json`), add the _exact same structure_ of keys under your namespace.
    - Translate the values accurately into the respective language. Pay close attention to context and cultural nuances. For rich text keys, ensure the rich text markers (e.g., `<bold>`) are preserved around the translated words.
    - _Note:_ As seen in this PR, AI-supported tools can assist with initial translations, but human review is crucial for accuracy and consistency.
7.  **Replace Static Text in JSX:** In your component, replace all static text strings with calls to your `t` function:

    ```typescript
    // Before
    // <h1>My Awesome Page</h1>
    // <p>Welcome to SahiDawa!</p>

    // After
    <h1>{t("pageTitle")}</h1>
    <p>
        {t.rich("welcomeMessage", {
            bold: (chunks) => <strong>{chunks}</strong>,
        })}
    </p>
    <section>
        <h2>{t("section.heading")}</h2>
        <p>{t("section.description")}</p>
    </section>
    ```

8.  **Test Thoroughly:** Run the application locally and navigate to the page. Change the locale in the URL (e.g., `/en/about`, `/hi/about`) to verify that all text renders correctly in each supported language. Check for any missing translations (which would display the key itself) or incorrect formatting.

## Impact on System Architecture

This change significantly strengthens the internationalization capabilities of our `apps/web` frontend.

1.  **Enhanced Accessibility and User Experience:** By translating a core informational page like "About Us," we directly improve accessibility for our diverse user base, particularly non-English speakers. This aligns with SahiDawa's mission to serve all of Bharat.
2.  **Standardized i18n Pattern:** This PR reinforces the established pattern for implementing i18n using `next-intl` and structured JSON message files. It provides a clear example for future feature development, ensuring consistency in how new content is made multilingual.
3.  **Scalability of Content:** The structured `about` object within the message files demonstrates a scalable approach to managing translations. As more pages and components are internationalized, we can continue to create dedicated namespaces, keeping our translation files organized and maintainable.
4.  **Foundation for Future Growth:** Having a fully translated "About Us" page sets a precedent and provides a robust foundation for translating other static content and dynamic data across the platform, moving us closer to a truly multilingual application.
5.  **No Backend Impact:** This change is purely frontend-focused within `apps/web` and does not affect the `apps/api` or `apps/ml` services.

## Testing & Verification

The testing for this change primarily involved visual verification across all supported locales.

- **Manual UI Testing:** The author verified that the translations rendered correctly in all supported locales by navigating to the "About Us" page (`apps/web/app/[locale]/about`) for each language.
- **Screenshot Proof:** Screenshots were provided in the PR description, demonstrating the "About Us" page content displayed in English and other Indian languages (specifically Hindi and Bengali were shown), confirming the successful application of translations.
- **Edge Cases:** Not documented in this PR, but typical edge cases for i18n would include:
    - Missing translation keys (which would typically display the key string itself).
    - Incorrect locale loading (e.g., default English showing for a Hindi locale).
    - Malformed JSON in translation files leading to parsing errors.
    - Text overflow or layout issues with longer translated strings.
      These were implicitly covered by the visual verification across multiple languages.
