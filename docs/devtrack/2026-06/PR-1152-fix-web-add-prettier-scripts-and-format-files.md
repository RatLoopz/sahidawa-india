# PR #1152 — fix(web): add prettier scripts and format files

> **Merged:** 2026-06-04 | **Author:** @Neverask1121 | **Area:** Frontend | **Impact Score:** 94 | **Closes:** #947

## What Changed

This pull request integrates Prettier into the `apps/web` workspace by adding dedicated `format` and `format:check` npm scripts to `apps/web/package.json`. Following the script additions, we executed the `format` script, which automatically reformatted all relevant files within the web application to align with our repository's established Prettier configuration. This change is purely cosmetic, ensuring code style consistency without altering any application logic.

## The Problem Being Solved

Prior to this PR, the `apps/web` frontend workspace lacked standardized and automated code formatting. This often led to inconsistencies in code style across different files and contributions, making the codebase harder to read, navigate, and maintain. Developers would spend time manually adjusting formatting or debating style during code reviews, which is inefficient. The absence of a `format:check` script also meant that style violations could easily slip into the `main` branch, degrading overall code quality. This PR addresses these issues by enforcing a consistent style and automating its verification.

## Files Modified

- `apps/web/.eslintrc.json`
- `apps/web/app/[locale]/components/Skeleton.tsx`
- `apps/web/app/[locale]/globals.css`
- `apps/web/app/[locale]/map/layout.tsx`
- `apps/web/app/[locale]/privacy/page.tsx`
- `apps/web/app/[locale]/report/ReportInfoPanel.tsx`
- `apps/web/app/[locale]/scan/layout.tsx`
- `apps/web/app/[locale]/scan/loading.tsx`
- `apps/web/app/[locale]/voice/VoicePanels.tsx`
- `apps/web/app/[locale]/voice/loading.tsx`
- `apps/web/app/loading.tsx`
- `apps/web/components/Card.tsx`
- `apps/web/components/OfflineBanner.tsx`
- `apps/web/components/scanner/BarcodeScanner.tsx`
- `apps/web/eslint.config.mjs`
- `apps/web/i18n/request.ts`
- `apps/web/lib/apiWithRetry.ts`
- `apps/web/lib/structuredLogger.ts`
- `apps/web/next.config.mjs`
- `apps/web/package.json`
- `apps/web/postcss.config.mjs`
- `apps/web/scripts/voice-a11y-audit.mjs`

## Implementation Details

The core of this implementation involved modifying `apps/web/package.json` to introduce two new scripts:

1.  `"format": "prettier --write ."`: This script utilizes the `prettier` CLI to automatically reformat all files within the `apps/web` directory that match Prettier's default file extensions (e.g., `.js`, `.jsx`, `.ts`, `.tsx`, `.json`, `.css`, etc.). The `--write` flag ensures that changes are applied directly to the files.
2.  `"format:check": "prettier --check ."`: This script also uses the `prettier` CLI but with the `--check` flag. Instead of writing changes, it verifies if all files within `apps/web` conform to the Prettier configuration. If any files are not formatted correctly, it will exit with a non-zero status code, making it suitable for CI/CD pipelines.

After adding these scripts, we ran `npm run format` from the `apps/web` directory. This command processed all 21 other listed files, applying the formatting rules defined in our root-level `.prettierrc` configuration. The changes observed in the diff (e.g., `apps/web/app/[locale]/components/Skeleton.tsx`, `apps/web/app/[locale]/globals.css`) primarily consist of adjustments to indentation, line breaks, spacing, and quotation styles, ensuring uniformity across the codebase. The `apps/web/.eslintrc.json` and `apps/web/eslint.config.mjs` files were also reformatted, demonstrating Prettier's ability to handle various file types.

## Technical Decisions

We chose Prettier for several key reasons:

- **Opinionated Formatting:** Prettier is highly opinionated, which minimizes configuration debates and ensures a consistent style with minimal effort. This aligns with our goal of reducing cognitive load for contributors.
- **Wide Language Support:** It supports a broad range of languages and frameworks commonly used in SahiDawa, including JavaScript, TypeScript, JSX, CSS, and JSON, which are prevalent in our Next.js frontend.
- **Integration with Development Tools:** Prettier integrates seamlessly with popular IDEs (like VS Code) and build tools, allowing for automatic formatting on save or during pre-commit hooks.
- **Standard Practice:** It is a widely adopted tool in the JavaScript ecosystem, making it familiar to many potential contributors.

