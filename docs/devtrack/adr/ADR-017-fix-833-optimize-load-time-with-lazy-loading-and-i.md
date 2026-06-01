# ADR — Fix #833: Optimize Load Time with Lazy Loading and Image Optimization

> **Date:** 2024-07-30 | **PR:** #833 | **Status:** Accepted

## Context

The SahiDawa web platform experienced suboptimal page load times, particularly on pages with numerous images. The existing custom `LazyImage` component, while providing basic lazy loading, did not fully leverage modern image optimization techniques such as automatic responsive image generation, format conversion (e.g., WebP, AVIF), or efficient caching. This resulted in larger image payloads, increased network requests, and a degraded user experience, especially for users on slower networks or devices.

## Decision

The team decided to adopt Next.js's built-in `next/image` component for all image handling within the `apps/web` frontend. This decision involved:
1.  Refactoring the existing `LazyImage` component to internally utilize `next/image`, removing its custom Intersection Observer logic.
2.  Directly replacing standard `<img>` tags with `next/image` in core components, such as `Navbar.tsx`.
This approach offloads image optimization, responsive sizing, and native lazy loading to the Next.js framework, ensuring images are served efficiently.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Enhance Custom Lazy Loading Implementation | While feasible, extending the custom `LazyImage` component to include advanced features like responsive `srcset` generation, format conversion, and sophisticated caching would have required significant development effort, maintenance overhead, and would likely not match the performance or robustness of a framework-native solution like `next/image`. |
| Integrate Third-Party Image Optimization Service | Services like Cloudinary or Imgix offer comprehensive image optimization. However, integrating a new external service would introduce additional cost, a new dependency, and potential vendor lock-in, which was deemed unnecessary given Next.js provides robust built-in capabilities for the current requirements. |

## Consequences

**Positive:**
- Significantly improved page load performance and Core Web Vitals (e.g., LCP, CLS) due to automatic image optimization, responsive sizing, and efficient lazy loading provided by `next/image`.
- Reduced client-side JavaScript bundle size by removing the custom Intersection Observer implementation from `LazyImage`.
- Simplified image management and development workflow by leveraging Next.js's integrated features, reducing manual optimization efforts.
- Enhanced user experience, particularly for users with varying network conditions and device capabilities.

**Trade-offs:**
- Increased dependency on the Next.js framework for image handling, potentially complicating future migrations to alternative frontend frameworks.
- Requires careful configuration of `next.config.mjs` for external image domains to ensure proper image loading and optimization.
- Initial refactoring effort was required to replace existing `<img>` tags and adapt the custom `LazyImage` component.

## Related Issues & PRs

- PR #833: Fix #833: Optimize Load Time with Lazy Loading and Image Optimization