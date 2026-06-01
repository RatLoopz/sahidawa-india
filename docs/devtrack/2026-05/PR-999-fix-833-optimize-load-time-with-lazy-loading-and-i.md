# PR #999 — Fix #833: Optimize Load Time with Lazy Loading and Image Optimization

> **Merged:** 2026-05-31 | **Author:** @basantnema31 | **Area:** Frontend | **Impact Score:** 21

## What Changed

This pull request significantly enhances the frontend performance of our `apps/web` application by migrating our image handling to leverage Next.js's built-in `Image` component. We refactored our custom `LazyImage` component to wrap `next/image` and updated `next.config.mjs` to enable optimization for images served from external domains like Cloudinary. Additionally, the `favicon.ico` in the `Navbar` was updated to use the `next/image` component.

## The Problem Being Solved

Before this PR, our system relied on a custom `LazyImage` component that used an `IntersectionObserver` for lazy loading, and standard `<img>` tags for other images. This approach lacked the advanced optimization capabilities inherent to Next.js's `Image` component, such as automatic image resizing, format conversion (e.g., to WebP or AVIF), and intelligent priority loading. This resulted in suboptimal page load times, larger image file sizes, and potentially poorer Core Web Vitals scores. Specifically, images hosted on `res.cloudinary.com` could not be optimized by Next.js, and even static assets like `/favicon.ico` were not benefiting from the framework's performance features.

## Files Modified

- `apps/web/app/[locale]/components/Navbar.tsx`
- `apps/web/components/LazyImage.tsx`
- `apps/web/components/ui/Skeleton.tsx`
- `apps/web/next.config.mjs`
- `apps/web/proxy.ts`

## Implementation Details

The core of this PR involves integrating Next.js's `Image` component for improved performance:

1.  **`apps/web/next.config.mjs` Configuration:**
    *   We introduced an `images` configuration object within `next.config.mjs`.
    *   Inside this object, `remotePatterns` was added to explicitly whitelist `https://res.cloudinary.com`. This is crucial for `next/image` to be able to process, optimize, and serve images from our Cloudinary CDN, ensuring they benefit from features like automatic resizing and format conversion.

2.  **`apps/web/app/[locale]/components/Navbar.tsx` Update:**
    *   The `Navbar.tsx` component was updated to import `Image from "next/image"`.
    *   The existing `<img src="/favicon.ico" ... />` tag, used for the SahiDawa logo, was replaced with the `next/image` component: `<Image src="/favicon.ico" alt="" aria-hidden="true" width={36} height={36} />`. We explicitly added `width` and `height` props to prevent layout shifts (CLS) for this static asset.

3.  **`apps/web/components/LazyImage.tsx` Refactor:**
    *   This component, previously responsible for custom lazy loading via `IntersectionObserver`, was significantly refactored.
    *   We removed the `useEffect` hook, `useRef` hook (`wrapperRef`), `isInView` state, and all associated `IntersectionObserver` logic. Next.js's `Image` component handles lazy loading intrinsically.
    *   The component now imports `Image from "next/image"` and renders it internally.
    *   The custom `<img>` tag was replaced with `<Image {...(imgProps as any)} src={src} alt={alt || ""} fill onLoad={handleLoad as any} ... />`.
    *   The `fill` prop was added to `next/image`, indicating that the image should fill the dimensions of its parent container. This is consistent with how our custom `LazyImage` component previously managed its size within a `<span>` wrapper.
    *   The `isLoaded` state and `handleLoad` function were retained. This allows us to keep our custom blur-in effect and the `Skeleton` placeholder UI while the image is loading, providing a consistent user experience during image transitions.
    *   The `rootMargin` and `threshold` props were kept in the `LazyImageProps` interface but are now effectively unused by the underlying `next/image` component, serving primarily for API compatibility.

4.  **`apps/web/components/ui/Skeleton.tsx` Minor Type Change:**
    *   The type definition for `SkeletonProps` was updated from an `interface` to a `type` alias: `export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;`. This is a minor code style refinement.

5.  **`apps/web/proxy.ts` Minor Refactor:**
    *   A minor change was made from `let res = intlMiddleware(req);` to `const res = intlMiddleware(req);`. This improves code immutability as the `res` variable is not reassigned after its initial declaration.

## Technical Decisions

1.  **Migration to `next/image`:** Our primary technical decision was to fully embrace Next.js's `Image` component for all image handling. This was chosen over maintaining our custom `IntersectionObserver`-based lazy loading solution due to the superior, built-in optimizations offered by `next/image`. These include automatic image resizing for different screen sizes, conversion to modern formats like WebP or AVIF, and intelligent lazy loading, all of which significantly reduce image payload, improve page load speed, and contribute positively to Core Web Vitals (e.g., Largest Contentful Paint, Cumulative Layout Shift).
2.  **Refactoring `LazyImage` as a Wrapper:** Instead of deprecating or removing our existing `LazyImage` component, we decided to refactor it to act as a wrapper around `next/image`. This approach allows us to retain our custom loading UI (the `Skeleton` component and the blur-in transition) while delegating the core performance-critical tasks (lazy loading, optimization) to the framework. This provides a consistent visual experience for image loading across the application without reinventing complex optimization logic.
3.  **Explicit `remotePatterns` Configuration:** The decision to add `res.cloudinary.com` to `remotePatterns` in `next.config.mjs` was a necessary security and performance measure. Next.js requires explicit whitelisting of external domains for image optimization to prevent arbitrary image requests and ensure that only trusted sources are processed. Since Cloudinary is our primary image hosting solution, this configuration is fundamental for optimizing our dynamic content images.
4.  **Minor Code Quality Improvements:** The changes in `Skeleton.tsx` and `proxy.ts` represent minor code quality enhancements. Using `const` for variables that are not reassigned improves code clarity and helps prevent accidental mutations. The type alias for `SkeletonProps` is a stylistic choice that aligns with modern TypeScript practices.

