# PR #1327 — feat(scan): add interactive skeleton loading states with result-card-matching layout

> **Merged:** 2026-06-06 | **Author:** @Pcmhacker-piro | **Area:** Frontend | **Impact Score:** 10 | **Closes:** #252

## What Changed

This pull request introduces a completely redesigned skeleton loader for the scanner feature, located in `apps/web/components/scanner/SkeletonLoader.tsx`. The new loader provides an interactive, full-screen overlay with a backdrop blur, and its layout now visually matches the structure of the final scan result card. Additionally, a critical bug was resolved by adding the missing `@keyframes shimmer` definition to `apps/web/app/[locale]/globals.css`, restoring shimmer animations across the entire application and improving accessibility by disabling them for users who prefer reduced motion.

## The Problem Being Solved

Prior to this PR, the scanner's loading experience was suboptimal. The existing skeleton loader (if any, or a generic one) did not provide a clear visual representation of the content structure that users were waiting for, which could lead to a disjointed user experience and increased perceived loading times. Users lacked immediate context about what kind of information was being processed.

Furthermore, a significant bug existed where the global `@keyframes shimmer` CSS animation was undefined in `apps/web/app/[locale]/globals.css`. This meant that any component across the SahiDawa platform attempting to use the `shimmer` animation (e.g., via `animate-[shimmer_1.5s_infinite]`) would fail to display the intended dynamic loading effect, instead showing static, unmoving placeholders. This impacted the visual polish and user feedback for all skeleton loading states.

## Files Modified

- `apps/web/app/[locale]/globals.css`
- `apps/web/components/scanner/SkeletonLoader.tsx`

## Implementation Details

The core of this change lies in the complete overhaul of the `SkeletonLoader` component and a crucial CSS fix.

**`apps/web/components/scanner/SkeletonLoader.tsx`:**
The `SkeletonLoader` component has been entirely re-implemented to provide a sophisticated and context-aware loading experience.
1.  **Full-Screen Overlay:** The component now renders as a full-screen overlay using Tailwind CSS classes `absolute inset-0 z-20`. This ensures it covers the entire viewport during the scanning process.
2.  **Backdrop Effects:** A `bg-black/60` background with `backdrop-blur-sm` is applied to the overlay, visually dimming and blurring the content beneath, drawing the user's focus to the loading state. The `animate-in fade-in zoom-in duration-300` classes from `tailwindcss-animate` provide a smooth entry transition for the loader.
3.  **Result Card Mimicry:** The central loading element is a `div` styled to closely resemble the final scan result card. It features `w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-2xl`. This pre-empts the user with the expected layout of the scan results.
4.  **Internal Skeleton Structure:**
    *   A subtle progress bar is indicated at the top with `absolute top-0 right-0 left-0 h-2 animate-pulse bg-slate-600`.
    *   The content within the card mimics the structure of a scan result:
        *   A central circular placeholder (`h-20 w-20 items-center justify-center rounded-full bg-slate-800`) with an inner pulsing element (`h-10 w-10 animate-pulse rounded-full bg-slate-700`).
        *   Text line placeholders for a title and subtitle (`h-6 w-44`, `h-4 w-36`), both utilizing the `shimmer` animation.
        *   A larger circular placeholder (`h-6 w-28 animate-pulse rounded-full bg-slate-800`).
        *   Two rows of two "detail" cards, each with a title and value placeholder, styled with `rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3`.
        *   A full-width action button placeholder (`h-12 w-full animate-pulse rounded-2xl bg-slate-800`).
        *   A footer with two smaller text placeholders (`h-4 flex-1 animate-pulse rounded bg-slate-800`).
5.  **Animation Application:** Elements like the title and subtitle placeholders use `animate-[shimmer_1.5s_infinite]` combined with a `bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]` to create the characteristic sliding shimmer effect. Other elements use `animate-pulse` for a simpler fading animation.

**`apps/web/app/[locale]/globals.css`:**
This file received a critical update to address the missing shimmer animation.
1.  **`@keyframes shimmer` Definition:** The `@keyframes shimmer` rule was added, defining the animation that creates the sliding gradient effect. It animates the `background-position` property from `200% 0` to `-200% 0`, which, when applied to a gradient background with `background-size: 200% 100%`, creates the illusion of a light wave moving across the element.
2.  **Accessibility for Reduced Motion:** A new media query `@media (prefers-reduced-motion: reduce)` was introduced. Inside this query, the `.shimmer-skeleton` class is defined to explicitly disable animations (`animation: none !important;`) and set a static background (`background: var(--color-surface-muted) !important;`). This ensures that users who have enabled "reduce motion" preferences in their operating system or browser will not be subjected to potentially distracting animations.

## Technical Decisions

1.  **User Experience First:** The primary technical decision was to prioritize user experience by making the loading state more informative and visually engaging. Matching the skeleton layout to the final result card reduces cognitive load and provides a clearer expectation for the user.
2.  **Centralized Animation Definition:** Defining `@keyframes shimmer` in `globals.css` is a deliberate choice to centralize common animations. This promotes reusability, reduces redundancy, and ensures consistency across all components that utilize shimmer effects throughout the SahiDawa platform.
3.  **Progressive Enhancement with `tailwindcss-animate`:** The use of `animate-in fade-in zoom-in` from `tailwindcss-animate` provides a modern, smooth transition for the loader's appearance, enhancing the perceived responsiveness of the application.
4.  **Accessibility Compliance:** The inclusion of the `prefers-reduced-motion` media query is a critical accessibility decision. It demonstrates our commitment to building an inclusive platform by providing an option for users who may find animations distracting or discomforting, aligning with WCAG guidelines.
5.  **Utility-First Styling:** Continued reliance on Tailwind CSS for styling allows for rapid development and maintains a consistent, maintainable codebase by leveraging utility classes directly in the JSX. Custom CSS for animations is kept minimal and focused on keyframes.

