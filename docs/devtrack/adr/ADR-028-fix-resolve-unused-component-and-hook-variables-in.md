# ADR — fix: Resolve Unused Component and Hook Variables in Web App

> **Date:** 2026-06-07 | **PR:** #1476 | **Status:** Accepted

## Context

The SahiDawa frontend codebase had accumulated unused variables and imports across various components, pages, and utility files. This accumulation resulted in code clutter, reduced readability, and consistently triggered ESLint warnings within the CI pipeline, indicating a decline in code quality and maintainability.

## Decision

A targeted refactoring effort was undertaken to systematically identify and remove all unused component and hook variables, as well as unused import statements, from the web application. This involved direct deletion of unreferenced `lucide-react` icons (e.g., `Check`, `Heart`, `AlertCircle`, `Globe`, `Moon`, `ArrowRight`), unutilized local variables (e.g., `locale` in `layout.tsx`), and redundant state declarations (e.g., `isOnline` in `offline/page.tsx`). The `catch` block variable `err` in `overpassApi.ts` was also removed where it was not explicitly used.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Ignore unused code and ESLint warnings** | This approach would perpetuate technical debt, maintain code clutter, and allow CI warnings to persist, potentially masking more critical issues. It contradicts established best practices for code quality and maintainability. |
| **Automate removal with linter autofix or script** | While potentially faster for initial cleanup, relying solely on automation could lead to unintended deletions or removal of code that was temporarily commented out or intended for future, immediate use. Manual review ensured precise and intentional removal of genuinely dead code. |
| **Refactor components to utilize existing "unused" variables** | This would significantly expand the scope of the task beyond code cleanup, potentially introducing new features or altering existing logic unnecessarily. The identified variables were genuinely unreferenced and not merely dormant. |

## Consequences

**Positive:**
- **Improved Code Readability:** The codebase is now cleaner, making it easier for developers to understand and navigate active logic.
- **Reduced Technical Debt:** Elimination of dead code reduces the overall technical debt, streamlining future development and maintenance.
- **Cleaner CI Pipeline:** ESLint warnings related to unused variables and imports are resolved, resulting in a more focused and actionable CI output.
- **Minor Performance Gains:** Removing unused imports and variables can marginally reduce JavaScript bundle size and parsing overhead, contributing to improved load times and runtime efficiency.

**Trade-offs:**
- **Manual Effort:** The process required manual review and modification across numerous files, consuming developer time.

## Related Issues & PRs

- PR #1476: fix: Resolve Unused Component and Hook Variables in Web App
- Issue #1374: Unused Component and Hook Variables in Web App