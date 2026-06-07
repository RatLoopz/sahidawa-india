# PR #1057 — fix: redesign footer with glassmorphism, reduce spacing by 40%, fix T…

> **Merged:** 2026-06-01 | **Author:** @Adi-Marathe | **Area:** Frontend | **Impact Score:** 11 | **Closes:** #992

## What Changed

This pull request introduces a complete redesign of the SahiDawa website footer, implementing a glassmorphism aesthetic that aligns with the existing homepage design. It significantly reduces the footer's vertical footprint by 40%, optimizes its responsive grid layout, and incorporates new visual elements and contact information. Crucially, it also resolves a critical Turbopack panic loop that was hindering local development by adjusting the development server configuration and renaming a core Next.js middleware file.

## The Problem Being Solved

Prior to this change, our website footer suffered from several issues:

1.  **Excessive Vertical Padding:** The footer occupied a disproportionately large amount of screen real estate due to `py-10` padding, leading to an unbalanced visual experience.
2.  **Inconsistent Design Language:** The previous footer did not match the modern glassmorphism theme established on other parts of the website, particularly the homepage, creating a disjointed user experience.
3.  **Suboptimal Layout:** The grid layout was unbalanced, with awkward spacing and an "empty" feel in the "Connect" section, especially on larger screens.
4.  **Lack of Key Information:** Important links like the Medicine Expiry Tracker were not prominently featured, and direct email contact was missing.
5.  **Critical Development Blocker:** Developers frequently encountered a Turbopack panic loop when running the development server, making local development unstable and frustrating.
6.  **Non-Standard File Naming:** The `proxy.ts` file, functioning as Next.js middleware, did not adhere to standard Next.js conventions, which could lead to confusion and potential issues with future updates or tooling.

## Files Modified

- `apps/web/app/[locale]/components/Footer.tsx`
- `apps/web/middleware.ts`
- `apps/web/tests/i18n-locales.test.tsx`

## Implementation Details

The core of this change resides in `apps/web/app/[locale]/components/Footer.tsx`, which underwent a complete overhaul.

1.  **Glassmorphism and Spacing Reduction:**
    - The main `<footer>` element's `className` was updated from `bg-slate-950 text-slate-400` to `relative mt-auto border-t border-slate-200/50 bg-white/70 backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/50`. This applies the glassmorphism effect using `bg-white/70` (light mode) or `dark:bg-slate-900/50` (dark mode) combined with `backdrop-blur-md`.
    - Vertical padding was reduced by changing `px-4 py-10` on the main content `div` to `px-4 py-8`, resulting in a 40% height reduction.
    - Decorative gradient blobs were added using absolute positioning and `blur-3xl` within a `pointer-events-none absolute inset-0 overflow-hidden` container to enhance the visual appeal and match the homepage. These are `bg-emerald-500/5` and `bg-purple-500/5` (with dark mode variants).

2.  **Grid Layout and Content Structure:**
    - The main footer content `div`'s grid layout was transformed from `grid grid-cols-1 gap-8 md:grid-cols-3` to `grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-6`. This shifts to a 12-column system for finer control over section distribution.
    - The brand section now occupies `md:col-span-5`, while "Quick Links" and "Resources" each take `md:col-span-2`, and "Connect" (social/contact) takes `md:col-span-3` (implied by the remaining space and content).
    - Links are now dynamically rendered from `quickLinks`, `resourceLinks`, and `socialLinks` arrays defined within the `Footer` component, improving maintainability and readability.
    - New icons `Mail` and `ExternalLink` (from `lucide-react`) were introduced for email contact and external link indicators, respectively. `CalendarRange` is now used for the "Expiry Tracker" link, which is highlighted with `text-emerald-600`.
    - Social icons (`FaGithub`, `FaLinkedin`, `FaXTwitter`) are now rendered as compact links with specific hover effects (`hover:text-white hover:border-slate-600`, `hover:text-blue-400 hover:border-blue-500`) and a consistent `inline-flex items-center gap-2` styling.

3.  **Theme Consistency:**
    - The primary emerald green color (`#10b981`) is now consistently applied to highlights and hover states.
    - The `slate` color palette from our design system is used for text and borders, ensuring dark mode compatibility.
    - Hover transitions on links and social icons are smoother, mirroring the behavior of feature cards on the homepage.

4.  **Technical Fixes:**
    - **Turbopack Panic Loop:** The `dev` script in `apps/web/package.json` was modified to include the `--webpack` flag. This explicitly instructs Next.js to use Webpack instead of Turbopack for local development, bypassing the panic loop issue.
    - **Middleware Renaming:** The file `apps/web/proxy.ts` was renamed to `apps/web/middleware.ts`. This aligns with Next.js's standard convention for middleware files, improving clarity and compatibility.
    - **Turbopack Configuration:** `apps/web/next.config.mjs` was updated to include Turbopack configuration. The exact configuration details are not documented in this PR's diff, but the intent is to prepare for future Turbopack compatibility.
    - **Test File Update:** `apps/web/tests/i18n-locales.test.tsx` was updated to reflect the `proxy.ts` to `middleware.ts` rename, specifically changing its import path. Not documented in this PR's diff, but inferred from commit messages.

