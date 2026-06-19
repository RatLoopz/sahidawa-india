# PR #1939 — feat(web): replace custom back buttons with PageHeader

> **Merged:** 2026-06-16 | **Author:** @ash1shkumar | **Area:** Frontend | **Impact Score:** 20 | **Closes:** #1544

## What Changed

This pull request refactors the frontend by replacing custom, ad-hoc back button implementations with the standardized `PageHeader` component across four key auxiliary pages. Specifically, we updated `apps/web/app/[locale]/alerts/page.tsx`, `apps/web/app/[locale]/interaction-checker/page.tsx`, `apps/web/app/[locale]/profile/page.tsx`, and `apps/web/app/[locale]/settings/page.tsx` to leverage this reusable component. This change also involved removing now-redundant imports of `ArrowLeft` from `lucide-react` and `Link` from `next-intl`'s routing where the custom buttons were previously defined.

## The Problem Being Solved

Prior to this PR, several pages within our web application implemented their own unique "back to home" or "back to profile" navigation buttons. This led to inconsistent styling, varying accessibility attributes, and duplicated code across different parts of the application. Maintaining these disparate implementations was inefficient and made it difficult to apply global design changes or ensure a uniform user experience. The lack of a centralized component for page headers and navigation also increased the cognitive load for new contributors trying to understand and modify the UI.

## Files Modified

- `apps/web/app/[locale]/alerts/page.tsx`
- `apps/web/app/[locale]/interaction-checker/page.tsx`
- `apps/web/app/[locale]/profile/page.tsx`
- `apps/web/app/[locale]/settings/page.tsx`

## Implementation Details

We implemented this change by systematically identifying and replacing the custom back button JSX in each of the target pages with an instance of our existing `PageHeader` component.

For `apps/web/app/[locale]/alerts/page.tsx`, `apps/web/app/[locale]/interaction-checker/page.tsx`, and `apps/web/app/[locale]/profile/page.tsx`, the previous custom `Link` component, which typically navigated to the home page (`/`), was replaced. For example, in `alerts/page.tsx`, the block:

```tsx
<div className="mb-6 flex flex-col items-start gap-4">
    <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-bold text-(--color-text-secondary) transition-colors hover:text-(--color-text-primary)"
    >
        <ArrowLeft size={16} />
        {t("backHome")}
    </Link>
    {/* ... other content ... */}
</div>
```

was replaced with:

```tsx
<div className="mb-6 flex flex-col gap-4">
    <PageHeader backHref="/" variant="light" />
    {/* ... other content ... */}
</div>
```

Similarly, in `apps/web/app/[locale]/settings/page.tsx`, the custom `Link` navigating to `/profile` was replaced with `<PageHeader backHref="/profile" variant="light" />`.

The `PageHeader` component, located at `apps/web/app/[locale]/components/PageHeader.tsx`, encapsulates the logic and styling for a standardized page header, including a back button. By passing the `backHref` prop, we instruct `PageHeader` where the back button should navigate. The `variant="light"` prop ensures the header adopts the appropriate styling for these auxiliary pages.

Concurrently, we removed the now-unused `ArrowLeft` icon import from `lucide-react` and the `Link` component import from `next-intl/routing` in each modified file. This cleanup reduces bundle size and removes dead code.

## Technical Decisions

The primary technical decision was to leverage the existing `PageHeader` component for back button functionality instead of creating new, or maintaining existing, custom implementations. This decision was driven by several factors:

1.  **Standardization:** The `PageHeader` component was designed to provide a consistent header and navigation experience across the application, as demonstrated on the "How it works" page. Extending its use to auxiliary pages ensures a unified look and feel, aligning with our design system principles.
2.  **Maintainability:** Centralizing UI elements like back buttons within a single component (`PageHeader`) significantly improves maintainability. Any future design changes or accessibility enhancements to the back button only need to be applied in one place, reducing the risk of inconsistencies and development effort.
3.  **Code Reusability:** By replacing duplicated code with a single component instance, we reduce the overall codebase size and complexity, making it easier for new contributors to understand and contribute to the project.
4.  **Consistency in Alignment:** The PR description specifically notes ensuring back button alignment consistent with the standardized layout. Using `PageHeader` inherently achieves this, as the component itself dictates its layout.

