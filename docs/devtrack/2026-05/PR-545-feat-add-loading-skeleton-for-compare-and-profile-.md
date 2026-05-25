# PR #545 — feat: Add loading skeleton for compare and profile pages for better UX

> **Merged:** 2026-05-24 | **Author:** @harshitsaxena214 | **Area:** Frontend | **Impact Score:** 10 | **Closes:** #375

## What Changed

This pull request introduces loading skeleton screens for the Compare and Profile pages within our `apps/web` Next.js frontend. We added two new files, `apps/web/app/[locale]/compare/loading.tsx` and `apps/web/app/[locale]/profile/loading.tsx`, which export React components that render placeholder UI elements designed to mimic the layout of their respective pages while data is being fetched.

## The Problem Being Solved

Prior to this change, users navigating to the Compare or Profile pages would experience a blank screen or a partially rendered page during the asynchronous data fetching process. This lack of visual feedback could lead to increased perceived wait times, user frustration, and a less polished user experience. By implementing loading skeletons, we aim to provide immediate visual feedback, reduce perceived latency, and ensure a smoother transition as content loads.

## Files Modified

- `apps/web/app/[locale]/compare/loading.tsx`
- `apps/web/app/[locale]/profile/loading.tsx`

## Implementation Details

This feature leverages Next.js's built-in `loading.tsx` convention within the App Router. When a user navigates to a route segment (e.g., `/compare` or `/profile`), Next.js automatically renders the `loading.tsx` component found within that segment's directory while any data fetching operations (such as `fetch` calls or `async` components) for the page or its layout are in progress.

Both `CompareLoading` and `ProfileLoading` are simple functional React components that return a structured `div` hierarchy. These `div` elements are styled using Tailwind CSS utility classes to create the skeleton effect:

1.  **Layout Mimicry:** The `div` structure within each `loading.tsx` file is carefully designed to mirror the actual layout of the corresponding page. This includes mimicking the main sections, headers, input fields, cards, and buttons.
2.  **Placeholder Styling:**
    - `animate-pulse`: This Tailwind class is applied to most skeleton elements to provide a subtle, continuous pulsating animation, indicating an active loading state.
    - `bg-slate-200` and `bg-slate-100`: These classes define the background color of the placeholder shapes, typically a light grey, consistent with modern loading patterns.
    - `h-[...]` and `w-[...]`: Explicit height and width utility classes are used to define the dimensions of the placeholder blocks, matching the expected size of the content they represent (e.g., `h-4 w-36` for a title, `h-10 w-full` for an input field).
    - `rounded-[...]`: Border-radius classes (e.g., `rounded-lg`, `rounded-xl`, `rounded-3xl`) are applied to match the curvature of the actual UI components, ensuring a visually consistent transition.
    - Flexbox and Grid utilities (`flex`, `grid`, `gap-X`, `space-y-X`, `items-center`, `justify-between`) are used to arrange the skeleton blocks in a way that closely replicates the page's structural flow.

For `CompareLoading`, the skeleton includes placeholders for the page header (title, back arrow), the search section with two medicine input fields, an empty state card, and a "Find pharmacies" link.

For `ProfileLoading`, the skeleton provides placeholders for the back button, the user header (avatar, name, email), and the profile card containing user information and menu items.

Once the data for the respective page is successfully fetched, Next.js automatically replaces the `loading.tsx` component with the fully rendered page content.

## Technical Decisions

1.  **Leveraging Next.js App Router `loading.tsx` Convention:** We chose this approach because it is the idiomatic and most efficient way to handle loading states in a Next.js App Router application. It requires minimal boilerplate, as Next.js automatically manages the rendering and unmounting of the loading component, simplifying our frontend logic. This avoids the need for manual state management (e.g., `isLoading` flags) within the page components themselves for initial data fetches.
2.  **Tailwind CSS for Styling:** Tailwind CSS was selected for styling the skeletons due to its utility-first nature, which aligns with our existing frontend development practices. It allows for rapid prototyping and precise control over the visual appearance of the skeletons without writing custom CSS, ensuring consistency with our design system. The `animate-pulse` utility is particularly effective for creating the desired visual feedback.
3.  **Custom Skeleton Implementation vs. Library:** We opted to implement the skeletons using basic HTML `div` elements and Tailwind CSS rather than incorporating a dedicated skeleton UI library. This decision was made to keep our dependency footprint lean, maintain full control over the exact look and feel to perfectly match our UI, and avoid potential overhead or styling conflicts that might arise from an external library.
4.  **Close UI Mimicry:** The decision to meticulously match the skeleton's structure, dimensions, and shapes to the actual page content is a critical UX choice. This ensures a "shimmer" effect that closely resembles the final UI, minimizing jarring layout shifts (Cumulative Layout Shift) when the real content loads and providing a smoother, more pleasant user experience.

## How To Re-Implement (Contributor Reference)

To implement a loading skeleton for a new or existing route segment in `apps/web` using the Next.js App Router pattern:

