# PR #1237 — fix: localize alerts log and compare grid

> **Merged:** 2026-06-04 | **Author:** @saurabhhhcodes | **Area:** i18n | **Impact Score:** 27 | **Closes:** #1201

## What Changed

This pull request introduces comprehensive internationalization (i18n) support for the CDSCO alerts log page (`/alerts`) and the medicine comparison page (`/compare`). We achieved this by integrating the `next-intl` library's `useTranslations` hook, replacing hardcoded English strings with dynamic translation keys, and adding new `Alerts` and `Compare` message namespaces across all 14 locale bundles in `apps/web/messages/*.json`. The `ComparisonGrid` component was also updated to accept localized labels via a new `labels` prop.

## The Problem Being Solved

Prior to this PR, the CDSCO alerts log page and the medicine comparison page displayed static, hardcoded English text for all user-facing elements, including titles, descriptions, search placeholders, data labels, and grid content. This significantly limited the accessibility and usability of these critical SahiDawa features for our diverse user base across India, who speak various regional languages. The lack of localization prevented users from interacting with the platform in their preferred language, creating a barrier to effective health information access and comparison.

## Files Modified

- `apps/web/app/[locale]/alerts/page.tsx`
- `apps/web/app/[locale]/compare/page.tsx`
- `apps/web/messages/bn.json`
- `apps/web/messages/en.json`
- `apps/web/messages/gu.json`
- `apps/web/messages/hi.json`
- `apps/web/messages/kn.json`
- `apps/web/messages/ks.json`
- `apps/web/messages/ml.json`
- `apps/web/messages/mr.json`
- `apps/web/messages/or.json`
- `apps/web/messages/pa.json`
- `apps/web/messages/sa.json`
- `apps/web/messages/ta.json`
- `apps/web/messages/te.json`
- `apps/web/messages/ur.json`
- `apps/web/src/components/ComparisonGrid.tsx`

## Implementation Details

Our implementation involved a multi-faceted approach to localize the target pages and components:

1.  **`apps/web/app/[locale]/alerts/page.tsx` Localization:**
    - We integrated the `useTranslations` hook from `next-intl` within the `FullAlertsLogPage` functional component by declaring `const t = useTranslations("Alerts");`. This establishes a dedicated `Alerts` message namespace for this page.
    - All previously hardcoded English strings, such as "Back to Home Page", "Live Alerts", "Live CDSCO Alerts", "Search by Brand Name...", "Loading alerts...", and various alert metadata labels (e.g., "Batch:", "Manufacturer:", "Region:"), were replaced with calls to the `t()` function, referencing specific keys within the "Alerts" namespace (e.g., `t("backHome")`, `t("badge")`, `t("title")`, `t("brandPlaceholder")`, `t("loading")`, `t("batchLabel")`).
    - For strings requiring dynamic content, like "Total Count: {totalCount}" or "Alert: {alert_type}", we utilized `next-intl`'s interpolation feature by passing an object as the second argument to `t()` (e.g., `t("totalCount", { count: totalCount })`, `t("alertType", { type: alert.alert_type })`).

2.  **`apps/web/app/[locale]/compare/page.tsx` Localization:**
    - Similar to the alerts page, we added `const t = useTranslations("Compare");` to the `ComparePage` component, binding it to the `Compare` message namespace.
    - The `ComparisonGrid` component, which is a key part of this page, was updated to receive localized strings through a new `labels` prop. We defined a `comparisonLabels` object of type `ComparisonGridLabels` (imported from `apps/web/src/components/ComparisonGrid.tsx`) and populated its properties using `t()` calls for keys like `emptyComparison`, `fieldHeader`, `medicineA`, `medicineB`, `priceUnavailable`, `noSavings`, and `saveAmount`.
    - This `comparisonLabels` object is then passed to the `ComparisonGrid` component: `<ComparisonGrid medicine1={medicine1} medicine2={medicine2} labels={comparisonLabels} />`.

3.  **`apps/web/src/components/ComparisonGrid.tsx` Updates:**
    - We introduced a new TypeScript type, `ComparisonGridLabels`, to explicitly define the structure of the localized labels expected by the component. This type includes keys such as `emptyComparison: string`, `fieldHeader: string`, `medicineA: string`, `medicineB: string`, `priceUnavailable: string`, `noSavings: string`, and `saveAmount: (amount: string | number, options?: any) => string`.
    - The `ComparisonGrid` component's props were updated to accept `labels: ComparisonGridLabels`.
    - Inside the component's JSX, all previously hardcoded strings were replaced with references to the corresponding properties of the `labels` prop (e.g., `labels.emptyComparison`, `labels.fieldHeader`). For the `saveAmount` message, we invoke the function provided in the `labels` prop: `labels.saveAmount(amount)`.

4.  **Locale Bundle Updates (`apps/web/messages/*.json`):**
    - New `Alerts` and `Compare` top-level keys (namespaces) were added to all 14 existing locale JSON files (e.g., `bn.json`, `en.json`, `gu.json`, `hi.json`, `ml.json`, etc.).
    - Within these namespaces, all the translation keys referenced by the `t()` calls in `apps/web/app/[locale]/alerts/page.tsx` and `apps/web/app/[locale]/compare/page.tsx` were added with their respective English (or other locale) translations.
    - For instance, `apps/web/messages/en.json` now includes:
        ```json
        "Alerts": {
            "backHome": "Back to Home Page",
            "badge": "Live Alerts",
            "title": "Live CDSCO Alerts",
            "subtitle": "Complete historical safety logging stream directly mapped to the master CDSCO registry.",
            "regionBadge": "India Region",
            "totalCount": "Total Count: {count}",
            "brandPlaceholder": "Search by Brand Name...",
            "regionPlaceholder": "Filter by State/District...",
            "error": "Database synchronization error encountered while fetching active logs.",
            "loading": "Loading alerts...",
            "systemUpdate": "System Update",
            "alertType": "Alert: {type}",
            "noDetails": "No details available",
            "batchLabel": "Batch:",
            "manufacturerLabel": "Manufacturer:",
            "regionLabel": "Region:",
            "empty": "No health alerts matching your criteria were found.",
            "previous": "Previous",
            "next": "Next"
        },
        "Compare": {
            "emptyComparison": "Select two medicines above to compare their details.",
            "fieldHeader": "Field",
            "medicineA": "Medicine A",
            "medicineB": "Medicine B",
            "priceUnavailable": "Price Unavailable",
            "noSavings": "No Savings",
            "saveAmount": "Save {amount}!"
        }
        ```
    - The `saveAmount` key in the `Compare` namespace uses `next-intl`'s message format syntax to handle interpolation for the `amount` variable.

