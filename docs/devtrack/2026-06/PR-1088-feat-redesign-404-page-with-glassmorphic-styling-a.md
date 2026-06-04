# PR #1088 — feat: redesign 404 page with glassmorphic styling and additional navi…

> **Merged:** 2026-06-01 | **Author:** @TanushreeHarika | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #1084

## What Changed

This pull request completely overhauls the `not-found.tsx` page in our `apps/web` application. We replaced the previous basic, inline-styled 404 page with a modern, responsive glassmorphic design that integrates seamlessly with our existing Tailwind CSS v4.0 theme. Additionally, we upgraded the navigation links to utilize our i18n routing system, ensuring locale preservation and offering direct pathways to the home page and the medicine scanning tool.

## The Problem Being Solved

The previous 404 error page (`apps/web/app/[locale]/not-found.tsx`) was a static, unstyled component relying on raw inline JavaScript styles. This approach was inconsistent with SahiDawa's modern design system, lacked responsiveness, and did not provide a visually engaging or helpful experience for users encountering dead links. Crucially, its navigation link used a standard `next/link` component, which did not preserve the active locale (e.g., `/en`, `/te`) when redirecting, leading to a suboptimal user experience for our internationalized platform.

## Files Modified

- `apps/web/app/[locale]/not-found.tsx`
- `package-lock.json`

## Implementation Details

The core of this change resides in `apps/web/app/[locale]/not-found.tsx`. We removed all `style={{...}}` attributes and custom `onMouseOver`/`onMouseOut` event handlers, migrating the entire layout and styling to **Tailwind CSS v4.0** utility classes.

The page now consists of:

1.  **Root Container:** A `div` with classes like `relative flex flex-grow flex-col items-center justify-center px-4 py-16 text-center` provides the main layout and ensures the content is centered and takes up available space.
2.  **Background Soft Glows:** Two `div` elements are positioned absolutely (`absolute inset-0 z-0 overflow-hidden select-none`) to create subtle, slow-fading glowing meshes. These use `bg-emerald-500/10 blur-[80px] dark:bg-emerald-900/10` and `bg-purple-500/5 blur-[90px] dark:bg-purple-900/5` to blend with our primary theme and add visual depth.
3.  **Main Glassmorphic Container:** The central content is housed within a `div` with extensive Tailwind classes for the glassmorphic effect: `relative z-10 w-full max-w-md overflow-hidden rounded-[2.5rem] border border-(--color-border-muted) bg-white/40 p-8 shadow-2xl backdrop-blur-md sm:p-10 dark:bg-slate-900/40`. This applies a semi-transparent background, blur effect, rounded borders, and shadow.
4.  **Accent Top Strip:** A `div` element at the top of the glassmorphic container (`absolute top-0 right-0 left-0 h-1.5`) uses a linear gradient (`bg-linear-to-r from-emerald-500 to-teal-500`) for a subtle brand accent.
5.  **Pulsing Warning Icon:** We integrated the `AlertCircle` icon from the `lucide-react` library. It's wrapped in a styled `div` and given the `animate-pulse` Tailwind class to create a micro-animated, pulsing effect, enhancing the visual alert.
6.  **Content:** The "Error 404" badge, main heading (`Page Not Found`), and descriptive paragraph are all styled using Tailwind classes for consistent typography and spacing.
7.  **Contextual Actions:** Two navigation links are provided:
    - **"Back to Home":** This is the primary action, styled with `bg-slate-900` and `text-white`. It uses the `Home` icon from `lucide-react`.
    - **"Scan Medicine":** This is a secondary action, styled with an outline effect (`border border-(--color-border-muted) bg-white/50`) and `text-slate-700`. It uses the `Camera` icon from `lucide-react`.
    - Both links now import `{ Link }` from `@/i18n/routing` instead of `next/link`. This crucial change ensures that when a user clicks these links, the current locale prefix (e.g., `/en`, `/te`) is automatically prepended to the `href` prop, maintaining the localized user experience. The `href` for "Back to Home" is `/` and for "Scan Medicine" is `/scan`.