1.  **Identify the Target Route:** Determine the specific route segment (e.g., `app/[locale]/your-new-page`) for which you want to display a loading state.
2.  **Create `loading.tsx`:** Inside the directory of that route segment, create a new file named `loading.tsx`. For example, if your page is at `app/[locale]/settings/page.tsx`, create `app/[locale]/settings/loading.tsx`.
3.  **Define the Loading Component:** Export a default React functional component from this `loading.tsx` file. This component will render your skeleton UI.

    ```typescript
    // apps/web/app/[locale]/your-new-page/loading.tsx
    export default function YourNewPageLoading() {
        return (
            // Your skeleton UI goes here
            <div className="min-h-screen bg-slate-50 p-8">
                {/* Example: A header skeleton */}
                <div className="mb-6 h-8 w-64 animate-pulse rounded-lg bg-slate-200" />

                {/* Example: A content block skeleton */}
                <div className="space-y-4">
                    <div className="h-4 w-full animate-pulse rounded-md bg-slate-100" />
                    <div className="h-4 w-5/6 animate-pulse rounded-md bg-slate-100" />
                    <div className="h-4 w-3/4 animate-pulse rounded-md bg-slate-100" />
                </div>
            </div>
        );
    }
    ```

4.  **Structure the Skeleton UI:**
    - Analyze the layout of the actual page (`page.tsx`) you are creating the skeleton for.
    - Use `div` elements to represent the main structural blocks, such as headers, cards, input fields, text blocks, and buttons.
    - Apply Tailwind CSS utility classes to these `div`s:
        - `animate-pulse`: Essential for the visual loading effect.
        - `bg-slate-200` or `bg-slate-100`: For the background color of the placeholder shapes.
        - `h-[...]` and `w-[...]`: To set appropriate heights and widths that roughly match the content.
        - `rounded-[...]`: To match the border-radius of actual UI components.
        - Layout utilities (`flex`, `grid`, `space-y-X`, `gap-X`, `p-X`, `m-X`, `items-center`, `justify-between`) to replicate the page's flow and spacing.
5.  **Verification:** Run the application locally and navigate to the route. If data fetching is slow (e.g., by simulating slow network conditions in browser developer tools), you should observe your `loading.tsx` component rendering before the actual page content appears.

The `loading.tsx` component will automatically be displayed by Next.js whenever data is being fetched for the corresponding route segment, including any `async` components or `fetch` calls within the `page.tsx` or its `layout.tsx`.

## Impact on System Architecture

This change primarily impacts the user experience layer of our `apps/web` frontend.

- **Enhanced User Experience:** The most significant impact is the direct improvement in user experience. By providing visual feedback during loading, the application feels more responsive, professional, and reliable, which is crucial for user retention and satisfaction on our rural health platform.
- **Frontend Consistency:** This PR establishes a clear pattern for implementing loading states across our Next.js App Router frontend. This promotes consistency in how we handle asynchronous operations, making it easier for future contributors to add similar UX enhancements to new or existing routes.
- **No Backend or Data Impact:** This is a purely client-side UI enhancement. It does not introduce any changes to our `apps/api` backend, `apps/ml` services, or database schemas. The data fetching mechanisms remain unchanged; only the visual representation during the fetching process is altered.
- **Scalability for Future Features:** The `loading.tsx` pattern is inherently scalable. As we introduce more data-intensive pages or features, we can easily create corresponding `loading.tsx` files to maintain a consistent and positive user experience without adding complexity to our state management.

## Testing & Verification

The primary method of testing and verification for this change was manual inspection and observation.

1.  **Manual Navigation:** The author manually navigated to the `/compare` and `/profile` pages in the `apps/web` application.
2.  **Visual Confirmation:** The presence and correct rendering of the skeleton UI were confirmed by observing the pages during their initial load.
3.  **Screenshots:** Screenshots provided in the PR description serve as visual proof of the implemented skeletons, demonstrating that they appear as intended and closely match the final UI layout.
4.  **Simulated Latency (Inferred):** While not explicitly documented, it is standard practice for frontend developers to simulate slower network conditions (e.g., using browser developer tools) to ensure that loading states are visible for a sufficient duration and provide the intended user experience.
5.  **Edge Cases:**
    - **Fast Networks:** On very fast network connections, the skeletons might appear for only a fleeting moment or not at all, which is an acceptable outcome as the perceived performance is already high.
    - **Error States:** This implementation specifically addresses the _loading_ state. It does not provide UI for _error_ states during data fetching. Error handling and corresponding UI would typically be managed by the page component itself once a fetch operation fails.
    - **Accessibility:** Not documented in this PR. While `animate-pulse` provides visual feedback, considerations for users with motion sensitivities (e.g., providing an option to disable animations) were not addressed in this specific change.
    - **Internationalization:** The `loading.tsx` files are correctly placed within the `app/[locale]/` structure, ensuring they are part of the internationalized routing system, though the skeletons themselves are visual and do not contain translatable text.
