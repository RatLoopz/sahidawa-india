# PR #1215 — fix(web): refine live alerts panel batch display

> **Merged:** 2026-06-04 | **Author:** @shashank03-dev | **Area:** Frontend | **Impact Score:** 12 | **Closes:** #1178

## What Changed

This pull request significantly refines the visual presentation and data display logic of the Live CDSCO Alerts panel on the SahiDawa homepage. We removed the glassmorphism blur effect, updated the panel's styling to use solid surfaces with tighter borders and spacing, and introduced a new utility function to intelligently display batch numbers only when they are valid and not redundant within the alert's composition text.

## The Problem Being Solved

Before this PR, the Live CDSCO Alerts panel on our homepage suffered from several UI/UX inconsistencies and a specific data display bug. The panel's aesthetic, characterized by a `backdrop-blur-md` and translucent backgrounds (e.g., `bg-white/70`), did not align with our desired cleaner, more modern design language, as indicated by maintainer reference images. Functionally, the display of batch numbers (`· Batch <number>`) was problematic: it would render even when no valid batch number was provided, or redundantly when the batch number was already explicitly mentioned within the alert's `composition` text. This led to awkward text wrapping, visual clutter, and a less professional user experience for critical health alerts.

## Files Modified

- `apps/web/app/[locale]/page.tsx`
- `apps/web/lib/alertFormatting.ts`
- `apps/web/tests/homepage-i18n.test.tsx`

## Implementation Details

Our system implemented the following changes to address the identified issues:

**1. Styling Refinement in `apps/web/app/[locale]/page.tsx`:**
The primary visual changes were applied to the Live CDSCO Alerts panel's container and its child elements.

- The main panel `div`'s `className` was updated from `border border-slate-200/50 bg-white/70 shadow-sm backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/50` to `border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900`. This change removes the `backdrop-blur-md` and replaces translucent backgrounds with solid white/dark-900, while also tightening the border opacity.
- The header `div`'s `className` was changed from `border-b border-white/30 bg-white/20 dark:border-white/10 dark:bg-slate-800/20` to `border-b border-slate-200/80 bg-slate-50 px-6 py-5 dark:border-slate-800/80 dark:bg-slate-950`. This introduces a slightly contrasting solid background for the header.
- The content area `div`'s `className` was updated from `bg-(--color-surface-muted)/30 p-4` to `bg-slate-50 p-4 dark:bg-slate-950`, removing translucency from the background where alert cards are displayed.
- The grid gap for alert cards was increased from `gap-3` to `gap-4` to provide more breathing room between alerts.
- Individual alert cards (both skeleton loaders and actual alert items) had their `className`s updated from `border border-(--color-border-muted) bg-(--color-surface-page)` to `border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900`. This standardizes their appearance with solid backgrounds and refined borders.
- The `transition-all` duration for alert card hovers was reduced from `duration-200` to `duration-150` for a snappier visual feedback, and hover border colors were adjusted (`hover:border-slate-400/30` to `hover:border-slate-300`, with `dark:hover:border-slate-700` added for dark mode).

**2. Batch Number Formatting Utility (`apps/web/lib/alertFormatting.ts`):**
A new TypeScript utility file was created to encapsulate the logic for determining whether a batch number should be displayed.

- The file `apps/web/lib/alertFormatting.ts` exports a function `getVisibleAlertBatchNumber(composition: string | null | undefined, batchNumber: string | null | undefined): string | null`.
- This function first performs null/undefined/empty string checks on `batchNumber`. If `batchNumber` is falsy or consists only of whitespace after trimming, it immediately returns `null`.
- Next, it checks if the `composition` string (if present) already contains the `batchNumber` (performing a case-insensitive comparison using `toLowerCase().includes()`). If the batch number is found within the composition, the function returns `null` to prevent redundant display.
- If neither of the above conditions is met, the function returns the original `batchNumber` string, indicating it should be displayed.

**3. Integration in `apps/web/app/[locale]/page.tsx`:**

- The `getVisibleAlertBatchNumber` function is imported into `apps/web/app/[locale]/page.tsx`.
- Within the `homepageAlerts.map` loop, for each `alert` object, we now call `const visibleBatchNumber = getVisibleAlertBatchNumber(alert.composition, alert.batch_number);`.
- The rendering logic for the batch number suffix (`· Batch <number>`) then conditionally uses this `visibleBatchNumber`. If `visibleBatchNumber` is not `null`, the batch number is rendered; otherwise, it is omitted, ensuring a cleaner and more accurate display. (The exact rendering JSX for the batch number is not present in the provided diff, but its usage is implied by the `visibleBatchNumber` variable assignment).

**4. Testing in `apps/web/tests/homepage-i18n.test.tsx`:**

- New regression tests were added to `apps/web/tests/homepage-i18n.test.tsx` to specifically cover the `getVisibleAlertBatchNumber` utility. These tests validate its behavior across various scenarios, including null, undefined, empty, whitespace-only, numeric, and already-included batch numbers, as well as cases with null or undefined composition strings.