## Technical Decisions

We made several key technical decisions during this implementation:

- **Leveraging `next-intl`:** We continued to use `next-intl` as our primary internationalization library. This decision aligns with our existing technology stack and allows us to utilize its robust features, such as message namespaces, interpolation, and automatic locale routing, ensuring consistency across the application.
- **Dedicated Message Namespaces:** The choice to create distinct `Alerts` and `Compare` namespaces for each page is crucial for maintainability. It prevents key collisions, organizes translation files logically, and makes it easier for contributors to locate and manage translations specific to a particular section of the application. This modularity scales well as SahiDawa grows.
- **Decoupling `ComparisonGrid` from `next-intl`:** Instead of directly using `useTranslations` within `ComparisonGrid.tsx`, we opted to pass a `labels` object containing pre-localized strings from the parent `ComparePage`. This design decision makes `ComparisonGrid` a purely presentational component, agnostic to the specific i18n library being used. This improves its reusability, testability, and reduces coupling, adhering to good component design principles.
- **Comprehensive Fallback Keys:** Adding matching fallback keys across all 14 locale bundles, even if the translations are identical to English for some languages initially, ensures that `next-intl` lookups always resolve successfully. This prevents runtime errors or unexpected missing text in the UI, providing a more robust and fault-tolerant i18n system.

## How To Re-Implement (Contributor Reference)

To re-implement or extend localization using the patterns established in this PR, follow these steps:

1.  **Identify Target:** Determine the specific page or component that requires internationalization.
2.  **Define Namespace:** Choose a unique and descriptive namespace for the new translations (e.g., "Dashboard", "Settings").
3.  **Integrate `useTranslations`:** In the target React component (e.g., `apps/web/app/[locale]/your-page/page.tsx`), import `useTranslations` from `next-intl` and initialize it with your chosen namespace:
    ```typescript
    import { useTranslations } from "next-intl";
    // ... inside your functional component
    const t = useTranslations("YourNamespace");
    ```
4.  **Replace Hardcoded Strings:** Iterate through the component's JSX and replace all static English strings with calls to the `t()` function.
    - For simple text: `<h2>{t("sectionTitle")}</h2>`
    - For text with dynamic variables: `<p>{t("greeting", { name: user.firstName })}</p>`
    - **For reusable components:**
        - Define a TypeScript interface (e.g., `YourComponentLabels`) in the component's file (`apps/web/src/components/YourComponent.tsx`) that outlines all the localized strings it needs.
        - Update `YourComponent` to accept a `labels: YourComponentLabels` prop.
        - In the parent component, create an object of type `YourComponentLabels` by calling `t()` for each key, then pass this object to `YourComponent`.
        - Inside `YourComponent`, use `props.labels.yourKey` to render the localized text.
5.  **Update Locale Bundles:** For each of the 14 locale JSON files located in `apps/web/messages/`, add your new namespace as a top-level key. Populate this namespace with all the translation keys and their corresponding values used in your `t()` calls. Ensure consistency across all locale files to prevent missing translations.
    ```json
    // apps/web/messages/en.json
    {
        "YourNamespace": {
            "sectionTitle": "Your Section Title",
            "greeting": "Hello, {name}!"
        }
    }
    ```
    Remember to use `next-intl`'s message format syntax for interpolated strings (e.g., `"greeting": "Hello, {name}!"`).
6.  **Validation:**
    - Run the locale parity check script (if available) to ensure all keys are present across all bundles.
    - Execute `npx tsc -p apps/web/tsconfig.json --noEmit` to verify TypeScript compilation.
    - Run relevant i18n tests, or create new ones, to confirm correct translation loading and rendering.
    - Perform manual testing by navigating to the localized pages in different locales to visually confirm all strings are correctly translated.

## Impact on System Architecture

This change significantly enhances the internationalization capabilities of the SahiDawa web application, moving us closer to a fully localized platform. By extending `next-intl` support to the CDSCO Alerts Log and Medicine Comparison pages, we've made two critical features accessible to a broader, multi-lingual user base across India.

Architecturally, this PR establishes robust patterns for future i18n efforts:

- **Modular Translation Management:** The use of dedicated `Alerts` and `Compare` message namespaces provides a clear, scalable structure for organizing translation keys, which will be crucial as more parts of the application are localized.
- **Component Decoupling:** The strategy of passing a `labels` object to the `ComparisonGrid` component demonstrates a best practice for localizing reusable UI components. This pattern ensures that presentational components remain independent of the specific i18n library, improving their reusability, testability, and overall architectural cleanliness.
- **Enhanced User Experience Foundation:** This work lays a strong foundation for a more inclusive user experience, directly supporting SahiDawa's mission to provide accessible health information. It unlocks the potential for future development to easily localize other features, further broadening our reach and impact.
