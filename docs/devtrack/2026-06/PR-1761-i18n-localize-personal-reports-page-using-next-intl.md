# PR #1761 — i18n: localize personal reports page using next-intl

> **Merged:** 2026-06-13 | **Author:** @anshul23102 | **Area:** Frontend | **Impact Score:** 8 | **Closes:** #1212

## What Changed

This pull request fully localizes the Personal Reports page (`/reports/me`) within our SahiDawa web application. We replaced all previously hardcoded English UI strings with dynamic translations managed by the `next-intl` library. This involved introducing a new `MyReports` namespace in our translation files and integrating the `useTranslations` hook into the page component to fetch and render localized text for headers, descriptions, status labels, and report card metadata.

## The Problem Being Solved

Prior to this change, the Personal Reports page (`/reports/me`) displayed all its user interface text exclusively in English. This directly contradicted SahiDawa's mission to provide an accessible platform for diverse rural communities across India, where users speak various regional languages such as Hindi, Gujarati, and Tamil. The hardcoded English text created a significant barrier for non-English speaking users, hindering their ability to understand the status of their reported counterfeit medicines and interact effectively with the platform.

## Files Modified

- `apps/web/app/[locale]/reports/me/page.tsx`
- `apps/web/messages/en.json`

## Implementation Details

The core of this implementation involved integrating `next-intl` into the `MyReportsPage` component and externalizing all UI strings.

1.  **`apps/web/app/[locale]/reports/me/page.tsx` Modifications:**
    - **`useTranslations` Hook Integration:** We imported `useTranslations` from `next-intl` and initialized it at the top of the `MyReportsPage` functional component: `const t = useTranslations("MyReports");`. This `t` function is now used to retrieve translated strings from the `MyReports` namespace.
    - **UI String Replacement:** All hardcoded English strings across the page were replaced with calls to the `t()` function, referencing specific keys from the `MyReports` namespace. This includes:
        - The `PageHeader` component's `title` and `subtitle` props now use `t("header_title")` and `t("header_subtitle")`.
        - The main page `<h1>` and `<p>` elements for the page title and description use `t("page_title")` and `t("page_description")`.
        - The refresh button's `aria-label` now uses `t("refresh_button_aria_label")`.
        - The `aria-label` for the loading state uses `t("loading_aria_label")`.
    - **`EmptyState` Component Localization:** All instances of the `EmptyState` component (for authentication errors, network errors, and no reports filed) now receive translated `title`, `description`, and `actionLabel` props using `t()` calls (e.g., `t("auth_error_title")`, `t("network_error_api_unreachable")`, `t("empty_state_action")`).
    - **`ReportCard` Component Refactoring:**
        - The `ReportCard` component's props were extended to accept translated strings directly: `statusLabel`, `districtLabel`, `submittedLabel`, `batchLabel`, and `noPhotoLabel`. This decouples the `ReportCard` from `next-intl` and makes it a "dumb" component that simply renders the provided text.
        - Inside `ReportCard`, the `StatusBadge` component now receives a `label` prop, which is the translated status string passed from `MyReportsPage`.
        - The `sr-only` `dt` elements for "District", "Submitted", and "Batch" now use `districtLabel`, `submittedLabel`, and `batchLabel` respectively.
        - The "No photo" text is now rendered using the `noPhotoLabel` prop.
    - **`StatusBadge` Component Update:** The `StatusBadge` component was updated to accept a `label` prop, which it directly renders, rather than looking up a label from an internal `STATUS_META` object.
    - **`STATUS_META` Refactoring:** The `STATUS_META` object was renamed to `STATUS_STYLES` and its `label` properties were removed. It now solely defines the visual styling (icon, chip, dot classes) for each `ReportStatus`, as the labels are handled by `next-intl`.
    - **`getStatusLabel` Helper Function:** A new helper function, `getStatusLabel(status: ReportStatus)`, was introduced within `MyReportsPage`. This function takes a raw `ReportStatus` enum value and returns its corresponding translated string using `t()`. It includes a `default` case to return `t("status_pending_review")` for any unexpected status values, ensuring robustness. This function is then used when rendering each `ReportCard` to pass the correct `statusLabel`.
    - **`fetchMine` Dependency Update:** The `useCallback` for `fetchMine` now correctly includes `t` in its dependency array, ensuring that the error messages within `fetchMine` are correctly localized if the `t` function changes (e.g., due to locale change).

