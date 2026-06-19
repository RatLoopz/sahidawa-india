# PR #1157 — [BUG] Small bug in ui for rendering the component for shops nearby (#1022)

> **Merged:** 2026-06-03 | **Author:** @Master-Bruce-Wayne | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #1022

## What Changed

This pull request addresses a UI bug in the display of pharmacy information cards within the Leaflet map popups. We have converted the text and background styles of these components from using theme-dependent CSS variables to fixed, dark hexadecimal color values. This ensures consistent visibility and readability of the pharmacy details, regardless of whether the user has selected the light or dark theme for the SahiDawa web application.

## The Problem Being Solved

The issue, tracked as #1022, stemmed from the Leaflet map popups, which inherently render with a white background, not respecting the SahiDawa application's global theme variables. When a user was on the dark theme, the text within these popups, which previously relied on CSS variables like `var(--color-text-primary)` or `var(--color-text-secondary)`, would become too light or even white. This resulted in poor contrast and made the pharmacy information unreadable against the white popup background, creating a significant usability barrier for users interacting with the map component.

## Files Modified

- `apps/web/app/[locale]/globals.css`
- `apps/web/app/[locale]/map/PharmacyMap.tsx`

## Implementation Details

The fix involved modifying two key areas: global CSS overrides for Leaflet popups and inline styles within the `PharmacyMap.tsx` component.

1.  **`apps/web/app/[locale]/globals.css` Modifications:**
    - We updated the custom CSS rules targeting Leaflet popups, specifically those with the `.sahidawa-popup` class.
    - For `.sahidawa-popup .leaflet-popup-content-wrapper`, the `border` was changed from `1px solid var(--color-border-muted)` to `1px solid #e2e8f0`, and `background-color` was explicitly set to `#ffffff`. This solidifies the white background for the popup wrapper.
    - The primary text color within the popup, `.sahidawa-popup .leaflet-popup-content`, was changed from a theme-dependent variable to a fixed dark color: `color: #1e293b !important;`.
    - The close button (`.sahidawa-popup .leaflet-popup-close-button`) had its `color` changed from `var(--color-text-muted)` to `#94a3b8` and `background` from `var(--color-surface-muted)` to `#f8fafc`. Its hover state also received fixed colors: `color: #1e293b !important;` and `background: #e2e8f0 !important;`.
    - Finally, the popup tip's `border` (`.sahidawa-popup .leaflet-popup-tip`) was changed from `1px solid var(--color-border-muted)` to `1px solid #e2e8f0`.

2.  **`apps/web/app/[locale]/map/PharmacyMap.tsx` Modifications:**
    - Inside the `PharmacyMap` functional component, within the `useEffect` hook responsible for creating Leaflet markers and popups, we adjusted the inline styles embedded in the HTML string passed to `L.marker().bindPopup()`.
    - The `statusColor` variable, used for the "Verified" or "Warning" banners, had its `background` and `color` values converted from CSS variables (e.g., `var(--color-brand-primary-soft)`) to fixed hex values (e.g., `background:#d1fae5;color:#065f46` for verified, `background:#fef3c7;color:#92400e` for warning).
    - The main container `div` for the popup content now explicitly sets `color: #1e293b;` to ensure all default text within is dark.
    - The background color for the pharmacy icon (`background: ${isGovt ? "var(--color-brand-primary-faint)" : "var(--color-brand-secondary-subtle)"};`) was changed to fixed hex values (`background: ${isGovt ? "#ecfdf5" : "#eff6ff"};`).
    - The pharmacy name's `color` was changed from `var(--color-text-primary)` to `#1e293b`.
    - The address paragraph's `color` was changed from `var(--color-text-secondary)` to `#64748b`.
    - The distance and rating information container's `color` was changed from `var(--color-text-muted)` to `#94a3b8`. The distance span itself also received a `color:#64748b;`.
    - The star icon's `fill` and `stroke` attributes were changed from `var(--color-accent-warning)` to `#fbbf24`. The rating text's `color` was changed from `var(--color-dark-scrollbar)` to `#1f2937`.
    - The "Live from OSM" text's `color` was changed from `var(--color-scrollbar-thumb)` to `#cbd5e1`.
    - Finally, the "View Details" button's `background` was changed from `var(--color-dark-surface)` to `#1e293b`.

These changes collectively ensure that all text and relevant background elements within the Leaflet popups are rendered with sufficient contrast against the white popup background, irrespective of the application's theme.