The `package-lock.json` file was updated to include `peer: true` flags for several dependencies. This is a metadata change in the lockfile, likely reflecting an update to `npm` or dependency declarations, but does not alter the functional behavior of the application.

## Technical Decisions

1.  **Tailwind CSS v4.0 Adoption:** We chose to refactor to Tailwind CSS v4.0 for styling because it aligns with our established frontend development practices. It provides a highly efficient, utility-first approach that reduces CSS bundle size, improves maintainability, and ensures design consistency across the application. This decision allowed us to remove all inline styles, which are generally discouraged for complex UIs due to poor maintainability and lack of reusability.
2.  **Glassmorphic Design:** The glassmorphic aesthetic was chosen to match SahiDawa's modern and clean design language. The `backdrop-blur-md` and semi-transparent `bg-white/40` (or `dark:bg-slate-900/40`) classes, combined with subtle borders and shadows, create a premium and integrated feel, moving away from a stark, functional error page.
3.  **`@/i18n/routing` for Navigation:** The decision to switch from `next/link` to `{ Link }` from `@/i18n/routing` was critical for maintaining a consistent and correct internationalized user experience. Our i18n routing system automatically handles locale prefixes, preventing users from being dropped into a default locale when navigating from an error page. This ensures that SahiDawa remains fully localized even in error scenarios.
4.  **Lucide React Icons:** We opted for `lucide-react` for icons (`Home`, `Camera`, `AlertCircle`) due to its lightweight nature, extensive icon set, and ease of integration with React and Tailwind CSS. The ability to easily size and style icons with Tailwind classes makes it a natural fit for our component library.
5.  **Contextual Navigation:** Providing two distinct navigation options ("Back to Home" and "Scan Medicine") was a deliberate choice to enhance user experience. Instead of just a generic "go back" link, we offer a primary path to the application's root and a secondary, highly relevant path to a core SahiDawa feature (medicine scanning), anticipating user intent and reducing friction.

## How To Re-Implement (Contributor Reference)

To re-implement this enhanced 404 page, a contributor would follow these steps:

1.  **Locate the 404 Page:** The primary file for modification is `apps/web/app/[locale]/not-found.tsx`. This is a Next.js App Router convention for handling 404 errors within a localized route segment.
2.  **Import Necessary Components:**
    - Replace `import Link from "next/link";` with `import { Link } from "@/i18n/routing";` to ensure i18n-aware navigation.
    - Import icons: `import { Home, Camera, AlertCircle } from "lucide-react";`. Ensure `lucide-react` is installed as a dependency.
3.  **Structure the Layout with Tailwind CSS:**
    - Start with a root `div` that centers content and provides flexibility:
        ```tsx
        <div className="relative flex flex-grow flex-col items-center justify-center px-4 py-16 text-center">
            {/* ... content ... */}
        </div>
        ```
    - Add background elements for visual flair. These should be `absolute` and `pointer-events-none` to not interfere with interactions:
        ```tsx
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
            <div className="absolute top-1/4 left-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[80px] dark:bg-emerald-900/10"></div>
            <div className="absolute bottom-1/4 left-1/3 h-[300px] w-[300px] rounded-full bg-purple-500/5 blur-[90px] dark:bg-purple-900/5"></div>
        </div>
        ```
4.  **Create the Glassmorphic Container:** This is the central interactive element. Apply the `backdrop-blur-md` and semi-transparent background classes, along with border and shadow for the glass effect:
    ```tsx
    <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[2.5rem] border border-(--color-border-muted) bg-white/40 p-8 shadow-2xl backdrop-blur-md sm:p-10 dark:bg-slate-900/40">
        {/* Accent Top Strip */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-linear-to-r from-emerald-500 to-teal-500"></div>
        {/* ... content inside container ... */}
    </div>
    ```
5.  **Integrate Icons and Animations:**
    - Place the `AlertCircle` icon within a styled `div` and apply the `animate-pulse` class for a subtle animation:
        ```tsx
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-inner dark:bg-emerald-950/40 dark:text-emerald-400">
            <AlertCircle size={44} strokeWidth={2} className="animate-pulse" />
        </div>
        ```
