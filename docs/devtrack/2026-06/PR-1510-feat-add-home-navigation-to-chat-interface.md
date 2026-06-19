# PR #1510 — feat: add home navigation to chat interface

> **Merged:** 2026-06-08 | **Author:** @Shan7Usmani | **Area:** Frontend | **Impact Score:** 15 | **Closes:** #977

## What Changed

This pull request introduces multiple entry points for users to navigate back to the SahiDawa homepage from various chat interfaces. Specifically, we made the "SahiDawa" title in the dedicated health chat header clickable, added a dedicated "Home" button with an icon to the desktop navigation bar, and included a "Home" icon button within the floating chatbot panel's header.

## The Problem Being Solved

Prior to this change, users interacting with our chat interfaces (both the dedicated `ChatUI` page and the persistent `Chatbot` panel) lacked a direct and intuitive way to return to the main SahiDawa homepage. While the global `Navbar` existed, it did not explicitly feature a "Home" link, and the chat interfaces themselves offered no quick exit to the main landing page. This led to a less fluid user experience, requiring users to potentially use the browser's back button or manually navigate, which is inefficient and not aligned with standard web navigation patterns. Issue #977 highlighted this missing functionality, aiming to improve overall site navigability.

## Files Modified

- `apps/web/app/[locale]/components/Chatbot.tsx`
- `apps/web/app/[locale]/components/Navbar.tsx`
- `apps/web/app/components/health/ChatUI.tsx`

## Implementation Details

The implementation involved modifying three key frontend components to embed `Link` components for home navigation:

1.  **`apps/web/app/[locale]/components/Chatbot.tsx`**:
    *   We imported the `Home` icon from `lucide-react` and the `Link` component from `@/i18n/routing`.
    *   Inside the chatbot's header (`<div className="flex items-center justify-between p-4">`), we located the existing close button (`<button onClick={() => setIsOpen(false)} ...>`).
    *   A new `div` element with `className="flex items-center gap-1"` was introduced to group the close button and the new home navigation link.
    *   Within this `div`, a `Link` component was added:
        ```typescript
        <Link
            href="/"
            className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Go to homepage"
        >
            <Home size={18} />
        </Link>
        ```
    *   This `Link` renders the `Home` icon and directs to the root path (`/`), providing a quick return to the homepage from the floating chatbot panel.

2.  **`apps/web/app/[locale]/components/Navbar.tsx`**:
    *   We imported the `Home` icon from `lucide-react`.
    *   Within the desktop navigation section (`<nav className="ml-6 hidden items-center justify-center gap-6 ...">`), a new `Link` component was inserted as the first navigation item:
        ```typescript
        <Link href="/" className={desktopNavLinkClassName}>
            <Home size={14} className="mr-1 inline" />
            {tNav("home")}
        </Link>
        ```
    *   This `Link` uses the `desktopNavLinkClassName` for consistent styling, includes the `Home` icon, and displays localized text for "home" using `tNav("home")`. This ensures a prominent "Home" option is always available in the main navigation for larger screens.

3.  **`apps/web/app/components/health/ChatUI.tsx`**:
    *   The `Home` icon was already imported from `lucide-react` in this file.
    *   Inside the `ChatUI` header, the `<h1>SahiDawa</h1>` title was wrapped with a `Link` component:
        ```typescript
        <Link
            href={`/${locale}`}
            className="text-xl font-semibold text-slate-800 no-underline transition-colors hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400"
        >
            SahiDawa
        </Link>
        ```
    *   The `href` is dynamically set to `/${locale}` to ensure proper internationalized routing back to the homepage, respecting the current language setting. Hover styles were added to visually indicate its clickable nature.

All `Link` components leverage our `next-intl` routing setup to ensure that navigation is handled correctly across different locales.

## Technical Decisions

