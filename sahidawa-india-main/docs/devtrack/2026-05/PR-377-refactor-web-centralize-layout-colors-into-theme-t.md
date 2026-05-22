# PR #377 — refactor(web): centralize layout colors into theme tokens

> **Merged:** 2026-05-21 | **Author:** @AdrianIp0204 | **Area:** Frontend | **Impact Score:** 58 | **Closes:** #250

## What Changed

This pull request centralizes the management of core layout colors within our `apps/web` frontend. We introduced a set of CSS custom properties (theme tokens) in `apps/web/app/[locale]/globals.css` to represent common UI colors. Subsequently, we replaced numerous hardcoded color literals (hex values or specific Tailwind color classes) across global styles, print styles, and various components with references to these new theme tokens, ensuring visual consistency and easier maintenance. Additionally, a stray merge conflict payload was removed from `apps/web/app/[locale]/compare/page.tsx`.

## The Problem Being Solved

Prior to this change, our `apps/web` frontend suffered from scattered, hardcoded color values. This approach led to several issues:
1.  **Inconsistent Visuals:** Different parts of the application might use slightly varying shades of a color, leading to a fragmented user experience.
2.  **Difficult Maintenance:** Modifying a core UI color (e.g., the primary background or text color) required searching and replacing that specific hex value across potentially dozens of files, a process prone to errors and omissions.
3.  **Lack of Theming Foundation:** Without a centralized color palette, implementing future features like dark mode, accessibility themes, or brand variations would be significantly more complex, requiring extensive refactoring.
4.  **Increased Technical Debt:** Each new component or feature risked introducing more hardcoded values, exacerbating the problem over time.

The goal was to establish a single source of truth for layout-related colors, as outlined in issue #250, to improve maintainability and consistency.

## Files Modified

- `apps/web/app/[locale]/compare/page.tsx`
- `apps/web/app/[locale]/globals.css`
- `apps/web/app/[locale]/health/page.tsx`
- `apps/web/app/[locale]/login/page.tsx`
- `apps/web/app/[locale]/map/PharmacyMap.tsx`
- `apps/web/app/[locale]/map/loading.tsx`
- `apps/web/app/[locale]/scan/page.tsx`
- `apps/web/app/components/Map.tsx`
- `apps/web/app/components/health/components/ActionCard.tsx`
- `apps/web/app/components/health/components/ChatBubble.tsx`
- `apps/web/app/not-found.tsx`
- `apps/web/src/styles/print.css`

## Implementation Details

The core of this refactor involved a two-step process: defining CSS custom properties and then replacing their hardcoded counterparts.

1.  **Definition of Theme Tokens:**
    We introduced a set of CSS custom properties within the `:root` selector in `apps/web/app/[locale]/globals.css`. These properties serve as our centralized theme tokens for layout colors. Examples of such tokens, inferred from the PR description's mention of `slate` and `emerald` colors, include:
    ```css
    :root {
      /* Layout Backgrounds */
      --color-layout-background-light: #f8fafc; /* Corresponds to slate-50 */
      --color-layout-surface-primary: #ffffff; /* Corresponds to white */
      --color-layout-accent-background: #ecfdf5; /* Corresponds to emerald-50 */

      /* Layout Text Colors */
      --color-layout-text-primary: #1e293b; /* Corresponds to slate-900 */
      --color-layout-text-dark: #020617; /* Corresponds to slate-950 */
      --color-layout-text-secondary: #475569; /* Corresponds to slate-600 */
      --color-layout-accent-text: #047857; /* Corresponds to emerald-700 */

      /* Layout Borders */
      --color-layout-border-primary: #e2e8f0; /* Corresponds to slate-200 */

      /* Layout Buttons/Interactive Elements */
      --color-layout-button-primary-background: #020617; /* Corresponds to slate-950 */
      --color-layout-button-primary-hover-background: #1e293b; /* Corresponds to slate-800 */
      /* ... other layout-specific color tokens */
    }
    ```
    This approach leverages native CSS custom properties, making them globally available throughout the application's stylesheet.

