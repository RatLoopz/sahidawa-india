# PR #1641 — feat(compare): add shareable comparison URLs

> **Merged:** 2026-06-11 | **Author:** @Avinash-sdbegin | **Area:** Frontend | **Impact Score:** 8 | **Closes:** #1551

## What Changed

This pull request introduces the ability to share specific medicine comparisons via URL parameters. Users can now generate a unique URL for any two medicines being compared, which, when opened, will automatically load those medicines into the comparison view. Additionally, a "Share Comparison" button has been added to the comparison grid, allowing users to easily copy this shareable URL to their clipboard.

## The Problem Being Solved

Prior to this change, the SahiDawa medicine comparison feature lacked a direct way to share a specific comparison. If a user wanted to show another person a comparison between two particular medicines, they would have to instruct them to manually search for and select each medicine on the comparison page. This was inefficient and hindered collaboration or discussion around specific medicine comparisons. The linked issue #1551 highlighted the need for a more seamless sharing mechanism, improving the user experience and utility of the comparison tool.

## Files Modified

-   `apps/web/app/[locale]/compare/page.tsx`
-   `apps/web/src/components/ComparisonGrid.tsx`

## Implementation Details

The implementation involved modifications to two key frontend files:

1.  **`apps/web/app/[locale]/compare/page.tsx`**:
    *   We introduced a `useEffect` hook that runs once when the component mounts.
    *   Inside this `useEffect`, `window.location.search` is used to retrieve the URL's query string, which is then parsed by `URLSearchParams`.
    *   The system checks for `m1` and `m2` query parameters, which are expected to contain the IDs of the medicines to be compared.
    *   If both `m1` and `m2` parameters are present, an asynchronous function `loadMedicines` is called.
    *   `loadMedicines` queries our Supabase instance (`supabase.from("medicines")`) to fetch the details of the medicines corresponding to the provided IDs. It uses the `COMPARE_SELECT_FIELDS` constant to select only the necessary fields for comparison and the `.in("id", [m1, m2])` filter for efficient retrieval of multiple records.
    *   Upon successful data retrieval, the `data` is mapped using `mapMedicineRow` (an existing utility) to transform the raw Supabase rows into `Medicine` objects.
    *   The fetched medicines are then assigned to the `medicine1` and `medicine2` state variables using `setMedicine1` and `setMedicine2`, ensuring the comparison grid is populated.
    *   Error handling is included to gracefully ignore invalid IDs or network issues, preventing the page from breaking.

2.  **`apps/web/src/components/ComparisonGrid.tsx`**:
    *   A new utility function, `shareComparison`, was added. This function takes `medicine1` and `medicine2` (both `Medicine | null`) as arguments.
    *   It first checks if both medicines are non-null. If they are, it constructs the shareable URL using `window.location.origin` (e.g., `https://sahidawa.org`), `window.location.pathname` (e.g., `/en/compare`), and appends the `m1` and `m2` query parameters with the respective medicine IDs.
    *   The constructed URL is then copied to the user's clipboard using the `navigator.clipboard.writeText()` Web API.
    *   A new `button` element was added to the `ComparisonGrid` component. This button is conditionally rendered only when both `medicine1` and `medicine2` props are present (i.e., a comparison is active).
    *   The button's `onClick` handler calls the `shareComparison` function, passing the current `medicine1` and `medicine2` props. The button is styled with Tailwind CSS classes for a clean appearance.

## Technical Decisions

*   **Client-side URL Parsing with `useEffect`**: We opted to parse URL parameters using `useEffect` on the client side (`apps/web/app/[locale]/compare/page.tsx`). This is appropriate for a "use client" component in Next.js, ensuring the `window` object is available. The empty dependency array `[]` ensures the parsing logic runs only once after the initial render, preventing unnecessary re-executions.
*   **Standard `URLSearchParams` API**: The `URLSearchParams` Web API was chosen for parsing query parameters due to its native browser support, simplicity, and robustness in handling various URL parameter formats.
*   **Supabase `in` operator for Batch Fetching**: When loading medicines from URL parameters, we used `supabase.from("medicines").select(...).in("id", [m1, m2])`. This is an efficient way to fetch multiple records by their primary keys in a single database query, reducing network requests compared to fetching each medicine individually.
*   **`navigator.clipboard.writeText()` for Clipboard Access**: This standard Web API provides a secure and user-friendly way to programmatically copy text to the clipboard. It's widely supported and avoids the need for third-party libraries for this specific functionality.
*   **Conditional Rendering of Share Button**: The "Share Comparison" button is only rendered when both `medicine1` and `medicine2` are present. This decision ensures that the button is only visible and actionable when a valid, complete comparison exists to be shared, improving UX by avoiding confusing or non-functional UI elements.
*   **Encapsulation of Share Logic**: The `shareComparison` function was created as a separate utility within `ComparisonGrid.tsx`. This promotes modularity and keeps the component's render logic cleaner, separating concerns.

## How To Re-Implement (Contributor Reference)

To re-implement the shareable comparison URL feature, a contributor would follow these steps:

1.  **Modify the Comparison Page Component (`apps/web/app/[locale]/compare/page.tsx`)**:
    *   Import `useEffect` from React: `import { useCallback, useEffect, useState } from "react";`
    *   Add a `useEffect` hook at the top level of the `ComparePage` function, ensuring it runs only once on component mount by providing an empty dependency array `[]`.
    *   Inside the `useEffect`, access the URL's query parameters using `const params = new URLSearchParams(window.location.search);`.
    *   Extract the `m1` and `m2` parameter values: `const m1 = params.get("m1");` and `const m2 = params.get("m2");`.
    *   Add a guard clause: `if (!m1 || !m2) return;` to exit if parameters are missing.
    *   Define an `async` function, e.g., `loadMedicines`, within the `useEffect`.
    *   Inside `loadMedicines`, perform a Supabase query to fetch medicine data:
        ```typescript
        const { data, error } = await supabase
            .from("medicines")
            .select(COMPARE_SELECT_FIELDS) // Ensure COMPARE_SELECT_FIELDS is imported/defined
            .in("id", [m1, m2]);
        ```
    *   Handle potential errors or missing data: `if (error || !data) return;`.
    *   Map the raw data to `Medicine` objects: `const medicines = data.map((row) => mapMedicineRow(row as Record<string, unknown>));`.
    *   Find and set the respective medicine states:
        ```typescript
        const first = medicines.find((m) => m.id === m1);
        const second = medicines.find((m) => m.id === m2);
        if (first) setMedicine1(first);
        if (second) setMedicine2(second);
        ```
    *   Call `loadMedicines()` at the end of the `useEffect` block.

2.  **Modify the Comparison Grid Component (`apps/web/src/components/ComparisonGrid.tsx`)**:
    *   Define a new utility function, `shareComparison`, outside the main `ComparisonGrid` component function but within the same file:
        ```typescript
        function shareComparison(medicine1: Medicine | null, medicine2: Medicine | null) {
            if (!medicine1 || !medicine2) return;
            const url = `${window.location.origin}${window.location.pathname}?m1=${medicine1.id}&m2=${medicine2.id}`;
            navigator.clipboard.writeText(url);
        }
        ```
    *   Inside the `ComparisonGrid` component's JSX, add a conditional block to render the "Share Comparison" button:
        ```tsx
        {medicine1 && medicine2 && (
            <div className="flex justify-end border-t border-slate-200 p-4">
                <button
                    type="button"
                    onClick={() => shareComparison(medicine1, medicine2)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                    Share Comparison
                </button>
            </div>
        )}
        ```
    *   Ensure the button is placed logically within the component's layout, for instance, at the bottom of the comparison table.

Dependencies: `react` for `useEffect`, `next-intl` for routing context (though not directly used in the diff, it's part of the page structure), `supabase` client for data fetching, and standard Web APIs (`URLSearchParams`, `navigator.clipboard`).

## Impact on System Architecture

This change primarily impacts the frontend user experience and does not introduce significant architectural shifts to the SahiDawa platform. It leverages existing components, data fetching mechanisms (Supabase), and client-side rendering capabilities of Next.js.

*   **Enhanced User Experience**: The ability to share direct comparison links significantly improves the usability and collaborative potential of the medicine comparison feature.
*   **Increased Discoverability**: Shareable URLs make it easier for users to direct others to specific content, potentially increasing engagement with the comparison tool.
*   **No Backend Changes**: The feature is entirely client-side, relying on existing Supabase API endpoints for medicine data. No changes were required to our backend services or database schema.
*   **Leverages Existing Infrastructure**: It seamlessly integrates with our current Next.js application structure and Supabase data layer without introducing new external dependencies or complex patterns.
*   **Future Development**: This pattern of using URL parameters for deep linking can be extended to other parts of the platform where specific content views might benefit from direct shareability.

## Testing & Verification

The following scenarios were tested to ensure the functionality and robustness of the shareable comparison URLs:

*   **Compare page loads medicines from URL parameters**: Navigating directly to `/compare?m1=<id1>&m2=<id2>` successfully loaded the specified medicines into the comparison grid.
*   **Generated share URL correctly copies to clipboard**: Clicking the "Share Comparison" button copied the expected URL (e.g., `https://<domain>/<locale>/compare?m1=<id1>&m2=<id2>`) to the clipboard.
*   **Shared URL opens the same comparison**: Pasting a copied URL into a new browser tab or window correctly displayed the original comparison.
*   **Missing parameters do not break the page**: Navigating to `/compare` without any parameters, or with only `m1` or `m2`, did not cause errors. The page loaded normally, allowing users to manually select medicines.
*   **Invalid medicine IDs are safely ignored**: If `m1` or `m2` contained non-existent or malformed IDs, the system gracefully ignored them. If one ID was valid and the other invalid, only the valid medicine was loaded, or neither if both were invalid, without crashing the application.
*   **Existing comparison workflow preserved**: The ability to manually search for and add medicines to the comparison grid remained unaffected.