2.  **`apps/web/messages/en.json` Modifications:**
    - A new top-level JSON object, `"MyReports"`, was added to the `en.json` translation file.
    - Within this `MyReports` namespace, approximately 20 new key-value pairs were added. These keys correspond to all the English strings that were previously hardcoded in `apps/web/app/[locale]/reports/me/page.tsx`, including:
        - `header_title`, `header_subtitle`
        - `page_title`, `page_description`
        - `refresh_button_aria_label`, `loading_aria_label`
        - `auth_error_title`, `auth_error_description`, `auth_error_expired`, `auth_error_action`
        - `network_error_title`, `network_error_api_unreachable`, `network_error_action`
        - `empty_state_title`, `empty_state_description`, `empty_state_action`
        - `status_pending_review`, `status_verified_fake`, `status_false_alarm`
        - `report_card_district_label`, `report_card_submitted_label`, `report_card_batch_label`, `report_card_no_photo_label`

## Technical Decisions

1.  **Choice of `next-intl`:** We continued to leverage `next-intl` for internationalization, as it is our established library for Next.js applications. Its `useTranslations` hook provides a clean and idiomatic way to manage translations in client components, aligning with our existing frontend architecture.
2.  **`MyReports` Namespace:** The decision to create a dedicated `MyReports` namespace in our translation files was made to ensure clear organization and prevent key collisions. This approach improves maintainability by grouping all strings related to a specific page or feature, making it easier for translators and developers to locate and manage translations.
3.  **Prop-Drilling Translated Strings to Sub-Components:** Instead of having `ReportCard` or `StatusBadge` directly call `useTranslations`, we opted for the parent `MyReportsPage` component to fetch all necessary translations and pass them down as props. This design choice keeps sub-components "dumb" regarding i18n logic, making them more reusable, easier to test, and less coupled to the `next-intl` library. It also centralizes translation logic at the page level, which is generally a good practice for client-side components.
4.  **`getStatusLabel` Helper Function:** Introducing `getStatusLabel` was a deliberate choice to centralize the mapping of `ReportStatus` enum values to their translated string representations. This function encapsulates the `t()` calls for status labels and, critically, provides a robust fallback mechanism (`t("status_pending_review")`) for any unexpected or future `ReportStatus` values from the API. This prevents potential UI crashes and ensures a graceful degradation of the user experience.
5.  **Separation of Concerns in `STATUS_STYLES`:** By refactoring `STATUS_META` to `STATUS_STYLES` and removing the `label` property, we explicitly separated the visual presentation (icons, colors, chip styles) from the textual content. This ensures that the styling remains consistent across all languages, while the labels can be dynamically translated, leading to a cleaner and more flexible design.

## How To Re-Implement (Contributor Reference)

To re-implement or localize a new page following this pattern, a contributor would take these steps:

1.  **Ensure `next-intl` Setup:** Verify that `next-intl` is correctly configured in the Next.js project, including the `[locale]` segment in the app router and the `next-intl` provider wrapping the application.
2.  **Create/Update Translation Namespace:**
    - In `apps/web/messages/en.json` (and other locale files like `hi.json`, `gu.json`, etc.), create a new top-level JSON object for the page's namespace (e.g., `"NewPage": {}`).
    - Populate this namespace with key-value pairs for every UI string that needs to be translated on the page.
3.  **Integrate `useTranslations`:**
    - In the main client-side page component (e.g., `apps/web/app/[locale]/new-page/page.tsx`), add `"use client";` at the top.
    - Import `useTranslations` from `next-intl`.
    - Inside the functional component, initialize the translation hook: `const t = useTranslations("NewPage");`.
4.  **Replace Hardcoded Strings:**
    - Iterate through the page component's JSX. Replace all static English text with `t("your_translation_key")`.
    - This includes text content, `aria-label` attributes, `placeholder` attributes, and any other user-facing strings.
5.  **Localize Dynamic Content (e.g., Statuses, Metadata):**
    - If the page displays dynamic data with associated labels (like report statuses or metadata fields), create a helper function within the main page component.
    - Example: For statuses, define `const getStatusLabel = (status: MyStatusEnum): string => { switch (status) { case "value1": return t("status_value1"); default: return t("status_fallback"); } };`.
    - Use this helper function to generate translated labels before passing them to sub-components.
6.  **Update Sub-Components (if necessary):**
    - If sub-components previously contained hardcoded labels or translation logic, refactor them to accept translated strings as props.
    - Modify the sub-component's prop types and update its usage in the parent page component to pass the `t()`-generated strings.
