# PR #1106 — fix(web): stabilize sign-in navigation

> **Merged:** 2026-06-02 | **Author:** @saurabhhhcodes | **Area:** Frontend | **Impact Score:** 8 | **Closes:** #817

## What Changed

This pull request refactors the navigation for the "Sign In" and "Health Companion" buttons within our `Navbar.tsx` component. We replaced imperative `router.push` calls, which manually constructed locale-prefixed paths, with declarative `Link` components from our `@/i18n/routing` solution. Additionally, a new regression test, `navbar-signin-navigation.test.tsx`, was added to ensure the correct `Link` usage and prevent reintroduction of the problematic navigation pattern.

## The Problem Being Solved

Prior to this change, our `Navbar.tsx` used `next/navigation`'s `useRouter` and `useParams` hooks to programmatically navigate to `/login` and `/health` routes. The `handleNavigation` function manually constructed the path as `/${locale}/${path}`. This approach was problematic because `useRouter` and `useParams` are client-side hooks. When the application was server-side rendered (SSR), the initial HTML might not correctly resolve the dynamic `[locale]` segment, leading to potential hydration mismatches or incorrect routes being pushed when the client-side JavaScript took over. This brittle, imperative path construction was identified as a source of instability, specifically addressed in issue #817, where users could encounter bad routes or navigation errors during initial page load or hydration.

## Files Modified

- `apps/web/app/[locale]/components/Navbar.tsx`
- `apps/web/tests/navbar-signin-navigation.test.tsx`

## Implementation Details

The core of this change involved modifying `apps/web/app/[locale]/components/Navbar.tsx`. We removed the imports for `useRouter` and `useParams` from `next/navigation`, as these were no longer needed for the refactored navigation. Consequently, the `router` instance and the `locale` extraction logic (`const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale;`) were also removed. The custom `handleNavigation` function, which was responsible for constructing and pushing the `/${locale}/${path}` routes, was entirely deleted.

In place of the `<button onClick={() => handleNavigation("path")}>` pattern, we introduced the `Link` component imported from `@/i18n/routing`. This `Link` component is our wrapper around `next-intl`'s `Link`, which automatically handles locale prefixing based on the current context. Specifically:

- The Health Companion button, previously a `<button>` with `onClick={() => handleNavigation("health")}`, was replaced with `<Link href="/health">`.
- Both the mobile and desktop "Sign In" buttons, which also used `onClick={() => handleNavigation("login")}`, were replaced with `<Link href="/login">`.

A new test file, `apps/web/tests/navbar-signin-navigation.test.tsx`, was added to provide regression coverage. This test suite uses `react-dom/server.renderToStaticMarkup` to render the `Navbar` component without a full browser environment. It includes several `jest.mock` calls to simulate dependencies like `next/image`, `next-intl`'s `useTranslations`, `next-themes`, and our `LanguageSwitcher`. The test suite contains two key assertions:

1.  `it("renders sign-in and health actions as locale-aware links")`: This test renders the `Navbar` to static HTML and asserts that the resulting markup contains `href="/login"` and `href="/health"`, confirming that the `Link` components are correctly rendering the target paths. It also checks for the presence of `Home.sign_in`, verifying translation key usage.
2.  `it("does not build sign-in paths from next/navigation params")`: This test directly reads the source code of `Navbar.tsx` using `readFileSync` and asserts that the file content does _not_ contain the problematic strings `useParams`, `handleNavigation`, or `router.push(`/${locale}/${path}`)`. This ensures that the old, unstable navigation logic has been completely removed.

## Technical Decisions

The primary technical decision was to transition from imperative, client-side-focused navigation using `router.push` to declarative, framework-managed navigation using the `Link` component.

- **Declarative `Link` vs. Imperative `router.push`**: The `Link` component (specifically our `next-intl` wrapped version) is the recommended way to handle internal navigation in Next.js applications, especially when dealing with internationalization. It provides several benefits:
    - **SSR Compatibility**: `Link` components are rendered as standard `<a>` tags on the server, ensuring that the initial HTML contains valid, navigable links. This prevents hydration mismatches and ensures a robust initial page load.
    - **Automatic Locale Handling**: Our `@/i18n/routing` `Link` component automatically prepends the correct locale to the `href` attribute, removing the need for manual `/${locale}/${path}` construction and reducing potential errors.
    - **Prefetching**: Next.js automatically prefetches linked pages that are in the viewport, improving perceived performance.
    - **Accessibility**: `Link` components inherently provide better accessibility than custom `button` elements with `onClick` handlers for navigation.
