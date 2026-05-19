# ADR — fix: resolve navbar routing, layout crash, and theme false-positive

> **Date:** 2026-05-18 | **PR:** #231 | **Status:** Accepted

## Context

The SahiDawa web application required enhanced user accessibility and engagement, particularly for users in rural health settings who could benefit from an installable, app-like experience without relying on traditional app stores. The existing web application lacked Progressive Web App (PWA) capabilities, resulting in a suboptimal mobile user experience, inconsistent theme integration, and no direct installability option. This limitation hindered user retention and reach in environments with varying internet connectivity.

## Decision

Progressive Web App (PWA) support was implemented for the SahiDawa web application. This decision involved creating a `manifest.json` file to define core app metadata, adding specific installable app icons (192x192 and 512x512), linking the manifest within the `app/[locale]/layout.tsx`, and configuring theme color metadata and viewport settings. The implementation aimed to enable installability on Android devices, provide a consistent theme experience, and improve overall web performance and user experience.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Not implementing PWA support | Would have left the application without an installable option, missing out on enhanced user engagement, offline capabilities, and a native app-like experience. This would limit reach in areas with inconsistent internet access and fail to address the desire for a more integrated user experience on mobile. |
| Developing a dedicated native mobile application (e.g., Android/iOS) | Requires separate development, maintenance, and deployment pipelines for each platform, significantly increasing development cost, time, and complexity. PWA offers a single codebase approach that leverages existing web technologies, making it a more resource-efficient solution for achieving app-like functionality. |
| Using a third-party PWA framework or library | The existing Next.js framework provides robust capabilities for PWA implementation with minimal external dependencies. Introducing another framework would add unnecessary complexity, potential compatibility issues, and a steeper learning curve for the team, without providing significant additional benefits over a native Next.js PWA implementation. |

## Consequences

**Positive:**
- SahiDawa is now installable on Android devices, providing an app-like experience directly from the web browser.
- Improved user engagement and accessibility through home screen access and potential for offline functionality.
- Enhanced brand presence with custom app icons and consistent theme integration.
- Better performance and user experience validated by Lighthouse audit and PWA compatibility checks.
- Streamlined development and maintenance compared to native mobile applications, leveraging the existing web codebase.

**Trade-offs:**
- Increased initial bundle size due to the addition of `manifest.json` and multiple icon assets.
- PWA features and installability can vary slightly across different browsers and operating systems, requiring careful testing and potential workarounds.

## Related Issues & PRs

- PR #231: fix: resolve navbar routing, layout crash, and theme false-positive
- Issue #33