## Technical Decisions

1.  **Glassmorphism for Footer:** This design choice was made to ensure visual consistency with the existing homepage and other modern UI elements across the SahiDawa platform. It leverages `backdrop-blur-md` and semi-transparent backgrounds (`bg-white/70`, `dark:bg-slate-900/50`) to create a cohesive and contemporary aesthetic.
2.  **12-Column Grid System:** Moving from a 3-column to a 12-column grid (`md:grid-cols-12`) provides significantly more granular control over element placement and spacing. This was crucial for achieving the "perfectly balanced grid layout" and eliminating "excessive empty spaces" mentioned in the PR description, especially across different desktop resolutions.
3.  **Dynamic Link Arrays:** Defining `quickLinks`, `resourceLinks`, and `socialLinks` as arrays within the component improves code organization, makes the footer content easier to manage, and simplifies rendering logic. This pattern enhances maintainability for future additions or modifications to footer links.
4.  **Explicit `--webpack` Flag:** The decision to add `--webpack` to the `dev` script was a pragmatic solution to an immediate and critical developer experience problem. While Turbopack is Next.js's intended future, the panic loop was blocking development. Forcing Webpack ensures stability until the Turbopack issue is resolved or a more stable version is available.
5.  **`middleware.ts` Renaming:** This change was made to adhere to Next.js best practices and conventions. Using `middleware.ts` (or `.js`) is the standard way to define middleware in Next.js applications, making the codebase more understandable for new contributors and compatible with Next.js tooling.

## How To Re-Implement (Contributor Reference)

To re-implement this footer design and associated fixes from scratch, a contributor would follow these steps:

1.  **Update `apps/web/package.json`:**
    - Locate the `dev` script.
    - Modify it to include the `--webpack` flag:
        ```json
        "dev": "next dev --webpack"
        ```
    - This ensures the development server uses Webpack, bypassing potential Turbopack issues.

2.  **Configure `apps/web/next.config.mjs`:**
    - Add or update the Turbopack configuration. While the exact configuration is not documented in this PR, a typical setup might look like this (adjust as needed for specific project requirements):
        ```javascript
        /** @type {import('next').NextConfig} */
        const nextConfig = {
            reactStrictMode: true,
            experimental: {
                // This enables Turbopack, but we're explicitly using --webpack for dev
                // This config might be for future compatibility or specific build scenarios
                // Not documented in this PR for exact details.
                // appDir: true, // If using app directory
                // turbopack: {
                //   // Specific Turbopack options if any
                // }
            },
            // ... other configurations
        };
        export default nextConfig;
        ```

3.  **Rename Middleware File:**
    - Rename `apps/web/proxy.ts` to `apps/web/middleware.ts`. This is a straightforward file system operation.

4.  **Update Middleware Imports:**
    - Search the codebase for any imports referencing `apps/web/proxy.ts` and update them to `apps/web/middleware.ts`. For example, in `apps/web/tests/i18n-locales.test.tsx`, an import like `import { config } from '../../middleware';` would replace `import { config } from '../../proxy';`.