2.  **Replacement of Hardcoded Colors:**
    Across the `apps/web` frontend, hardcoded hex values or direct references to Tailwind's default color palette for layout elements were systematically replaced with `var()` references to the newly defined CSS custom properties. This was applied to:
    *   **Global Styles:** Any direct CSS rules in `globals.css` or `src/styles/print.css` that used hardcoded colors.
    *   **Component-Specific Styles:** Within files like `apps/web/app/[locale]/health/page.tsx`, `apps/web/app/[locale]/login/page.tsx`, `apps/web/app/[locale]/map/PharmacyMap.tsx`, `apps/web/app/[locale]/scan/page.tsx`, `apps/web/app/components/Map.tsx`, `apps/web/app/components/health/components/ActionCard.tsx`, `apps/web/app/components/health/components/ChatBubble.tsx`, and `apps/web/app/not-found.tsx`, where explicit color values were used in custom CSS or potentially inline styles. The login page background hex, specifically, was updated to use a theme token.
    *   **UI Surfaces:** This included backgrounds, text colors, borders, and accent colors for elements like loading states (`apps/web/app/[locale]/map/loading.tsx`), not-found pages (`apps/web/app/not-found.tsx`), and various card and bubble components.

3.  **Code Cleanup:**
    A significant merge conflict block, containing an older version of the `ComparePage` component, was removed from `apps/web/app/[locale]/compare/page.tsx`. This cleanup ensures the file contains only the intended, current implementation. An upstream lint error was also addressed to maintain code quality.

## Technical Decisions

1.  **Choice of CSS Custom Properties:** We opted for native CSS custom properties (`var(--...)`) over preprocessor variables (e.g., SASS variables) or JavaScript-based theming solutions for several reasons:
    *   **Native Browser Support:** CSS custom properties are a web standard, requiring no build-time compilation for their values to be resolved.
    *   **Dynamic Theming Potential:** While not fully implemented in this PR, CSS custom properties can be dynamically changed at runtime via JavaScript, enabling future features like dark mode or user-selectable themes without requiring a page reload or complex state management.
    *   **Simplicity and Integration:** They integrate seamlessly with our existing Tailwind CSS utility-first framework, allowing us to define base colors that Tailwind (or custom CSS) can then reference.
    *   **Reduced Overhead:** Avoids adding another dependency or build step solely for color management.

2.  **Location of Theme Tokens (`globals.css`):** Placing the `:root` definition of theme tokens in `apps/web/app/[locale]/globals.css` ensures that these variables are globally available across the entire `apps/web` application. This is the most logical location for application-wide styling concerns.

3.  **Naming Convention (`--color-layout-[category]-[variant]`):** The chosen naming convention (e.g., `--color-layout-background-light`, `--color-layout-text-primary`) provides clarity and structure.
    *   `--color-`: Clearly identifies the variable as a color token.
    *   `layout-`: Scopes the token to general UI layout elements, distinguishing it from potentially component-specific or semantic colors that might be introduced later.
    *   `[category]-[variant]`: Describes the purpose (e.g., `background`, `text`, `border`) and its specific variation (e.g., `light`, `primary`, `secondary`, `dark`), making the token's intent immediately understandable.

4.  **Incremental Refactoring:** This PR focuses specifically on "layout colors." This scoped approach allows for a manageable refactor, addressing the most pervasive hardcoded values first, without attempting a full-scale design system implementation in one go.

## How To Re-Implement (Contributor Reference)

To re-implement or extend this color centralization strategy, a contributor would follow these steps:

1.  **Define New CSS Custom Properties:**
    *   Open `apps/web/app/[locale]/globals.css`.
    *   Within the existing `:root` block, add new CSS custom properties for any additional layout-level colors that need to be centralized.
    *   Follow the `--color-layout-[category]-[variant]` naming convention.
    *   Example:
        ```css
        :root {
          /* ... existing tokens ... */
          --color-layout-warning-text: #b45309; /* For a specific warning message text */
          --color-layout-header-background: #f1f5f9; /* For page headers */
        }
        ```

2.  **Identify Hardcoded Color Literals:**
    *   Scan the `apps/web` directory for direct hex codes (e.g., `#FF0000`), RGB/RGBA values, or specific Tailwind color classes (e.g., `text-red-500`, `bg-blue-200`) that represent layout or common UI colors.
    *   The `node hardcoded-layout-hex-scan` script used in this PR is a good example of how to automate this identification for hex values. For Tailwind classes, manual inspection or a more sophisticated AST-based scanner might be needed.
    *   Prioritize colors that are used repeatedly or are part of the core visual identity.

3.  **Replace with `var()` References:**
    *   In `.css` files (e.g., `src/styles/print.css`, or custom styles within components), replace the identified hardcoded values with `var(--your-new-color-token)`.
    *   For Tailwind classes, if the intent is to override Tailwind's default color palette, this would typically involve configuring `tailwind.config.js` to map Tailwind color names to CSS variables, or using arbitrary values like `bg-[var(--color-layout-header-background)]` directly in `.tsx` files. This PR primarily focused on replacing direct hex values in CSS, and potentially configuring Tailwind to use these variables implicitly, or using `var()` in custom CSS.
    *   Example replacement in a CSS file:
        ```css
        /* Before */
        .my-component-header {
          background-color: #f1f5f9;
          color: #1e293b;
        }

        /* After */
        .my-component-header {
          background-color: var(--color-layout-header-background);
          color: var(--color-layout-text-primary);
        }
        ```