6.  **Add Text Content:** Use standard HTML elements (`span`, `h1`, `p`) and style them with Tailwind classes for typography, color, and spacing.
7.  **Implement Localized Navigation Links:**
    - Use the imported `Link` component from `@/i18n/routing`.
    - Provide `href` values relative to the root (`/` for home, `/scan` for scanner).
    - Style the links using Tailwind for buttons, including hover effects and icon integration:
        ```tsx
        <Link href="/" className="group flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
            <Home size={18} className="transition-transform group-hover:scale-110" />
            <span>Back to Home</span>
        </Link>
        <Link href="/scan" className="group flex items-center justify-center gap-2 rounded-2xl border border-(--color-border-muted) bg-white/50 px-6 py-4 font-semibold text-slate-700 backdrop-blur-xs transition-all hover:-translate-y-0.5 hover:bg-white dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-900">
            <Camera size={18} className="transition-transform group-hover:scale-110" />
            <span>Scan Medicine</span>
        </Link>
        ```
8.  **Dependency Management:** Ensure `lucide-react` is listed in `package.json` and `npm install` (or `yarn install`) is run to update `package-lock.json`. The `peer: true` changes in `package-lock.json` are typically handled automatically by `npm` during installation or updates and do not require manual intervention.

## Impact on System Architecture

This change primarily impacts the frontend user experience and the consistency of our design system.

1.  **Enhanced User Experience:** By providing a visually appealing, responsive, and helpful 404 page, we significantly improve the user experience when navigating to non-existent routes. This reduces frustration and guides users back into the application flow more effectively.
2.  **Design System Consistency:** The refactoring to Tailwind CSS and the adoption of glassmorphic styling ensure that the 404 page now adheres to SahiDawa's modern design language, reinforcing brand identity and visual coherence across the platform.
3.  **Improved Internationalization:** The integration of `@/i18n/routing` for navigation on the 404 page closes a critical gap in our internationalization strategy. It guarantees that locale context is preserved, preventing unexpected language switches and providing a seamless experience for our global user base.
4.  **Maintainability:** Removing inline styles and adopting Tailwind CSS improves the maintainability of the `not-found.tsx` component, making it easier for future contributors to understand, modify, and extend its styling without resorting to imperative DOM manipulation.
5.  **No Backend Impact:** This change is entirely frontend-focused and has no direct impact on our backend services, APIs, or database architecture.

## Testing & Verification

We performed manual verification to ensure the changes met the requirements:

1.  **Local Development Environment:** The application was run using `npm run dev`.
2.  **Route Navigation:** We navigated to an arbitrary non-existent route, specifically `http://localhost:3000/en/page-does-not-exist`, to trigger the 404 page.
3.  **Responsiveness Check:** The page's layout and elements were checked across various standard device viewports (mobile, tablet, desktop) to confirm responsiveness and correct rendering.
4.  **Localization Preservation:** We verified that clicking the "Back to Home" link (and implicitly the "Scan Medicine" link) correctly preserved the current locale prefix (e.g., `/en/`) in the URL, ensuring the user remained within the English locale after navigation.
5.  **Visual Fidelity:** The glassmorphic effects, background glows, icon animations, and overall styling were visually inspected to ensure they matched the intended design and integrated well with the SahiDawa theme.

Edge cases considered include:

- **Dark Mode:** The styling includes `dark:` variants for Tailwind classes, ensuring the page renders correctly in both light and dark modes.
- **Browser Compatibility:** Tailwind CSS is designed for modern browsers, and the use of `backdrop-blur-md` is widely supported.
- **JavaScript Disabled:** While the page is a "use client" component, the core HTML structure and basic styling would still be present, though animations and interactive elements would be absent. This is an acceptable degradation for an error page.
- **Missing `i18n/routing`:** If the `@/i18n/routing` module were misconfigured or missing, the `Link` component would likely throw an error, preventing navigation. This is covered by our standard build and deployment processes.