5.  **Redesign `apps/web/app/[locale]/components/Footer.tsx`:**
    - **Base Structure:** Start with the main `<footer>` element.

        ```typescript
        "use client";
        import { FaGithub, FaLinkedin, FaXTwitter } from "react-icons/fa6";
        import { Sparkles, Heart, Mail, ExternalLink, CalendarRange } from "lucide-react";
        import { Link } from "@/i18n/routing";
        import { usePathname } from "next/navigation";

        export default function Footer() {
            const pathname = usePathname();
            const isHome = pathname ? /^\/[a-z]{2}$|^\/$/.test(pathname) : false;

            // Define link arrays
            const quickLinks = [ /* ... */ ];
            const resourceLinks = [ /* ... */ ];
            const socialLinks = [ /* ... */ ];

            return (
                <footer
                    className={`no-print relative mt-auto border-t border-slate-200/50 bg-white/70 backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/50 ${isHome ? "mb-16 md:mb-0" : ""}`}
                >
                    {/* Decorative gradient blobs */}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl dark:bg-emerald-500/10" />
                        <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-purple-500/5 blur-3xl dark:bg-purple-500/10" />
                    </div>

                    <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6">
                        {/* Main Footer Grid */}
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-6">
                            {/* Brand Section */}
                            <div className="md:col-span-5">
                                <h2 className="mb-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">SahiDawa</h2>
                                <p className="mb-4 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                    India's first open-source medicine verification platform. Scan, verify,
                                    and trust your medicines with community-powered transparency.
                                </p>
                                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:border-emerald-400/20 dark:text-emerald-400">
                                    <Sparkles className="h-3 w-3" />
                                    Made for GSSoC 2026
                                </div>
                            </div>

                            {/* Quick Links Nav */}
                            <nav className="md:col-span-2">
                                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Quick Links</h3>
                                <ul className="space-y-2">
                                    {quickLinks.map((link) => (
                                        <li key={link.href}>
                                            <Link
                                                href={link.href}
                                                className={`inline-flex items-center gap-1.5 text-sm transition-colors ${
                                                    link.highlight
                                                        ? "font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                                                        : "text-slate-600 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                                }`}
                                            >
                                                {link.icon && <link.icon className="h-3.5 w-3.5" />}
                                                {link.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </nav>

                            {/* Resources Nav */}
                            <nav className="md:col-span-2">
                                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Resources</h3>
                                <ul className="space-y-2">
                                    {resourceLinks.map((link) => (
                                        <li key={link.href}>
                                            <a
                                                href={link.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-sm text-slate-600 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                            >
                                                {link.label}
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </nav>

                            {/* Connect Section (Social & Contact) */}
                            <div className="md:col-span-3">
                                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Connect</h3>
                                <div className="flex items-center gap-3 mb-4">
                                    {socialLinks.map((link) => (
                                        <a
                                            key={link.label}
                                            href={link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`flex h-9 w-9 items-center justify-center rounded-full border border-slate-300/50 bg-white/50 text-slate-600 transition-all duration-300 hover:-translate-y-0.5 ${link.hoverColor} dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white`}
                                            aria-label={link.label}
                                        >
                                            <link.icon className="h-4 w-4" />
                                        </a>
                                    ))}
                                </div>
                                <a
                                    href="mailto:contact@sahidawa.org"
                                    className="inline-flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                >
                                    <Mail className="h-4 w-4" />
                                    contact@sahidawa.org
                                </a>
                            </div>
                        </div>

                        {/* Copyright Section */}
                        <div className="mt-8 border-t border-slate-200/50 pt-8 text-center text-xs text-slate-500 dark:border-slate-800/50 dark:text-slate-500">
                            <p className="flex items-center justify-center gap-1">
                                Made with <Heart className="h-3 w-3 text-red-500" /> by the SahiDawa Community.
                            </p>
                            <p>&copy; {new Date().getFullYear()} SahiDawa. All rights reserved.</p>
                        </div>
                    </div>
                </footer>
            );
        }
        ```

    - **Link Data:** Populate the `quickLinks`, `resourceLinks`, and `socialLinks` arrays with the appropriate `href`, `label`, `icon`, `external`, and `highlight` properties as shown in the diff.
    - **Styling:** Apply the Tailwind CSS classes for glassmorphism, responsive grid, color palette (`emerald`, `slate`), and hover effects as detailed in the diff. Pay close attention to dark mode variants (`dark:` prefixes).

## Impact on System Architecture

This PR primarily impacts the frontend presentation layer and the developer experience.

1.  **Enhanced User Experience:** The redesigned footer provides a more modern, visually appealing, and consistent interface, reinforcing SahiDawa's brand identity. The reduced height improves content visibility, and the clear layout makes navigation more intuitive.
2.  **Improved Developer Experience:** By resolving the Turbopack panic loop, this PR significantly stabilizes the local development environment. Developers can now run `next dev` without encountering crashes, leading to a smoother and more productive workflow.
3.  **Adherence to Next.js Standards:** Renaming `proxy.ts` to `middleware.ts` aligns our codebase with official Next.js conventions, making it easier for new contributors to understand the project structure and potentially simplifying future upgrades or integrations with Next.js ecosystem tools.
4.  **Foundation for Future Design:** The established glassmorphism pattern and consistent use of the design system in the footer provide a strong precedent for future UI/UX enhancements across the platform.
5.  **No Backend Impact:** This change is entirely frontend-focused and does not alter any backend logic, API contracts, or database schemas.

## Testing & Verification

The following testing procedures were performed to ensure the quality and stability of this change:

1.  **Responsive Design Verification:**
    - The footer was thoroughly tested on various screen sizes, specifically:
        - Mobile (375px width) to confirm the single-column layout and absence of horizontal overflow.
        - Tablet (768px width) to verify the correct activation of the 12-column grid and balanced spacing.
        - Desktop (1920px width) to ensure the balanced 4-section layout and optimal use of space.
2.  **Dark Mode Functionality:**
    - The website was switched between light and dark modes to confirm that all footer elements, including text, backgrounds, borders, and icons, correctly adapted to the chosen theme, maintaining the glassmorphism effect.
3.  **Link Functionality:**
    - All internal and external links within the footer were clicked and verified to ensure they navigate to the correct destinations. This included the new Medicine Expiry Tracker link, GitHub repository, contributing guide, social media links, and the email contact.
4.  **Development Server Stability:**
    - The `next dev` command was executed locally to confirm that the Turbopack panic loop was resolved and the development server started and ran without crashes, allowing for continuous development.

**Edge Cases:**

- **Browser Compatibility:** While not explicitly mentioned, standard browser compatibility testing would be assumed for a frontend UI change.
- **JavaScript Disabled:** The footer relies on client-side routing (`Link` component) and dynamic rendering. If JavaScript is disabled, navigation might be affected, though the core HTML structure should still be present. This is a general web application edge case, not specific to this PR.
- **Internationalization (i18n):** The `[locale]` segment in the path and `Link` component from `@/i18n/routing` indicate i18n support. The footer's content is currently static strings, but the structure supports localization.
