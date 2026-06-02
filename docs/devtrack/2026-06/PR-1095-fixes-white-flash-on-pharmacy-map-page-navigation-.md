# PR #1095 — fixes White flash on Pharmacy Map page navigation in dark theme

> **Merged:** 2026-06-01 | **Author:** @ravichandra14 | **Area:** Frontend | **Impact Score:** 15 | **Closes:** #1087

## What Changed

This pull request addresses a visual bug where users experienced a "white flash" when navigating to the Pharmacy Map page while the SahiDawa application was in dark theme. We have updated the styling of various UI components within the `PharmacyMap.tsx` and `loading.tsx` files to ensure they are theme-aware, primarily by replacing hardcoded `bg-slate-*` and `text-slate-*` Tailwind CSS classes with our custom CSS variables (e.g., `bg-(--color-surface-muted)`) and explicit `dark:bg-*` variants.

## The Problem Being Solved

Prior to this PR, when a user navigated to the Pharmacy Map page (`/map`) while the application's dark theme was active, there was a noticeable "white flash" during the page load and rendering of the map components. This occurred because several elements, including the map's error state container, the loading skeleton, and the overall page loading state, were styled with light-themed background colors (e.g., `bg-slate-100`, `bg-white`, `bg-slate-50`, `bg-slate-200`). In a dark theme environment, these light backgrounds would momentarily appear before the actual map or dark-themed content rendered, creating a jarring and inconsistent user experience. The issue was tracked in #1087.

## Files Modified

- `apps/web/app/[locale]/map/PharmacyMap.tsx`
- `apps/web/app/[locale]/map/loading.tsx`
- `apps/web/app/[locale]/map/page.tsx`

## Implementation Details

The core of this fix involves updating Tailwind CSS classes to be theme-aware, ensuring that background and text colors adapt correctly to the active theme, especially dark mode.

1.  **`apps/web/app/[locale]/map/PharmacyMap.tsx`**:
    - **Error State Container**: The `div` element responsible for displaying map loading errors was previously styled with `bg-slate-100`. This has been updated to `border border-(--color-border-muted) bg-(--color-surface-muted) dark:bg-[#0d1117]`. This ensures the background is consistent with our muted surface color in light mode and a specific dark background color (`#0d1117`) in dark mode, with a theme-aware border.
    - **Error Text Colors**: The `AlertCircle` icon's color changed from `text-slate-400` to `text-(--color-text-muted)`. The primary error message text changed from `text-slate-600` to `text-(--color-text-primary)`, and the secondary message from `text-slate-400` to `text-(--color-text-secondary)`. These changes align text colors with our defined theme variables.
    - **Map Container**: The main `div` wrapping the map was updated from having no explicit background to `overflow-hidden rounded-2xl bg-(--color-surface-muted) dark:bg-[#0d1117]`. This provides a consistent background for the map area itself.
    - **Loading Skeleton**: The `div` for the loading skeleton overlay was updated from `bg-slate-100` to `border border-(--color-border-muted) bg-(--color-surface-muted) dark:bg-[#0d1117]`, mirroring the error state container for visual consistency during loading. The loading text color changed from `text-slate-500` to `text-(--color-text-secondary)`.

2.  **`apps/web/app/[locale]/map/loading.tsx`**:
    - This file defines the full-page loading skeleton for the map page. All instances of hardcoded light background colors have been replaced with theme-aware alternatives:
        - The main page container `div` changed from `bg-slate-50` to `bg-(--color-surface-muted) dark:bg-[#0d1117]`.
        - Header and filter bar `div` elements changed from `bg-white` to `bg-(--color-surface-page)` and their borders from `border-slate-100` to `border-(--color-border-muted)`.
        - Skeleton elements (e.g., rounded-full, rounded-xl, rounded-2xl `div`s) that were `bg-slate-100`, `bg-slate-200`, `bg-emerald-100`, `bg-blue-200`, `bg-white` are now `bg-(--color-surface-muted)`, `bg-emerald-500/20`, `bg-blue-500/30`, or `bg-(--color-surface-page)/95`. This ensures the animated loading elements also respect the dark theme.
        - The shimmer effect's `background` gradient was adjusted from `rgba(255,255,255,0.16)` to `rgba(255,255,255,0.06)` to be less prominent and more suitable for a dark background.

3.  **`apps/web/app/[locale]/map/page.tsx`**:
    - The diff for this file is truncated in the provided data. However, based on the context of the PR, the change likely involved updating the `className` of the mobile pharmacy pill button to ensure its background and text colors are theme-aware, similar to the other changes. The truncated line shows a change from `bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200` to `bg-s`, indicating an update to use theme variables or a more consistent dark mode styling for this button. Not documented in this PR.