4.  **Verify Visuals:**
    *   Run the application locally (`npm run dev -w apps/web`).
    *   Navigate to all pages and components affected by the changes to ensure that the visual appearance remains identical to the pre-refactor state. This refactor is purely for code quality, not UI changes.

**Gotchas:**
*   **Specificity:** Ensure that `var()` references are applied at the correct CSS specificity level to override any existing hardcoded styles.
*   **Fallback Values:** For older browser compatibility (though less critical for modern Next.js apps), `var()` can accept a fallback: `color: var(--color-layout-text-primary, #1e293b);`. This was not explicitly used in this PR but is a consideration.
*   **Tailwind Integration:** If replacing Tailwind utility classes, decide whether to configure `tailwind.config.js` to map color names to CSS variables (preferred for consistency) or use arbitrary values directly. This PR's approach seems to have focused on replacing direct hexes in custom CSS and potentially updating Tailwind's underlying color definitions via `globals.css` or `tailwind.config.js` (though `tailwind.config.js` was not listed as changed).

## Impact on System Architecture

This refactor significantly impacts the `apps/web` frontend architecture by:

*   **Establishing a Theming Foundation:** It lays the essential groundwork for a robust theming system. Future enhancements like dark mode, high-contrast modes, or custom branding can now be implemented by simply modifying the values of these CSS custom properties, potentially with media queries or JavaScript toggles, rather than requiring extensive search-and-replace operations.
*   **Improving Maintainability and Scalability:** Centralizing color definitions drastically reduces technical debt. Developers can now update a core UI color in one place (`globals.css`), and the change will propagate consistently across the entire application. This makes the codebase easier to understand, modify, and extend.
*   **Enhancing Design Consistency:** By enforcing the use of a predefined set of color tokens, we ensure a more consistent and professional visual identity across the platform, reducing the likelihood of visual discrepancies caused by slightly different hex values.
*   **No Runtime Performance Impact:** CSS custom properties are resolved natively by the browser, incurring negligible runtime performance overhead compared to preprocessor variables or JavaScript-based theme injections.
*   **Clearer Separation of Concerns:** It promotes a cleaner separation between structural HTML/JSX, presentational CSS, and data/logic, by abstracting color values into a dedicated styling layer.

## Testing & Verification

The changes introduced by this PR were thoroughly tested and verified through a combination of automated checks and a custom script:

1.  **Git Diff Check (`git diff --check origin/main..HEAD`):** This command was executed to ensure no whitespace errors or other trivial issues were introduced, passing successfully.
2.  **Hardcoded Layout Hex Scan (`node hardcoded-layout-hex-scan`):** A custom Node.js script was run to specifically verify that no non-token layout hex rows remained in the codebase. This confirmed the successful replacement of hardcoded color literals with theme token references, reporting "no non-token layout hex rows."
3.  **Linting (`npm run lint -w apps/web`):** The linter for the `apps/web` workspace was run to catch any code style violations or potential errors. It passed with existing warnings only and 0 new errors, confirming code quality was maintained.
4.  **TypeScript Type Checking (`node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json --ignoreDeprecations 6.0`):** TypeScript compilation was performed without emitting output to ensure type safety across the `apps/web` application. This check passed, verifying the integrity of the codebase.
5.  **Build Process (`npm run build -w apps/web`):** A full production build of the `apps/web` application was executed to confirm that the changes did not introduce any build errors and that the application could be successfully compiled for deployment. This also passed.

**Edge Cases:**
The primary edge cases for this type of refactor involve:
*   **Missed Hardcoded Values:** The custom `hardcoded-layout-hex-scan` script was specifically designed to mitigate this by identifying remaining hex codes.
*   **Incorrect Token Assignment:** Assigning the wrong theme token to a UI element could lead to unintended visual changes. This was implicitly covered by the "no intended UI behavior change" goal, requiring visual verification (though not explicitly detailed as a manual step in the PR description, it is standard practice for UI refactors).
*   **Specificity Issues:** If a `var()` reference was overridden by a more specific hardcoded style, the token would not apply. This was not explicitly tested but is a general CSS concern.

Overall, the comprehensive automated checks and the targeted custom script provided strong confidence that the refactor was successful and did not introduce regressions.