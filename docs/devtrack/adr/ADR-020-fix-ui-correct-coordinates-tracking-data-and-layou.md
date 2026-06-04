# ADR — fix(ui): correct coordinates tracking data and layout bugs in pharmac…

> **Date:** 2026-06-02 | **PR:** #1112 | **Status:** Accepted

## Context

The SahiDawa platform was experiencing critical systemic issues impacting development, compilation, and runtime stability. These included:

- Widespread TypeScript compilation errors and runtime crashes due to missing global type declarations for JSX elements, specifically `JSX.IntrinsicElements`, within test configurations. This led to `implicitly type any` errors across the codebase.
- Incorrect data property lookups for pharmacy coordinates (`.lat`, `.lng`) in UI components, resulting in broken map markers and inaccurate data display.
- Malformed template literal syntax in map coordinate string blocks, causing parsing errors and preventing correct rendering of map paths.
- Backend startup failures in local development environments due to improperly configured `SUPABASE_SERVICE_ROLE_KEY` dependencies.

These issues collectively hindered development velocity, introduced runtime instability, and prevented core map and pharmacy data display functionalities from operating correctly.

## Decision

A multi-faceted fix was implemented to address these critical issues:

- **TypeScript Typing Infrastructure:** The `tsconfig.test.json` file was updated to explicitly include `react` and `react-dom` in its type declarations, thereby restoring global access to the `JSX.IntrinsicElements` schema interface and resolving full-workspace implicitly type any markup errors.
- **Data Property Correction:** Frontend UI components, specifically within `PharmacyPanelRow`, were modified to correctly reference pharmacy latitude and longitude via `pharmacy.coordinates.lat` and `pharmacy.coordinates.lng`, rectifying broken direct top-level paths.
- **Syntax Interpolation Fix:** Malformed template literal syntax (e.g., `0{...}`) in universal map coordinates string blocks was corrected to valid JavaScript template literals, resolving parsing compiler errors.
- **Environment Handling:** The local environment pipeline structure variables were configured to properly support the required `SUPABASE_SERVICE_ROLE_KEY` dependency, resolving backend startup blockades.
- **Minor UI/UX Refinements:** Map attribution text was updated, and marker styling logic was simplified for consistency.

## Alternatives Considered

| Alternative                                                                                                                                                                  | Why Rejected                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **For Typing Infrastructure Fix:** Create explicit custom type declaration files (`.d.ts`) for `JSX.IntrinsicElements` and other missing global types.                       | This would introduce redundant and potentially outdated type definitions, be harder to maintain, and deviate from standard TypeScript project setup where `react` and `react-dom` types are expected to be globally available when configured correctly. The chosen solution leverages existing library types.       |
| **For Data Property Correction & Syntax Interpolation Fix:** Implement a dedicated frontend utility function to parse and format all coordinate-related strings and objects. | While centralizing logic can be beneficial, the issues were fundamental syntax and property access errors. A utility would abstract away the underlying problem rather than fixing the root cause. Direct correction of property paths and template literals was more precise and efficient for these specific bugs. |

## Consequences

**Positive:**

- Resolved critical TypeScript compilation errors and runtime crashes, significantly improving developer experience and application stability.
- Enabled correct display of pharmacy locations on the map and accurate data rendering in UI panels, restoring core platform functionality.
- Fixed backend startup issues, allowing local development and testing to proceed without blockades.
- Improved overall code quality and maintainability by correcting fundamental syntax, typing, and data access errors.
- Enhanced UI/UX with minor map styling improvements and consistent attribution.

**Trade-offs:**

- The need for these fixes highlighted potential fragility in the initial project setup regarding TypeScript configuration and environment variable management, suggesting a need for more robust initial setup validation or clearer documentation.

## Related Issues & PRs

- PR #1112: fix(ui): correct coordinates tracking data and layout bugs in pharmac…
- Issue #159