## How To Re-Implement (Contributor Reference)

To re-implement a similar interactive skeleton loading state, a contributor would follow these steps:

1.  **Define Global Keyframe Animation:**
    *   Ensure the `@keyframes shimmer` is defined in `apps/web/app/[locale]/globals.css` (or a similar global stylesheet) as follows:
        ```css
        @keyframes shimmer {
            0% {
                background-position: 200% 0;
            }
            100% {
                background-position: -200% 0;
            }
        }
        @media (prefers-reduced-motion: reduce) {
            .shimmer-skeleton {
                animation: none !important;
                background: var(--color-surface-muted) !important;
            }
        }
        ```
    *   This provides the base animation and an accessibility fallback.

2.  **Create a React Component for the Skeleton:**
    *   Create a new React component, for example, `ScannerSkeleton.tsx`.
    *   Wrap the entire skeleton content in a container that acts as a full-screen overlay:
        ```tsx
        import React from "react";
        // Ensure tailwindcss-animate is configured for animate-in
        export function ScannerSkeleton() {
            return (
                <div className="animate-in fade-in zoom-in absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm duration-300">
                    {/* Skeleton content goes here */}
                </div>
            );
        }
        ```

3.  **Design the Skeleton's Structure:**
    *   Inside the overlay, create a `div` that visually mimics the target UI element (e.g., a result card). Use appropriate Tailwind classes for `width`, `max-width`, `border-radius`, `background-color`, and `padding`.
    *   Break down the target UI into its core visual components (e.g., image placeholders, text lines, buttons, data fields).
    *   Use `div` elements with fixed `height` and `width` (or `w-full`, `w-1/2` for relative widths) and `rounded` classes to represent these components.

4.  **Apply Animations:**
    *   For elements requiring a sliding shimmer effect, apply the `shimmer-skeleton` class (if defined for reduced motion) and the `animate-[shimmer_1.5s_infinite]` class. Crucially, also apply a gradient background with `background-size` to enable the shimmer:
        ```html
        <div className="mx-auto h-6 w-44 shimmer-skeleton animate-[shimmer_1.5s_infinite] rounded bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]" />
        ```
    *   For simpler, fading pulse effects, use `animate-pulse` with a solid background color:
        ```html
        <div className="h-10 w-10 animate-pulse rounded-full bg-slate-700" />
        ```

5.  **Integrate into Application:**
    *   Conditionally render the `ScannerSkeleton` component in the parent view when data is being fetched or an asynchronous operation is in progress.
    *   Example: `isLoading ? <ScannerSkeleton /> : <ScannerResults />`

## Impact on System Architecture

This change primarily impacts the frontend user experience and design system.
1.  **Enhanced User Experience:** The new `SkeletonLoader` significantly elevates the perceived quality and responsiveness of the SahiDawa platform, particularly for the critical scanner feature. It provides a more intuitive and less jarring waiting experience for users.
2.  **Improved Design Consistency:** By explicitly defining `@keyframes shimmer` globally, we standardize how shimmer loading effects are implemented across the application. This promotes a more consistent visual language and reduces the likelihood of disparate or broken loading animations in future features.
3.  **Increased Accessibility:** The explicit support for `prefers-reduced-motion` makes the SahiDawa platform more accessible to a wider range of users, aligning with modern web development best practices for inclusive design.
4.  **No Backend Impact:** This is a purely client-side UI/UX enhancement. It does not introduce any changes to our backend services, APIs, database schema, or core business logic.
5.  **Component Reusability:** While this specific `SkeletonLoader` is tailored to the scanner result card, its implementation patterns (overlay, backdrop, shimmer/pulse animations, accessibility considerations) can serve as a strong reference for developing other sophisticated skeleton loaders across the SahiDawa platform.

## Testing & Verification

Verification of this change involved visual inspection and functional testing.
1.  **Visual Confirmation:** The author provided screenshots and/or screen recordings (Proof of Work) in the PR description, demonstrating the new interactive skeleton loading states. This confirmed that the redesigned `SkeletonLoader.tsx` component renders correctly with its new layout, full overlay, backdrop blur, and shimmer/pulse animations.
2.  **Shimmer Animation Functionality:** Testing involved navigating to the scanner feature and initiating a scan to observe the new loader. Additionally, other parts of the application that utilize the `shimmer` animation would have been checked to ensure that the fix in `globals.css` correctly restored their intended animated behavior.
3.  **Accessibility Testing:** Verification would include testing in environments where the user's operating system or browser is configured to prefer reduced motion. This confirms that the `@media (prefers-reduced-motion: reduce)` rule in `globals.css` successfully disables the shimmer animation for `.shimmer-skeleton` elements, providing a static placeholder instead.
4.  **Edge Cases:** Not documented in this PR.