## How To Re-Implement (Contributor Reference)

To re-implement or extend this image optimization strategy:

1.  **Configure `next.config.mjs` for External Images:**
    *   If you need to optimize images from any external domain (e.g., a CDN or third-party service), you must add that domain to the `images.remotePatterns` array in `apps/web/next.config.mjs`.
    *   Example:
        ```javascript
        // apps/web/next.config.mjs
        const nextConfig = {
          // ... other config
          images: {
            remotePatterns: [
              {
                protocol: 'https',
                hostname: 'res.cloudinary.com', // Add your domain here
              },
              // Add other domains as needed
            ],
          },
          // ... other config
        };
        ```
2.  **Replace `<img>` Tags with `next/image`:**
    *   For any static images or images where you control the dimensions, import `Image from "next/image"` at the top of your component file.
    *   Replace the `<img>` tag with `<Image />`, ensuring you provide `src`, `alt`, `width`, and `height` props.
    *   Example (from `Navbar.tsx`):
        ```typescript
        import Image from "next/image";
        // ...
        <Image
            src="/favicon.ico"
            alt=""
            aria-hidden="true"
            width={36}
            height={36}
        />
        ```
3.  **Utilize the `LazyImage` Component for Dynamic Content:**
    *   For images that require a custom loading state (like our blur-in effect and `Skeleton` placeholder) or where the image needs to fill its parent container, use our `apps/web/components/LazyImage.tsx` component.
    *   This component internally uses `next/image` with the `fill` prop. Ensure its parent container has `position: relative` (or `absolute`, `fixed`, `sticky`) and defined dimensions for `fill` to work correctly.
    *   Example usage:
        ```typescript
        import LazyImage from "@/components/LazyImage";
        // ...
        <div className="relative h-48 w-full"> {/* Parent must have position and dimensions */}
            <LazyImage
                src={imageUrl}
                alt="Description of image"
                className="rounded-md"
                wrapperClassName="rounded-md"
            />
        </div>
        ```
4.  **Accessibility:** Always provide a meaningful `alt` prop for all `Image` and `LazyImage` components for screen readers and SEO.
5.  **Testing:** Verify image loading behavior in development and production builds. Use browser developer tools (Network tab) to confirm images are lazy-loaded and served in optimized formats (e.g., WebP). Check for layout shifts using the Performance tab or Lighthouse reports.

## Impact on System Architecture

This change significantly impacts the `apps/web` frontend architecture by:

*   **Improving Performance:** It directly addresses page load performance, reducing the Largest Contentful Paint (LCP) and Cumulative Layout Shift (CLS) metrics. This leads to a faster, smoother user experience and better search engine rankings.
*   **Reducing Client-Side Overhead:** By offloading complex image optimization and lazy loading logic to Next.js, we reduce the amount of custom JavaScript required on the client side, leading to smaller bundle sizes and faster initial page loads.
*   **Standardizing Image Handling:** We now have a consistent, framework-driven approach to image optimization across the application, reducing the maintenance burden of custom solutions and ensuring future image features can leverage Next.js's capabilities.
*   **Increased Dependency on Next.js Features:** Our frontend now has a deeper integration with and dependency on the `next/image` component. Future image-related development will naturally revolve around this component and its configuration.
*   **Enhanced Scalability:** The automatic optimization for remote images from Cloudinary ensures that as our content library grows, image delivery remains efficient without manual intervention for each new image.

## Testing & Verification

The verification process for this change, as implied by the PR checklist, included:

*   **Local Project Verification:** The author confirmed that the project ran locally without compile or build errors.
*   **Visual Inspection:** For frontend/UI changes, visual proof (screenshots/screen recordings) is required. Not documented in this PR.
*   **Network Tab Analysis:** While not explicitly stated in the PR description, typical verification for image optimization involves inspecting the browser's network tab to confirm that images are being lazy-loaded (loaded only when entering the viewport) and are served in optimized formats (e.g., WebP or AVIF) with appropriate `srcset` attributes.
*   **Performance Metrics:** Not documented in this PR. Ideally, performance tools like Lighthouse or PageSpeed Insights would be used to quantify improvements in metrics such as LCP and total page weight before and after the change.
*   **Edge Cases:** Not documented in this PR. Potential edge cases include images with invalid `src` URLs, images within rapidly changing layouts, or images that are critical for initial load and should not be lazy-loaded (which `next/image` handles with the `priority` prop).