The primary technical decision was to use the `Link` component from `@/i18n/routing` (which wraps `next-intl`'s `Link` component) for all navigation points. This choice is critical for maintaining SahiDawa's internationalization capabilities, ensuring that when a user navigates to the homepage, they are directed to the correct locale-prefixed URL (e.g., `/en`, `/hi`). Using a standard `<a>` tag would bypass Next.js's client-side routing and `next-intl`'s locale handling, leading to full page reloads and potential locale inconsistencies.

The `lucide-react` library was chosen for icons to maintain consistency with our existing UI component library and design system. The `Home` icon provides a universally recognized visual cue for navigation.

By providing multiple navigation points (global navbar, floating chatbot, dedicated chat page header), we aim for a robust and accessible user experience, catering to different interaction contexts without cluttering the UI. The decision to make the "SahiDawa" title clickable in `ChatUI.tsx` is a common pattern for returning to the homepage and feels natural for users.

## How To Re-Implement (Contributor Reference)

To re-implement or add similar home navigation functionality:

1.  **Identify Target Component:** Determine which UI component requires a home navigation link (e.g., a header, a sidebar, a modal).
2.  **Import Dependencies:**
    *   If an icon is desired, import it from `lucide-react`: `import { Home } from "lucide-react";`
    *   For client-side, internationalized routing, import our custom `Link` component: `import { Link } from "@/i18n/routing";`
    *   If the component is locale-aware, ensure `useLocale()` or `useTranslations()` is available to construct locale-specific paths or text.
3.  **Place the `Link` Component:**
    *   Wrap an existing element (like a title or logo) with the `Link` component, or
    *   Create a new `Link` component with an icon and/or text.
4.  **Configure `Link` Properties:**
    *   Set the `href` prop to `/` for the root homepage. If the component is locale-aware and you want to explicitly include the locale in the path, use `href={`/${locale}`}` (where `locale` is obtained from `useLocale()`).
    *   Apply appropriate `className` for styling, ensuring it integrates with the existing design system (e.g., `desktopNavLinkClassName` from `Navbar.tsx`).
    *   Add `aria-label` for accessibility, describing the link's purpose (e.g., `aria-label="Go to homepage"`).
    *   If using an icon, embed it within the `Link` component: `<Home size={18} />`.
    *   If using text, ensure it's localized using `useTranslations()`: `{t("home")}`.
5.  **Test:** Verify that clicking the link performs a client-side navigation to the correct homepage URL, respecting the current locale, and that styling is correct.

**Example Pattern (from `Chatbot.tsx`):**

```typescript
import { Home, X } from "lucide-react";
import { Link } from "@/i18n/routing";
// ... other imports and component logic

// Inside your component's render method, typically within a header or navigation area:
<div className="flex items-center gap-1">
    <Link
        href="/" // Or `/${locale}` if explicit locale prefix is needed
        className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
        aria-label="Go to homepage"
    >
        <Home size={18} />
    </Link>
    <button
        onClick={() => setIsOpen(false)}
        className="rounded-full p-2 text-white transition-colors hover:bg-white/20"
        aria-label="Close chat"
    >
        <X size={20} />
    </button>
</div>
```

## Impact on System Architecture

This change primarily impacts the frontend user experience and navigability. It does not introduce new backend services, database schema changes, or significant architectural shifts.

*   **Improved UX:** Users now have clear and consistent pathways to return to the homepage from various points in the application, enhancing overall usability.
*   **Design Consistency:** The use of `lucide-react` icons and existing styling classes ensures that the new navigation elements align with SahiDawa's established design language.
*   **Internationalization Adherence:** By utilizing `next-intl`'s `Link` component, we reinforce our commitment to a fully internationalized platform, ensuring navigation works seamlessly across all supported languages.
*   **No Performance Overhead:** The changes are minimal and involve client-side routing, adding negligible performance overhead.
*   **No Backend Impact:** This is purely a frontend enhancement; no changes were required to our API, data models, or server-side logic.

This feature unlocks a more intuitive user flow, especially for new users or those who might get "lost" in deeper application sections like the dedicated health chat.

## Testing & Verification

Verification for this change was primarily visual and functional, as documented in the "Proof of Work" section of the pull request.

1.  **Visual Inspection:** Screenshots were provided demonstrating the new "Home" link in the desktop `Navbar`, the "Home" icon button in the floating `Chatbot` panel, and the clickable "SahiDawa" title in the `ChatUI` header. This confirmed correct rendering and placement of the new UI elements.
2.  **Functional Testing:**
    *   The `Link` components were clicked in each context (`Navbar`, `Chatbot`, `ChatUI`) to verify that they correctly navigate to the SahiDawa homepage (`/` or `/${locale}`).
    *   Navigation was tested across different locales to ensure the `Link` components correctly preserve or redirect to the appropriate locale-prefixed URL.
    *   The `aria-label` attributes were implicitly verified by the PR description, ensuring accessibility considerations were addressed.
3.  **Edge Cases:**
    *   The behavior of the floating `Chatbot`'s home button when the chatbot is open and closed was implicitly tested by the screenshots showing the button within the open panel.
    *   Responsiveness for the `Navbar`'s home link (hidden on mobile, visible on desktop) was confirmed by the context of the `desktopNavLinkClassName`.

Specific automated test cases or unit tests added for this PR are not documented in this PR.