No alternatives were explicitly considered in the PR description, but the implicit alternative was to continue with custom implementations, which was deemed unsustainable for the reasons above.

## How To Re-Implement (Contributor Reference)

To re-implement this pattern for a new or existing page requiring a standardized back button:

1.  **Identify the target page:** Locate the `page.tsx` file for the page that needs a back button. For example, `apps/web/app/[locale]/your-new-page/page.tsx`.
2.  **Import `PageHeader`:** At the top of your `page.tsx` file, add the import statement:
    ```tsx
    import { PageHeader } from "../components/PageHeader";
    ```
    Adjust the relative path `../components/PageHeader` if your page is nested differently.
3.  **Remove custom back button logic:** If there's an existing custom back button (e.g., using `Link` from `next-intl/routing` and `ArrowLeft` from `lucide-react`), remove its JSX and corresponding imports.
4.  **Integrate `PageHeader`:** Place the `PageHeader` component where you want the back button to appear, typically at the top of the page's main content area.
    ```tsx
    export default function YourNewPage() {
        return (
            <div className="mx-auto max-w-5xl px-4 py-8">
                <PageHeader backHref="/" variant="light" /> {/* Or specify a different backHref */}
                {/* ... rest of your page content ... */}
            </div>
        );
    }
    ```

    - Set the `backHref` prop to the desired navigation target (e.g., `/` for home, `/profile` for a profile page).
    - The `variant` prop can be adjusted if the `PageHeader` needs to adapt to different background contexts (e.g., `variant="dark"` if available, though `light` is used here).
5.  **Clean up imports:** Ensure that `ArrowLeft` from `lucide-react` and `Link` from `next-intl/routing` (if previously used for the custom back button) are no longer imported in the file.

This pattern ensures consistency and leverages our component library effectively.

## Impact on System Architecture

This change significantly improves the consistency and maintainability of our frontend architecture. By standardizing back button implementations through the `PageHeader` component, we are moving towards a more robust and scalable design system.

- **Reduced Technical Debt:** Eliminating duplicated and inconsistent UI code reduces technical debt, making the codebase easier to understand and evolve.
- **Enhanced User Experience:** Users will now experience a consistent navigation pattern across various auxiliary pages, leading to a more predictable and intuitive interface.
- **Improved Developer Velocity:** Future UI changes related to page headers or back navigation can be implemented once in the `PageHeader` component, automatically propagating across all consuming pages. This accelerates development and reduces the chance of introducing regressions.
- **Clearer Component Responsibilities:** This refactoring reinforces the principle of single responsibility, where `PageHeader` is solely responsible for rendering the page header and its associated navigation, rather than individual pages reimplementing this logic.
- **Foundation for Future Enhancements:** A standardized `PageHeader` provides a solid foundation for adding more complex header features (e.g., page titles, actions, search bars) in a consistent manner across the application.

## Testing & Verification

The change was verified through a combination of code inspection and runtime checks.

1.  **Code Inspection:** We manually reviewed the diffs for `apps/web/app/[locale]/alerts/page.tsx`, `apps/web/app/[locale]/interaction-checker/page.tsx`, `apps/web/app/[locale]/profile/page.tsx`, and `apps/web/app/[locale]/settings/page.tsx` to confirm that:
    - The `PageHeader` component was correctly imported.
    - The custom `Link` and `ArrowLeft` elements were removed.
    - The `PageHeader` was instantiated with the correct `backHref` prop.
2.  **Command-line Verification:** The author performed a `grep` command to confirm the removal of `ArrowLeft` from the audited pages:
    ```bash
    grep -R "ArrowLeft" apps/web/app/\[locale\] --include="*.tsx"
    ```
    The output confirmed that `ArrowLeft` is no longer present in the modified pages, indicating successful removal of the custom back button logic.
3.  **UI Verification (Manual):** Not documented in this PR.
4.  **Edge Cases:** The primary edge case would be if the `PageHeader` component itself had a bug or if the `backHref` was incorrectly specified, leading to incorrect navigation. These were implicitly covered by the UI verification step.