The decision to add `format` and `format:check` scripts specifically to `apps/web/package.json` rather than a root `package.json` script was made to allow for granular control over formatting within individual workspaces of our monorepo. This enables us to run formatting operations only on the relevant part of the codebase, which is beneficial for larger projects and faster execution in CI. The use of a shared, root-level Prettier configuration (`.prettierrc` - Not documented in this PR if it exists at root, but implied by "repository's Prettier configuration") ensures that while scripts are workspace-specific, the style rules are consistent across the entire SahiDawa project.

## How To Re-Implement (Contributor Reference)

To re-implement this formatting setup for another workspace or from scratch, a contributor would follow these steps:

1.  **Ensure Prettier is installed:** Verify that `prettier` is a `devDependency` in the root `package.json` or the target workspace's `package.json`. If not, install it:
    ```bash
    npm install --save-dev prettier # or yarn add -D prettier
    ```
2.  **Define Prettier Configuration:** Ensure a `.prettierrc` file exists at the root of the repository (or within the workspace if specific overrides are needed). This file dictates the formatting rules (e.g., `semi: true`, `singleQuote: true`, `tabWidth: 4`).
3.  **Add Scripts to `package.json`:** Navigate to the `package.json` of the target workspace (e.g., `apps/web/package.json`) and add the following scripts to the `scripts` section:
    ```json
    {
        "scripts": {
            "format": "prettier --write .",
            "format:check": "prettier --check ."
        }
    }
    ```
    The `.` argument tells Prettier to process all files in the current directory and its subdirectories.
4.  **Run Formatting:** Execute the `format` script to apply the formatting rules:
    ```bash
    cd apps/web # or your target workspace
    npm run format
    ```
5.  **Verify Formatting:** Run the `format:check` script to confirm all files are correctly formatted:
    ```bash
    cd apps/web # or your target workspace
    npm run format:check
    ```
    This command should output "All matched files use Prettier code style!" if successful.
6.  **Integrate with ESLint (Optional but Recommended):** If ESLint is also used, consider integrating `eslint-config-prettier` and `eslint-plugin-prettier` to disable ESLint rules that conflict with Prettier and to report Prettier issues as ESLint errors. This ensures that ESLint and Prettier work harmoniously. The `apps/web/.eslintrc.json` and `apps/web/eslint.config.mjs` files were already present, and their reformatting indicates Prettier is aware of them.

## Impact on System Architecture

This change significantly enhances the maintainability and developer experience for the `apps/web` frontend.

- **Improved Code Quality:** By enforcing a consistent code style, we reduce the likelihood of style-related bugs and make the codebase more predictable and easier to understand for all contributors.
- **Streamlined Development Workflow:** Developers no longer need to manually format code or worry about style guides. They can run `npm run format` to automatically fix style issues, allowing them to focus on functionality.
- **Faster Code Reviews:** Code reviews can now focus purely on logic, architecture, and best practices, as style concerns are automated away. This reduces review time and friction.
- **Foundation for CI/CD:** The `format:check` script provides a robust mechanism to integrate style checks into our CI/CD pipeline. Future workflows can be configured to fail if code is not properly formatted, preventing unformatted code from being merged into `main`.
- **Onboarding:** New contributors will find it easier to contribute without needing to learn specific style nuances, as the tools handle it for them.

This PR sets a strong precedent for applying similar automated formatting across other SahiDawa workspaces (e.g., `apps/api`, `apps/ml`) to achieve a uniformly styled monorepo.

## Testing & Verification

Verification of this change was straightforward due to its purely stylistic nature.

1.  **Execution of `npm run format`:** The `format` script was run in the `apps/web` directory, which automatically modified the 21 listed files to conform to the repository's Prettier configuration.
2.  **Execution of `npm run format:check`:** After formatting, the `format:check` script was executed. As shown in the PR's proof of work, this command successfully reported "All matched files use Prettier code style!", confirming that the formatting was applied correctly and no further style violations existed.
3.  **No Logic Change:** A critical aspect of testing for refactor/code quality PRs is ensuring no functional changes were inadvertently introduced. The PR description explicitly states, "No application logic was changed," which was verified by reviewing the diffs to ensure only whitespace, line breaks, and quotation changes were present.

Edge cases for a pure formatting change are minimal, as it does not interact with runtime logic. The primary "edge case" is ensuring that Prettier's configuration correctly handles all file types and syntaxes present in the `apps/web` workspace without introducing parsing errors or unintended code alterations (e.g., changing string literals). This was implicitly covered by the successful execution of Prettier across the diverse set of modified files.
