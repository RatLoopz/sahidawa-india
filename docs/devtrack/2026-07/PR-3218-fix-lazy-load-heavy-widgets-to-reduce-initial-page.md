# PR #3218 — fix: lazy-load heavy widgets to reduce initial page load

> **Merged:** 2026-07-06 | **Author:** @kumudasrip | **Area:** Frontend | **Impact Score:** 10 | **Closes:** #2949

## What Changed

We transitioned several heavy, non-critical client-side components from static imports to dynamic imports using Next.js's dynamic routing utility. Specifically, we deferred the loading of the `BackToTopButton`, `Chatbot`, and `CommandPalette` components in our global layout, as well as the interactive `PharmacyMap` component on the map page, disabling Server-Side Rendering (SSR) for these widgets and providing lightweight loading fallbacks.

## The Problem Being Solved

Before this PR, our initial page load performance was severely degraded by heavy JavaScript payloads. Components like the interactive Leaflet/Mapbox-based `PharmacyMap`, the AI-powered `Chatbot`, and the keyboard-accessible `CommandPalette` were bundled into the initial JS payload sent to the client. 

This caused high Total Blocking Time (TBT) and delayed the Time to Interactive (TTI), particularly for users in rural Indian regions accessing SahiDawa over low-bandwidth 3G/4G networks or on low-end mobile devices. These widgets are not required for the initial visual render of the page, making their static inclusion highly inefficient. Furthermore, rendering map components on the server often triggered hydration mismatch errors due to their reliance on browser-only APIs (like `window` and `document`).

## Files Modified

- `apps/web/app/[locale]/layout.tsx`
- `apps/web/app/[locale]/map/page.tsx`

## Implementation Details

We refactored our component loading strategy using `next/dynamic` to split these heavy widgets into separate JavaScript chunks that are loaded asynchronously on the client side.

### 1. Global Layout Optimization (`apps/web/app/[locale]/layout.tsx`)
We removed the static imports for `BackToTopButton`, `Chatbot`, and `CommandPalette`. We replaced them with dynamic imports configured with `ssr: false` to prevent server-side execution, and set their loading state to `null` to avoid rendering intrusive spinners in the global layout:

```tsx
const BackToTopButton = dynamic(() => import("./components/BackToTopButton"), {
    ssr: false,
    loading: () => null,
});
const Chatbot = dynamic(() => import("./components/Chatbot"), {
    ssr: false,
    loading: () => null,
});
const CommandPalette = dynamic(() => import("./components/CommandPalette"), {
    ssr: false,
    loading: () => null,
});
```

### 2. Map Page Optimization (`apps/web/app/[locale]/map/page.tsx`)
The `PharmacyMap` component is highly interactive and relies on heavy mapping libraries. We deferred its loading and implemented a styled, matching placeholder skeleton to prevent Cumulative Layout Shift (CLS) while the map bundle is fetched and parsed:

```tsx
const PharmacyMap = dynamic(() => import("./PharmacyMap"), {
    ssr: false,
    loading: () => (
        <div className="flex h-[420px] items-center justify-center rounded-3xl border border-(--color-border-muted) bg-(--color-surface-muted)">
            <span className="text-sm font-medium text-(--color-text-secondary)">
                Loading map…
            </span>
        </div>
    ),
});
```

## Technical Decisions

- **Next.js Dynamic Imports (`next/dynamic`)**: We chose `next/dynamic` over standard React `lazy` + `Suspense` because it integrates natively with Next.js's routing and SSR architecture, allowing us to easily toggle `ssr: false` and define loading fallbacks inline.
- **Disabling SSR (`ssr: false`)**: Map libraries and interactive widgets that bind to window events (like the command palette or chatbot) cannot be pre-rendered on the server. Disabling SSR prevents hydration mismatch errors and reduces server-side rendering overhead.
- **Null Loading Fallbacks for Layout Widgets**: We chose `loading: () => null` for the chatbot, command palette, and back-to-top button because these elements are either hidden by default or positioned absolutely/fixed. Showing a loading spinner in the document flow would disrupt the layout.
- **Explicit Skeleton for the Map**: The map occupies a fixed block (`h-[420px]`) in the layout. We implemented a styled loading placeholder to prevent Cumulative Layout Shift (CLS) when the map component finishes loading.

## How To Re-Implement (Contributor Reference)

If you need to lazy-load a new heavy component or widget in the future, follow these steps:

1. **Identify the Target**: Locate components that are not critical for the initial paint (above-the-fold content) or those that rely heavily on browser-only APIs.
2. **Import the Dynamic Utility**:
   ```typescript
   import dynamic from "next/dynamic";
   ```
3. **Replace the Static Import**:
   Remove the standard import statement:
   ```typescript
   // Remove this:
   // import MyHeavyWidget from "./components/MyHeavyWidget";
   ```
   And replace it with:
   ```typescript
   const MyHeavyWidget = dynamic(() => import("./components/MyHeavyWidget"), {
       ssr: false, // Set to false if it uses window/document or heavy client-side libraries
       loading: () => <MyWidgetSkeleton />, // Use null for overlay/hidden widgets
   });
   ```
4. **Handle Type Imports**: If you need types from the dynamically imported file, import them using the `import type` syntax to ensure they are stripped out during compilation and do not force the component back into the main bundle:
   ```typescript
   import type { MyWidgetProps } from "./components/MyHeavyWidget";
   ```

## Impact on System Architecture

This optimization reduces the initial bundle size of our main entry points, directly improving Core Web Vitals (specifically LCP, TBT, and CLS) across the platform. By decoupling heavy interactive features from the critical rendering path, we ensure that our rural health platform remains highly responsive and accessible on low-spec devices and unstable networks, which is core to SahiDawa's mission.

## Testing & Verification

- **Hydration Verification**: Verified that no React hydration mismatch warnings are thrown in the console when loading the layout or the map page.
- **Layout Shift Verification**: Confirmed that the `PharmacyMap` loading placeholder correctly reserves `420px` of vertical space, preventing layout jumps when the map finishes loading.
- **Functionality Check**: Verified that the `BackToTopButton`, `Chatbot`, and `CommandPalette` still mount and function correctly on the client side once the initial page load is complete.