# ADR — fix(web): add prettier scripts and format files

> **Date:** 2026-06-04 | **PR:** #1152 | **Status:** Accepted

## Context

The `apps/web` workspace lacked an enforced, automated code formatting standard. This resulted in potential inconsistencies in code style across different contributors and files, increasing cognitive load during code reviews and potentially causing minor merge conflicts related to stylistic differences. A need was identified to establish a consistent and automated formatting baseline to improve code quality and maintainability.

## Decision

Prettier was adopted as the standard code formatter for the `apps/web` workspace. Formatting scripts (`format` and `format:check`) were added to `apps/web/package.json`. All existing files within `apps/web` were formatted according to the repository's Prettier configuration, ensuring immediate consistency across the codebase.

## Alternatives Considered

| Alternative                                                 | Why Rejected                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Relying on manual formatting and ESLint rules               | Manual formatting is prone to human error and inconsistency across a growing team. While ESLint can enforce some formatting rules, Prettier is specialized for opinionated, automatic code formatting, reducing the number of stylistic decisions developers need to make and simplifying ESLint configuration by offloading formatting concerns. |
| Using a different automatic formatter (e.g., Biome, Dprint) | Prettier is a widely adopted and mature solution in the JavaScript ecosystem, offering broad community support, extensive plugin availability, and integration with various IDEs and CI/CD pipelines. Introducing a less common formatter would require additional research, configuration, and potential learning curve for contributors.        |

## Consequences

**Positive:**

- Ensured consistent code style across the entire `apps/web` codebase, improving readability and maintainability.
- Reduced cognitive load for developers by automating formatting, allowing them to focus on logic rather than style.
- Streamlined code reviews by eliminating discussions about stylistic preferences.
- Improved developer onboarding experience by providing a clear and automated formatting standard.
- Reduced potential for merge conflicts arising from differing formatting styles.

**Trade-offs:**

- Required an initial, large-scale formatting commit, which could temporarily complicate `git blame` history for affected lines.
- Introduced a new development dependency (Prettier) and associated configuration overhead.
- Required all contributors to adopt Prettier in their local development workflow or rely on CI checks.

## Related Issues & PRs

- PR #1152: fix(web): add prettier scripts and format files
- Issue #947