## Technical Decisions

The core technical decision was to abandon the use of SahiDawa's theme-dependent CSS variables (e.g., `var(--color-text-primary)`, `var(--color-surface-muted)`) for elements within the Leaflet popups. This decision was driven by the observation that Leaflet popups, as a third-party UI component, render with a fixed white background that is not easily overridden by our application's global theme variables. Attempting to force theme variables for text colors within a white-background component led to unreadable text in dark mode.

By switching to hardcoded, dark hexadecimal color values (e.g., `#1e293b`, `#64748b`), we guarantee that the text will always be visible and legible against the white popup background. This approach prioritizes immediate usability and accessibility for this specific component over strict adherence to our global theming system, where the global theme is not applicable. We chose specific shades of dark grey and blue-grey that align with our existing design system's muted and primary text colors, ensuring the visual aesthetic remains consistent with SahiDawa's overall look and feel.

## How To Re-Implement (Contributor Reference)

To re-implement this fix or apply similar styling adjustments to Leaflet popups:

1.  **Identify the Target Component:** Recognize that Leaflet popups (`L.popup` or popups bound to `L.marker`) often render outside the main application's DOM structure or have their own default styling that might not inherit global CSS variables correctly.
2.  **Inspect Leaflet Popup Structure:** Use browser developer tools to inspect the HTML structure of a Leaflet popup. Note the classes Leaflet applies (e.g., `leaflet-popup`, `leaflet-popup-content-wrapper`, `leaflet-popup-content`).
3.  **Define Custom CSS Overrides:** In `apps/web/app/[locale]/globals.css` (or a dedicated Leaflet styling file if one existed), create or modify CSS rules targeting these Leaflet classes, prefixed with a custom class like `.sahidawa-popup` if you're using `className` in `L.popup` options.
    - For background elements that should always be white, explicitly set `background-color: #ffffff !important;`.
    - For borders, use a light grey hex value like `#e2e8f0 !important;`.
    - For primary text, use a dark grey hex value like `color: #1e293b !important;`.
    - For muted text, use a slightly lighter dark grey like `color: #64748b !important;` or `#94a3b8 !important;`.
    - Ensure `!important` is used where necessary to override Leaflet's default styles.
4.  **Adjust Inline HTML Styles:** If the popup content is generated dynamically as an HTML string (as in `PharmacyMap.tsx`), you must apply inline `style` attributes directly to the HTML elements within that string.
    - For each text-containing element (e.g., `div`, `p`, `span`), set `color: #HEX_VALUE;` where `#HEX_VALUE` is a dark color.
    - For background elements, set `background: #HEX_VALUE;`.
    - For SVG fills/strokes, set `fill="#HEX_VALUE"` and `stroke="#HEX_VALUE"`.
    - Replace any `var(--css-variable)` with its corresponding fixed hex color.
5.  **Test Across Themes:** Crucially, test the changes in both light and dark modes of the SahiDawa application to ensure readability and visual consistency are maintained in all scenarios.

## Impact on System Architecture

This change is a localized UI fix and does not introduce any new architectural patterns or significant dependencies. Its primary impact is on the user experience of the map feature, ensuring that critical information about nearby pharmacies is always legible.

Architecturally, it highlights a common challenge when integrating third-party UI components (like Leaflet) into a custom-themed application. While SahiDawa generally relies on a robust CSS variable-based theming system, this PR demonstrates that specific components may require targeted, hardcoded styling overrides to maintain usability, especially when their rendering context (e.g., a fixed white background) conflicts with the application's dynamic theme. This reinforces the need for careful consideration of theme compatibility when selecting or integrating external UI libraries. It does not unlock new features but solidifies the reliability of an existing core feature.

## Testing & Verification

The changes were verified through visual inspection across both light and dark themes of the SahiDawa web application. The author provided screenshots demonstrating the improved readability of the pharmacy information card within the Leaflet popups for both themes.

Specifically:

- **Light Theme:** The screenshot shows the popup with dark text and appropriate background/border colors, maintaining the intended SahiDawa design.
- **Dark Theme:** The screenshot confirms that even when the rest of the application UI is in dark mode, the Leaflet popup now displays with a white background and consistently dark, readable text, resolving the original visibility issue.

Edge cases considered include the different status types ("Verified", "Govt. Verified", "Status unknown") and the presence or absence of distance/rating information, all of which now render with appropriate fixed colors.