## Technical Decisions

Our primary technical decision was to leverage SahiDawa's existing custom CSS variables for theming, which are defined to provide consistent `surface`, `text`, and `border` colors across both light and dark modes. Where a direct variable wasn't suitable or a more specific dark background was desired (e.g., for a deep, GitHub-like dark theme background), we explicitly used `dark:bg-[#0d1117]`.

This approach was chosen over simply inverting colors or relying solely on a generic dark mode class because:

1.  **Consistency**: Using custom CSS variables like `(--color-surface-muted)` ensures that all components across the application that utilize these variables will automatically adapt to the current theme, reducing the likelihood of future "white flashes" or theme inconsistencies.
2.  **Maintainability**: Centralizing color definitions in CSS variables makes it easier to modify or extend our theme in the future without having to update individual component styles.
3.  **Specificity**: For elements like the main page background (`#0d1117`), a specific hex code was chosen for its aesthetic alignment with common dark themes, providing a polished look that might not be covered by a generic variable.
4.  **Tailwind CSS Integration**: Tailwind's utility-first approach, combined with its `dark:` variant modifier, makes it straightforward to apply these theme-aware styles directly in our JSX, keeping styling close to the component logic.

## How To Re-Implement (Contributor Reference)

To re-implement a similar theme-aware styling fix for a "white flash" issue, a contributor would follow these steps:

1.  **Identify the problematic page/component**: Use the browser's developer tools to inspect the elements that appear with an incorrect background color during navigation or loading in dark mode.
2.  **Locate the relevant JSX/TSX file**: Find the component responsible for rendering the identified UI elements (e.g., `PharmacyMap.tsx`, `loading.tsx`).
3.  **Replace hardcoded light background colors**:
    - Look for Tailwind CSS classes like `bg-slate-50`, `bg-slate-100`, `bg-white`, `bg-gray-*` that are applied to containers, loading skeletons, or error states.
    - Replace these with SahiDawa's custom CSS variables, typically accessed via Tailwind's arbitrary value syntax:
        - For general muted surfaces: `bg-(--color-surface-muted)`
        - For page-level backgrounds: `bg-(--color-surface-page)`
        - For borders: `border-(--color-border-muted)`
        - For primary text: `text-(--color-text-primary)`
        - For secondary/muted text: `text-(--color-text-secondary)`, `text-(--color-text-muted)`
    - For specific dark theme backgrounds that require a precise color, add a `dark:bg-[#HEX_CODE]` class. For instance, `dark:bg-[#0d1117]` was used here for a deep dark background.
    - Similarly, update text colors (`text-slate-*`) to use `text-(--color-text-primary)`, `text-(--color-text-secondary)`, or `text-(--color-text-muted)`.
4.  **Adjust accent colors for dark mode**: If there are elements with specific accent colors (e.g., `bg-emerald-100`, `bg-blue-200`) that look too bright in dark mode, consider replacing them with a darker variant or a transparent version of the accent color, like `bg-emerald-500/20` or `bg-blue-500/30`.
5.  **Review shimmer effects**: If loading skeletons include shimmer effects (e.g., `linear-gradient`), adjust their opacity or color values to be less stark against a dark background. For example, `rgba(255,255,255,0.16)` was changed to `rgba(255,255,255,0.06)`.
6.  **Test thoroughly**: Navigate to the affected page in both light and dark themes. Pay close attention to the transition and loading states to ensure no unexpected flashes or color inconsistencies occur.

## Impact on System Architecture

This change reinforces our commitment to a robust and consistent theming system within the SahiDawa frontend (`apps/web`). By consistently applying theme-aware CSS variables and Tailwind's `dark:` variants, we are moving towards a more predictable and maintainable UI. This reduces technical debt related to theme inconsistencies and improves the overall user experience, especially for users who prefer dark mode. It also sets a precedent for future UI development, encouraging contributors to always consider theme compatibility from the outset, thereby unlocking a smoother development workflow for new features that need to support both light and dark themes.

## Testing & Verification

This change was verified through manual testing of the `apps/web` frontend. The author performed the following steps:

1.  Enabled dark theme in the application.
2.  Navigated to the Pharmacy Map page (`/[locale]/map`).
3.  Observed the page loading and rendering process.

The verification confirmed that the "white flash" previously observed during navigation to the Pharmacy Map page in dark theme was resolved. Proof of work was provided via a screen recording demonstrating the fix, accessible at `https://github.com/user-attachments/assets/83a81a56-a6df-41e7-8e67-a184b50125ff`.

Edge cases such as varying network conditions, different browser environments, or specific accessibility settings were not explicitly documented as part of the testing for this PR. However, the use of CSS variables and Tailwind's utility classes inherently provides a degree of robustness across modern browsers.
