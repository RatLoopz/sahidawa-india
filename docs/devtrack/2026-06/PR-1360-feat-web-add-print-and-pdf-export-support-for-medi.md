# PR #1360 — feat(web): add print and PDF export support for medicine comparison

> **Merged:** 2026-06-06 | **Author:** @Avinash-sdbegin | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #1295

## What Changed

This pull request introduces native browser print and PDF export functionality to the Medicine Price Comparison page. Users can now generate a printable report of their selected medicine comparisons, complete with SahiDawa branding and a generation date, while non-essential UI elements are hidden for a cleaner output.

## The Problem Being Solved

Prior to this change, users of the SahiDawa platform lacked a direct and convenient way to export or print the results of their medicine price comparisons. This meant that sharing comparison data with healthcare providers, family members, or simply retaining a physical record for personal reference was cumbersome, often requiring manual screenshots or copy-pasting, which lacked structure and official branding.

## Files Modified

- `apps/web/app/[locale]/compare/page.tsx`

## Implementation Details

The implementation focuses on leveraging browser-native capabilities for printing and PDF generation, minimizing external dependencies.

1.  **Print Button Addition**: A new "Print / Export PDF" button is added within the `apps/web/app/[locale]/compare/page.tsx` component. This button is conditionally rendered only when both `medicine1` and `medicine2` are selected, ensuring it only appears when there is actual comparison data to print.
2.  **Native Print Trigger**: The button's `onClick` handler directly calls `window.print()`. This JavaScript function triggers the browser's built-in print dialog, allowing users to print to a physical printer or save as a PDF using their operating system's print-to-PDF functionality.
3.  **Print-Specific Header**: A new `div` element is introduced at the top of the `ComparePage` component. This `div` is styled with `hidden text-center print:block`, meaning it is hidden by default in the normal web view but becomes visible (`block`) only when the page is being printed. It contains:
    *   A prominent `h1` with "SahiDawa Medicine Comparison Report".
    *   A `p` tag displaying the report generation date using `new Date().toLocaleDateString()`.
4.  **UI Element Hiding for Print**: To ensure a clean, report-like output, several non-essential UI elements are hidden during the print process using the `print:hidden` Tailwind CSS utility class:
    *   The main `PageHeader` component, which includes the page title, subtitle, and back button.
    *   The `section` containing the `MedicineSearchSelect` components for selecting medicines.
    *   The "Print / Export PDF" button itself, to prevent it from appearing in the printed output.
    *   The `p` tag containing the `Link` to the map page.
5.  **Styling**: Tailwind CSS utility classes, specifically the `print:` prefix, are used extensively to control the visibility and styling of elements based on the print media type. For example, `print:hidden` hides an element during printing, while `print:block` makes it visible.

## Technical Decisions

1.  **Leveraging `window.print()`**: We opted for `window.print()` because it provides a lightweight, browser-native solution for printing and PDF export without introducing any third-party PDF generation libraries (e.g., jsPDF, html2pdf.js). This keeps our bundle size small, reduces maintenance overhead, and relies on robust, well-tested browser functionality.
2.  **Tailwind CSS `print:` Utilities**: Using Tailwind's `print:` variant for responsive design allows us to define print-specific styles directly within our component's JSX. This approach is highly efficient for simple print layouts, as it avoids the need for a separate `print.css` stylesheet and keeps print-related styling co-located with the components they affect, improving readability and maintainability.
3.  **Conditional Button Rendering**: The "Print / Export PDF" button is only displayed when both `medicine1` and `medicine2` are selected. This decision was made to improve user experience by only presenting the print option when there is meaningful data to export, preventing users from attempting to print an empty comparison.
4.  **Dedicated Print Header**: A custom header was created for the print output instead of reusing the existing `PageHeader`. This allows for specific branding ("SahiDawa Medicine Comparison Report") and contextual information (generation date) that is more appropriate for a standalone report, distinguishing it from the interactive web page header.

## How To Re-Implement (Contributor Reference)

To re-implement a similar print/export feature for another page:

1.  **Identify Target Component**: Locate the React component (`.tsx` file) for the page where print functionality is desired (e.g., `apps/web/app/[locale]/[your-page]/page.tsx`).
2.  **Add Print Button**:
    *   Within the component's render method, add a `<button>` element.
    *   Set its `onClick` handler to `() => window.print()`.
    *   Apply appropriate styling (e.g., `rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700`).
    *   Crucially, add the `print:hidden` Tailwind class to this button so it doesn't appear in the printed output.
    *   Consider conditional rendering for the button based on the presence of data to be printed (e.g., `{dataExists && <button ...>}`).
3.  **Create Print-Only Header**:
    *   At the top of the main content area, add a `div` element.
    *   Apply `hidden text-center print:block` classes to make it visible only during printing.
    *   Inside this `div`, include your desired report title (e.g., `<h1 className="text-2xl font-bold">Your Report Title</h1>`) and dynamic information like the generation date (`<p className="text-sm">Generated on {new Date().toLocaleDateString()}</p>`).
4.  **Hide Non-Essential UI Elements**:
    *   Identify any elements that should *not* appear in the printed report (e.g., navigation bars, search inputs, interactive controls, footers that are not part of the report).
    *   Add the `print:hidden` Tailwind class to the root `div` or component of each of these elements. For example, if your `PageHeader` component is rendered, wrap it in a `div` with `print:hidden` or ensure the `PageHeader` itself accepts and applies this class.
5.  **Test**: Open the page in a browser, trigger the print function (Ctrl+P or Cmd+P), and review the print preview to ensure all desired elements are visible/hidden correctly and the layout is acceptable.

## Impact on System Architecture

This change has a minimal impact on the overall SahiDawa system architecture. It is a purely frontend feature, confined to the `apps/web` Next.js application. It does not introduce new backend APIs, database schema changes, or complex state management. The primary impact is an enhancement to the user experience by providing a standard way to export comparison data. This sets a precedent for using native browser print capabilities for other report-like views within the platform, potentially reducing the need for more complex server-side PDF generation or client-side PDF libraries in the future for simple export needs.

## Testing & Verification

Verification of this feature involved manual testing within a web browser.

1.  **Button Visibility**: We verified that the "Print / Export PDF" button only appears when two medicines (`medicine1` and `medicine2`) have been successfully selected in the comparison interface. When fewer than two medicines are selected, the button remains hidden.
2.  **Print Trigger**: Clicking the button successfully invoked the browser's native print dialog.
3.  **Print Preview Content**: In the print preview, we confirmed:
    *   The custom "SahiDawa Medicine Comparison Report" header and the "Generated on [Date]" text were visible and correctly formatted.
    *   The main `PageHeader` (with "Medicine Comparison" title), the medicine search input section, the print button itself, and the link to the map page were all correctly hidden.
    *   The `ComparisonGrid` containing the actual medicine data was fully visible and laid out appropriately for printing.
4.  **PDF Export**: We tested the "Save as PDF" option within the browser's print dialog to ensure a functional PDF document was generated, reflecting the print preview's content and layout.

Edge cases considered include the state where no medicines are selected (button is hidden, as designed) and the behavior across different modern browsers (which generally handle `window.print()` and media queries consistently). No specific automated tests were added for this UI-centric print functionality, relying on manual verification of the browser's native capabilities.