## Technical Decisions

- **Modular Utility Function:** We decided to extract the batch number formatting logic into a dedicated utility function, `getVisibleAlertBatchNumber`, within `apps/web/lib/alertFormatting.ts`. This promotes modularity, improves code readability in the main `page.tsx` component, and makes the logic independently testable. This aligns with our goal of maintaining a clean, component-focused architecture.
- **Direct TailwindCSS for UI:** Instead of relying on `backdrop-blur-md` and translucent `bg-white/xx` classes, we opted for solid background colors and explicit border definitions using direct TailwindCSS classes (e.g., `bg-white`, `dark:bg-slate-900`, `border-slate-200/80`). This simplifies the CSS, potentially improves rendering performance, and achieves the desired cleaner, more defined visual style as per design specifications.
- **Case-Insensitive Batch Number Check:** The decision to perform a case-insensitive check when determining if a batch number is already present in the `composition` text (using `toLowerCase()`) ensures robustness. This prevents redundant display even if the batch number appears with different casing in the composition string.
- **Early Exit for Invalid Batch Numbers:** The `getVisibleAlertBatchNumber` function uses early exit conditions for null, undefined, or empty batch numbers. This optimizes performance by avoiding unnecessary string operations and simplifies the logic flow.

## How To Re-Implement (Contributor Reference)

To re-implement this feature from scratch, a contributor would follow these steps:

1.  **Create the Alert Formatting Utility:**
    - Create a new file: `apps/web/lib/alertFormatting.ts`.
    - Add the `getVisibleAlertBatchNumber` function:

        ```typescript
        export function getVisibleAlertBatchNumber(
            composition: string | null | undefined,
            batchNumber: string | null | undefined
        ): string | null {
            // 1. Check for invalid batchNumber
            if (!batchNumber || batchNumber.trim() === "") {
                return null;
            }

            // 2. Check if batchNumber is already in composition (case-insensitive)
            if (composition && composition.toLowerCase().includes(batchNumber.toLowerCase())) {
                return null;
            }

            // 3. If valid and not redundant, return the batchNumber
            return batchNumber;
        }
        ```

2.  **Update the Homepage Component:**
    - Open `apps/web/app/[locale]/page.tsx`.
    - Import the new utility function at the top of the file:
        ```typescript
        import { getVisibleAlertBatchNumber } from "@/lib/alertFormatting";
        ```
    - Locate the Live CDSCO Alerts panel section.
    - **Modify the main panel container's `className`:**
        ```diff
        - <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/50 bg-white/70 shadow-sm backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/50">
        + <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
        ```
    - **Modify the header `div`'s `className`:**
        ```diff
        - <div className="flex items-center justify-between border-b border-white/30 bg-white/20 px-6 py-5 dark:border-white/10 dark:bg-slate-800/20">
        + <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50 px-6 py-5 dark:border-slate-800/80 dark:bg-slate-950">
        ```
    - **Modify the content area `div`'s `className`:**
        ```diff
        - <div className="flex-1 overflow-y-auto bg-(--color-surface-muted)/30 p-4">
        + <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950">
        ```
    - **Adjust the grid gap for alert cards:**
        ```diff
        - <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        + <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        ```
    - **Inside the `homepageAlerts.map` loop**, locate the `div` for each alert item.
        - Update its `className` for styling and hover effects:
            ```diff
            - <div key={alert.id} className="group relative flex cursor-pointer items-start gap-4 overflow-hidden rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400/30 hover:shadow-md">
            + <div key={alert.id} className="group relative flex cursor-pointer items-start gap-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900 dark:hover:border-slate-700">
            ```
        - Within the same loop, before the alert's details are rendered, call the new utility:
            ```typescript
            const visibleBatchNumber = getVisibleAlertBatchNumber(
                alert.composition,
                alert.batch_number
            );
            ```
        - Then, conditionally render the batch number suffix using `visibleBatchNumber`. For example, if the batch number was part of a `<span>` or `div` within the alert card:
            ```html
            {/* ... other alert details ... */}
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                    <h4 className="leading-tight font-bold text-(--color-text-primary)">
                        {alert.brand_name}
                    </h4>
                    <span className="shrink-0 text-[11px] font-medium text-(--color-text-muted)">
                        {formatRelativeTime(alert.created_at)}
                    </span>
                </div>
                {/* Assuming batch number was rendered here, modify it */} {visibleBatchNumber && (
                <p className="text-sm text-(--color-text-secondary) mt-1">
                    {alert.composition} &middot; Batch {visibleBatchNumber}
                </p>
                )} {!visibleBatchNumber && (
                <p className="text-sm text-(--color-text-secondary) mt-1">{alert.composition}</p>
                )}
            </div>
            {/* ... rest of the alert card ... */}
            ```
            (Note: The exact JSX for rendering the batch number is not in the provided diff, but this pattern demonstrates how `visibleBatchNumber` would be used.)

