# ADR — feat(auth): add signup page with email and OAuth registration

> **Date:** 2026-06-22 | **PR:** #2371 | **Status:** Accepted

## Context

Prior to this decision, SahiDawa lacked a direct, user-initiated registration pathway for new users. User accounts were likely provisioned through existing login mechanisms (implying pre-registration) or administrative processes. This limitation hindered user onboarding, scalability, and broad adoption for an open-source platform. A clear, accessible, and self-service registration flow was required to enable new users to create accounts via standard email/password or common OAuth providers.

## Decision

A dedicated `/signup` route was implemented to provide a comprehensive user registration experience. This page integrates:

- Email and password registration with fields for Full Name, Email, Password, and Confirm Password.
- Client-side validation for input fields, including password strength checks and visibility toggles.
- Integration with Google and GitHub for OAuth-based registration.
- Bidirectional navigation links between the `/login` and `/signup` pages.
- Responsive design, support for Light and Dark themes, and adherence to existing authentication UI patterns.
- The application's Navbar was configured to be hidden on the `/signup` route, mirroring the `/login` page behavior.
- Supabase client-side SDK was utilized for handling authentication requests.

## Alternatives Considered

| Alternative                                      | Why Rejected                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integrate signup directly into the `/login` page | Combining login and signup forms on a single page could lead to a cluttered user interface, particularly with the inclusion of multiple OAuth options. It might also complicate form state management and validation logic, potentially degrading the user experience for both new and returning users. |
| Restrict registration to OAuth providers only    | Limiting registration solely to OAuth providers would exclude users who prefer or require email/password registration, or those who do not use the supported OAuth services. This would reduce accessibility and user choice, hindering broader adoption.                                               |
| Maintain admin-only account creation             | Relying solely on administrative account creation is not scalable for an open-source platform aiming for widespread user engagement. It introduces a bottleneck for user onboarding and prevents self-service account management, which is critical for growth.                                         |

## Consequences

**Positive:**

- Establishes a clear, self-service onboarding path for new users, significantly improving user acquisition.
- Enhances user experience through a dedicated, intuitive, responsive, and theme-aware registration interface.
- Increases accessibility by offering multiple registration methods (email/password, Google, GitHub).
- Improves security posture for user inputs through client-side validation and strong password requirements.

**Trade-offs:**

- Introduces a new route and associated UI components, increasing the application's frontend codebase size and complexity.
- Adds maintenance overhead for the new page, including internationalization (I18n) strings and dedicated test coverage.
- Requires robust backend authentication service integration and security considerations for handling new user registrations and credentials.

## Related Issues & PRs

- PR #2371: feat(auth): add signup page with email and OAuth registration
- Issue #2217