- **Removal of Manual Path Construction**: The manual construction of `/${locale}/${path}` was brittle and prone to errors, especially when `params.locale` might not be consistently available or correctly resolved during different rendering phases. By relying on `next-intl`'s `Link` component, we delegate this responsibility to a robust, tested library.
- **Introduction of a Regression Test**: Given the history of navigation issues (e.g., #817), adding a specific regression test was crucial. The test not only verifies the _presence_ of the correct `href` attributes but also explicitly checks for the _absence_ of the old, problematic code patterns. This dual approach provides strong assurance against future regressions.

## How To Re-Implement (Contributor Reference)

To re-implement this feature or apply similar stabilization to other navigation points:

1.  **Identify Imperative Navigation**: Locate any components that use `next/navigation`'s `useRouter` or `useParams` to construct and push routes programmatically, especially if they involve dynamic path segments like `[locale]`.
    - _Example of old pattern:_
        ```typescript
        import { useRouter, useParams } from "next/navigation";
        // ...
        const router = useRouter();
        const params = useParams();
        const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
        const handleNavigation = (path: string) => {
            router.push(`/${locale}/${path}`);
        };
        // ...
        <button onClick={() => handleNavigation("some-path")}>Navigate</button>
        ```
2.  **Remove `next/navigation` Hooks**: Delete `import { useRouter, useParams } from "next/navigation";` and any associated variable declarations (`router`, `params`, `locale`) and helper functions (`handleNavigation`).
3.  **Import `Link` from `@/i18n/routing`**: Ensure your component imports the `Link` component:
    ```typescript
    import { Link, usePathname } from "@/i18n/routing"; // usePathname is often needed for active link styling
    ```
4.  **Replace Buttons with `Link` Components**: Convert the `button` elements used for navigation into `Link` components. The `href` prop should be the absolute path _without_ the locale prefix (e.g., `/login`, `/health`). The `next-intl` `Link` will handle the locale prefix automatically.
    - _Example of transformation:_
        ```diff
        - <button onClick={() => handleNavigation("login")} className="...">
        -     <span>Sign In</span>
        - </button>
        + <Link href="/login" className="...">
        +     <span>Sign In</span>
        + </Link>
        ```
    - Ensure any existing styling, `aria-label`, `title`, or `sr-only` spans are transferred to the `Link` component or its children as appropriate.
5.  **Add Regression Tests**: Create a new test file (e.g., `tests/your-feature-navigation.test.tsx`) or extend an existing one.
    - Use `renderToStaticMarkup` to render the component.
    - Mock necessary dependencies (e.g., `next-intl`, `next/image`).
    - Assert that the rendered markup contains the expected `href` attributes for the `Link` components.
    - Crucially, add a test that reads the component's source file and asserts the _absence_ of the old `useParams`, `router.push`, and manual path construction patterns. This prevents future regressions.

## Impact on System Architecture

This change significantly improves the stability and robustness of our frontend navigation, particularly for internationalized routes.

- **Enhanced Stability**: By eliminating a source of potential hydration mismatches and bad routes, we make the SahiDawa web platform more reliable for users, especially those accessing it in different locales. This directly addresses and closes a long-standing issue (#817).
- **Improved Developer Experience**: The `Navbar.tsx` component's navigation logic is now cleaner, more declarative, and easier to understand. Developers no longer need to worry about manually constructing locale-aware paths, reducing the cognitive load and potential for errors.
- **Adherence to Best Practices**: We are now more closely aligned with recommended Next.js and `next-intl` patterns for handling internationalized routing, which is a foundational aspect of our platform.
- **Foundation for Future Features**: A stable and predictable navigation system is critical for building out complex features like user authentication flows, personalized health dashboards, and other platform functionalities. This change provides a solid base for future development.

## Testing & Verification

This change was thoroughly tested through both automated and manual verification steps:

1.  **Unit Testing (`apps/web/tests/navbar-signin-navigation.test.tsx`)**:
    - The new test file verifies that the `Navbar` component, when rendered to static HTML, correctly outputs `<a>` tags with `href="/login"` and `href="/health"`. This confirms the `Link` components are functioning as expected.
    - A critical part of the test suite involves reading the `Navbar.tsx` source file to explicitly assert that the problematic `useParams`, `handleNavigation`, and `router.push(`/${locale}/${path}`)` patterns are no longer present in the code. This is a strong regression check.
2.  **Manual Validation (as per PR description)**:
    - `npm test -- --runTestsByPath tests/navbar-signin-navigation.test.tsx`: This command was used to execute the newly added unit tests, ensuring they pass.
    - `NODE_PATH=/private/tmp/sahidawa-817/apps/web/node_modules /private/tmp/sahidawa-817/apps/web/node_modules/.bin/eslint apps/web/app/'[locale]'/components/Navbar.tsx apps/web/tests/navbar-signin-navigation.test.tsx --quiet`: This ESLint command was run to ensure that the modified `Navbar.tsx` and the new test file adhere to our coding standards and do not introduce any new linting issues.
    - `npm run build -w web`: A full build of the `web` application was performed to verify that the changes do not introduce any compilation errors and that the application can be built successfully.

**Edge Cases**: The primary edge case addressed by this PR was the hydration mismatch and incorrect route resolution during SSR for dynamically locale-prefixed paths. By switching to `next-intl`'s `Link` component, this specific class of edge cases related to server-client rendering discrepancies for internationalized routes is mitigated. Other general navigation edge cases (e.g., network issues, invalid routes) are handled by Next.js's default routing mechanisms and were not specifically targeted by this fix.