3.  **Add Regression Tests:**
    - Open `apps/web/tests/homepage-i18n.test.tsx`.
    - Add a new `describe` block or extend an existing one to include tests for `getVisibleAlertBatchNumber`:

        ```typescript
        import { getVisibleAlertBatchNumber } from "../lib/alertFormatting"; // Adjust path as needed

        describe("getVisibleAlertBatchNumber", () => {
            it("should return null if batchNumber is null", () => {
                expect(getVisibleAlertBatchNumber("Some composition", null)).toBeNull();
            });

            it("should return null if batchNumber is undefined", () => {
                expect(getVisibleAlertBatchNumber("Some composition", undefined)).toBeNull();
            });

            it("should return null if batchNumber is an empty string", () => {
                expect(getVisibleAlertBatchNumber("Some composition", "")).toBeNull();
            });

            it("should return null if batchNumber is only whitespace", () => {
                expect(getVisibleAlertBatchNumber("Some composition", "   ")).toBeNull();
            });

            it("should return batchNumber if it is valid and not in composition", () => {
                expect(getVisibleAlertBatchNumber("Some composition", "BATCH123")).toBe("BATCH123");
            });

            it("should return null if batchNumber is already in composition (case-insensitive)", () => {
                expect(
                    getVisibleAlertBatchNumber("Product with batch: batch123", "BATCH123")
                ).toBeNull();
                expect(
                    getVisibleAlertBatchNumber("Product with Batch: bAtCh123", "batch123")
                ).toBeNull();
            });

            it("should return batchNumber if composition is null", () => {
                expect(getVisibleAlertBatchNumber(null, "BATCH123")).toBe("BATCH123");
            });

            it("should return batchNumber if composition is undefined", () => {
                expect(getVisibleAlertBatchNumber(undefined, "BATCH123")).toBe("BATCH123");
            });
        });
        ```

4.  **Verify Locally:**
    - Run `npm install` within `apps/web`.
    - Start the development server: `npm run dev -w web`.
    - Navigate to the homepage and visually inspect the Live CDSCO Alerts panel for the new styling.
    - Use mocked data (as done in the original PR) to test alerts with missing, redundant, and valid batch numbers to confirm correct conditional display.
    - Run the new tests: `npm test -w web -- homepage-i18n.test.tsx`.
    - Perform type checking: `cd apps/web && npx tsc --noEmit`.
    - Build the project: `npm run build -w web`.

## Impact on System Architecture

This change primarily impacts the frontend presentation layer of the SahiDawa web application. It does not introduce new backend APIs, database schema changes, or complex state management patterns. The introduction of `apps/web/lib/alertFormatting.ts` is a positive architectural step, promoting better modularity and reusability for frontend utility functions. This pattern encourages the creation of small, focused, and easily testable modules, which contributes to a more maintainable and scalable frontend codebase. The refined UI/UX for the Live CDSCO Alerts panel enhances the overall professionalism and trustworthiness of the SahiDawa platform, which is crucial for a health-related application. It sets a precedent for future UI component design, moving towards a cleaner, more consistent visual language.

## Testing & Verification

Our system ensured the quality of this change through a combination of unit tests and local, visual verification:

- **Unit Testing:** The newly introduced `getVisibleAlertBatchNumber` utility function received comprehensive regression coverage. Tests were added to `apps/web/tests/homepage-i18n.test.tsx` to validate its behavior for all critical edge cases:
    - `batchNumber` being `null`, `undefined`, or an empty string.
    - `batchNumber` consisting solely of whitespace characters.
    - `batchNumber` being a valid numeric string that is _not_ present in the `composition` text.
    - `batchNumber` being a valid numeric string that _is_ already present within the `composition` text (tested with case-insensitivity).
    - `composition` itself being `null` or `undefined` to ensure graceful handling.
- **Local Verification:** The author performed thorough local testing by running the Next.js development server.
- **Mocked Data for UI Testing:** Crucially, the visual and functional aspects of the alert panel were verified using mocked Supabase REST responses. This allowed for precise control over the data displayed in the alert panel, enabling the author to confirm that all three identified issue cases were correctly addressed:
    - Batch numbers were appended correctly when they were valid and not redundant.
    - Batch numbers were suppressed when they were already included in the alert's `composition`.
    - Batch numbers were suppressed when they were missing or invalid.
- **Code Quality Checks:** Standard development checks were performed, including `eslint` for linting, `npx tsc --noEmit` for TypeScript type checking, and `npm run build -w web` for a full production build, ensuring no new errors or warnings were introduced.
- **Edge Cases:** The primary edge cases for batch number display (null/empty/whitespace batch, batch already in composition) are explicitly covered by the new utility and its dedicated tests. The UI changes were visually confirmed against design specifications via screenshots.