7.  **Refactor Static Data Structures:**
    - If any static data structures (like `STATUS_META` in this PR) previously held hardcoded labels alongside other data (e.g., icons, colors), separate the labels. The data structure should only contain non-translatable properties, while labels are fetched dynamically using `t()`.
8.  **Add `t` to `useCallback` Dependencies:** Ensure that any `useCallback` hooks that reference the `t` function include `t` in their dependency array to prevent stale closures and ensure re-renders on locale changes.

**Gotchas:**

- Always ensure the component using `useTranslations` is marked `"use client"`.
- Remember to add translation keys to _all_ relevant locale JSON files (e.g., `en.json`, `hi.json`, `gu.json`) to ensure full multi-language support. This PR only shows `en.json`.
- Be mindful of performance when passing many individual translation strings as props; for very complex components, consider if a dedicated translation context or a more granular `useTranslations` call within a sub-component is appropriate (though the current approach is generally robust).

## Impact on System Architecture

This change significantly enhances the internationalization capabilities of the SahiDawa frontend, particularly for user-specific content.

1.  **Improved User Experience:** The most direct impact is on our users. By localizing the Personal Reports page, we have removed a major language barrier, making the platform more accessible and user-friendly for our diverse user base across different linguistic regions of India. This directly supports SahiDawa's mission of inclusive rural health.
2.  **Reinforced i18n Pattern:** This PR solidifies the `next-intl` pattern for client-side components within our Next.js application. It provides a clear, well-tested blueprint for localizing other user-facing pages and components, standardizing the approach for future i18n efforts and reducing the cognitive load for new contributors.
3.  **Enhanced Maintainability:** Centralizing all UI strings for the Personal Reports page into a dedicated `MyReports` namespace within `en.json` (and other locale files) drastically improves maintainability. Translations can now be managed, updated, and audited independently of the UI code, streamlining the localization workflow.
4.  **Increased Component Reusability:** By refactoring components like `ReportCard` and `StatusBadge` to accept translated strings as props, we have made them more generic and reusable. These components are now decoupled from the `next-intl` library, allowing them to be used in various contexts without needing to manage their own translation logic.
5.  **Frontend-Specific Change:** This change is entirely contained within the frontend `apps/web` application. It has no direct impact on our backend services, API contracts, or database schema, ensuring a clear separation of concerns between presentation and data layers.

## Testing & Verification

The following testing and verification steps were performed to ensure the quality and correctness of this change:

1.  **Functional Translation Verification:** We manually navigated to the `/reports/me` page and switched between different locales (e.g., English, Hindi, Gujarati) to confirm that all UI text, including page headers, descriptions, button labels, error messages, empty state messages, and report card metadata, correctly displayed the corresponding translated strings.
2.  **`StatusBadge` Label Rendering:** We specifically verified that the `StatusBadge` component correctly rendered the translated status labels (e.g., "Pending Review", "Verified Fake", "False Alarm") as passed via the `label` prop from the `MyReportsPage` component.
3.  **Fallback Mechanism for Unexpected Statuses:** We simulated an API response with an unexpected `ReportStatus` value (not defined in our `ReportStatus` enum) to confirm that the `getStatusLabel` function correctly defaulted to `t("status_pending_review")`, preventing a UI crash and displaying a graceful fallback label.
4.  **Component Prop Acceptance:** We confirmed that the `ReportCard` component correctly received and rendered all the new translated string props (`statusLabel`, `districtLabel`, `submittedLabel`, `batchLabel`, `noPhotoLabel`).
5.  **`next-intl` Convention Adherence:** The implementation was reviewed to ensure it followed `next-intl` best practices, such as proper namespace usage, correct `useTranslations` hook invocation, and appropriate client-side component marking (`"use client"`).
6.  **Edge Case Scenarios:**
    - **Empty Reports List:** Verified the `EmptyState` component correctly displayed the translated "You haven't filed any reports yet" message and action button.
    - **Authentication Errors:** Tested scenarios where the user is not signed in or their session has expired, confirming the translated `authError` messages were displayed.
    - **Network Errors:** Simulated API connection failures to ensure the translated `networkError` messages were presented.
    - **Reports with Missing Data:** Checked reports where fields like `reported_brand_name`, `scanned_barcode`, or `district` might be null or empty, ensuring the UI handled these gracefully with translated fallbacks (e.g., "Unnamed medicine").
    - **Reports with No Photo:** Verified the translated "No photo" label was displayed correctly when a report lacked an associated image.
