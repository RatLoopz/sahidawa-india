# PR #1023 — redesign Explore Features section and fix CI test setup

> **Merged:** 2026-06-01 | **Author:** @PremSahith | **Area:** Frontend | **Impact Score:** 10 | **Closes:** #981

## What Changed

This pull request significantly overhauls the "Explore Features" section on the SahiDawa landing page, introducing a modern, interactive aesthetic with 3D hover effects, glowing gradients, and dynamic micro-animations. Concurrently, it resolves a critical issue in our CI pipeline by providing a mock `API_SECRET_KEY` environment variable, ensuring the successful execution of API tests.

## The Problem Being Solved

Before this PR, the "Explore Features" section on our landing page (`apps/web/app/[locale]/page.tsx`) presented a static and unengaging user experience, with feature cards lacking visual dynamism and interactivity, as identified in issue #981. This limited the platform's ability to convey its advanced capabilities effectively. Additionally, our continuous integration (CI) builds were consistently failing due to the absence of the `API_SECRET_KEY` environment variable during the execution of tests within `apps/api`, preventing reliable automated validation of our backend services.

## Files Modified

- `apps/api/tests/setup.ts`
- `apps/web/app/[locale]/globals.css`
- `apps/web/app/[locale]/page.tsx`

## Implementation Details

**1. Frontend UI/UX Redesign (`apps/web/app/[locale]/page.tsx` and `apps/web/app/[locale]/globals.css`):**

*   **Section Structure and Title:** The `<section>` element for "Explore Features" in `apps/web/app/[locale]/page.tsx` was updated to include `relative mb-20` and a new decorative background `div` utilizing `bg-[radial-gradient(...)]` for a subtle initial visual effect. The previous `h2` title was replaced with a more elaborate structure comprising a pulsing "Powerful Capabilities" status badge (`inline-flex items-center gap-2 rounded-full border border-slate-200/50 bg-white/50 px-4 py-2 text-sm font-bold shadow-sm backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/50`) and a redesigned `h2` with a prominent text gradient (`bg-linear-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-center text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl dark:from-white dark:via-slate-200 dark:to-slate-400`). A descriptive paragraph (`<p>`) was added to provide further context.
*   **Feature Card Enhancements:** Each feature card, implemented as a `<button>` element, received substantial styling updates:
    *   **Base Styling:** Card dimensions were increased to `h-[220px]`, corners softened with `rounded-[2rem]`, and a premium glassmorphism effect applied using `bg-white/60` and `backdrop-blur-xl`. An initial subtle shadow `shadow-[0_8px_30px_rgb(0,0,0,0.04)]` was also added.
    *   **3D Hover Interactions:** On hover, cards now exhibit a `transform-gpu` effect, lifting by `hover:-translate-y-2` (8px) and scaling up by `hover:scale-[1.02]` (2%). All transitions are smoothed with `transition-all duration-500`.
    *   **Dynamic Backgrounds:** The card borders dynamically change (e.g., `hover:border-emerald-400/50` for the "Upload Photo" card), and the background becomes more opaque (`hover:bg-white/90` or `dark:hover:bg-slate-800/80`). A new inner `div` provides a radiant background gradient on hover (e.g., `bg-linear-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-emerald-500/20`), matching the card's brand color.
    *   **Shadow Glow:** A prominent shadow glow is introduced on hover, e.g., `hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.3)]` for the emerald card, creating a distinct radiant effect.
    *   **Icon Enhancements:** The feature icons (e.g., `Camera`) are now wrapped in a `div` with complex hover animations:
        *   A `bg-linear-to-br` gradient and `shadow-inner` are applied to the icon container.
        *   On hover, the container `group-hover:scale-110 group-hover:rotate-6` scales up and rotates, its background gradient shifts (e.g., `group-hover:from-emerald-500 group-hover:to-teal-400`), and a glow shadow appears (`group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]`).
        *   The `Camera` icon itself also has a `transition-transform duration-500`.
    *   **Micro-animations:** The PR description mentions custom micro-animations (e.g., pulsing waveform for Voice Triage, radar rings for Pharmacy Map, red blur for Report Fake). While the diff shows the removal of an old waveform overlay, the new implementations are likely handled through advanced Tailwind classes or custom CSS not fully detailed in the truncated diff. A new `div` wrapper for the `ChevronRight` icon provides a subtle `opacity-0` to `group-hover:opacity-100` transition.
    *   **Text Styling:** The `h3` and `p` elements within each card received updated font sizes, weights, and `transition-colors` for a smoother hover experience.
*   **Global CSS (`apps/web/app/[locale]/globals.css`):** A general `.feature-card:hover` rule was added to provide a foundational hover effect (`border`, `background`, `transform`, `transition`, `cursor`). This acts as a base, with more specific and complex hover effects primarily managed via Tailwind utility classes directly in `page.tsx`.

**2. CI Test Fix (`apps/api/tests/setup.ts`):**

*   A critical line `process.env.API_SECRET_KEY = "test-secret-key";` was added to `apps/api/tests/setup.ts`. This ensures that during automated testing, the `API_SECRET_KEY` environment variable is consistently defined with a mock value, preventing runtime errors in tests that depend on its presence for secure API operations.

## Technical Decisions

*   **Tailwind CSS for UI Consistency and Rapid Development:** We chose to continue leveraging Tailwind CSS for the frontend redesign to maintain consistency with our existing tech stack. Tailwind's utility-first approach facilitates rapid UI development and provides granular control over styling, enabling the creation of complex interactive elements directly within the JSX using `group-hover:` variants.
*   **Premium Aesthetic with Glassmorphism and 3D Effects:** The decision to implement glassmorphism (`backdrop-blur-xl`) and 3D hover effects (`-translate-y-2`, `scale-[1.02]`) was driven by the goal of achieving a "premium, modern, and interactive aesthetic." These visual cues enhance user engagement by providing a sense of depth and responsiveness.
*   **Dynamic Visual Feedback:** The use of radiant background gradients and custom micro-animations for icons was chosen to provide immediate and distinct visual feedback upon user interaction, making each feature card feel more alive and reinforcing the "powerful capabilities" of SahiDawa.
*   **Robust CI Environment Variable Mocking:** Explicitly setting `process.env.API_SECRET_KEY` in `apps/api/tests/setup.ts` is a standard and robust practice for ensuring test isolation and reproducibility. This approach guarantees that tests can run independently of actual production environment configurations, preventing flaky CI builds caused by missing variables and improving the reliability of our automated testing.

## How To Re-Implement (Contributor Reference)

To re-implement the "Explore Features" section redesign and the CI test fix:

**1. Frontend "Explore Features" Section:**

*   **Update Global CSS:** Add the following base hover rule to `apps/web/app/[locale]/globals.css`:
    ```css
    /* Feature Card Hover Effects */
    .feature-card:hover {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.05);
      transform: translateY(-4px);
      transition: all 0.2s ease;
      cursor: pointer;
    }
    ```
*   **Modify `apps/web/app/[locale]/page.tsx`:**
    *   Locate the "Explore Features" `<section>` and update its class to `relative mb-20`.
    *   Insert the decorative background `div` immediately inside the section:
        ```tsx
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent opacity-50 dark:from-emerald-900/20"></div>
        ```
    *   Replace the existing title structure with the new `div` containing the pulsing badge, enhanced `h2` with a complex gradient, and the descriptive `p` tag. Ensure `tHome` is used for internationalization.
        ```tsx
        <div className="mb-12 flex flex-col items-center justify-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/50 bg-white/50 px-4 py-2 text-sm font-bold shadow-sm backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/50">
                <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                <span className="text-slate-700 dark:text-slate-300">
                    Powerful Capabilities
                </span>
            </div>
            <h2 className="bg-linear-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-center text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl dark:from-white dark:via-slate-200 dark:to-slate-400">
                Explore Features
            </h2>
            <p className="max-w-2xl text-center font-medium text-slate-500 dark:text-slate-400">
                Discover all the ways SahiDawa can help you verify your medicines
                and stay safe.
            </p>
        </div>
        ```
    *   For each feature card (`<button>`):
        *   Update the `className` with the new base styling and 3D hover effects (adjusting colors like `emerald-400/50` to `blue-400/50`, `amber-400/50`, `red-400/50` for respective cards).
            ```tsx
            className="group relative flex h-[220px] w-full transform-gpu cursor-pointer flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200/50 bg-white/60 p-6 text-left shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-500 select-none hover:-translate-y-2 hover:scale-[1.02] hover:border-emerald-400/50 hover:bg-white/90 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.3)] active:scale-[0.98] dark:border-slate-800/60 dark:bg-slate-900/40 dark:hover:border-emerald-500/50 dark:hover:bg-slate-800/80"
            ```
        *   Add the new background glow `div` inside each button (adjusting `from-emerald-500/5` color as needed):
            ```tsx
            <div className="absolute inset-0 -z-10 bg-linear-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-emerald-500/20"></div>
            ```
        *   Update the `div` wrapping the icon (e.g., `Camera`), applying the new gradient, inner shadow, and hover transformations (adjusting colors like `from-emerald-100` and `group-hover:from-emerald-500`):
            ```tsx
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-100 to-emerald-50 text-emerald-600 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 group-hover:from-emerald-500 group-hover:to-teal-400 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] dark:from-emerald-950/60 dark:to-emerald-900/40 dark:text-emerald-400">
                <Camera size={26} strokeWidth={2.5} className="transition-transform duration-500" />
            </div>
            ```
        *   Wrap the `ChevronRight` icon in a new `div` for its hover effect (adjusting `text-emerald-600` color):
            ```tsx
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/50 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 dark:bg-slate-800/50">
                <ChevronRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            ```
        *   Update the `h3` and `p` elements within each card with new font sizes, weights, and color transitions (adjusting `group-hover:text-emerald-700` color):
            ```tsx
            <h3 className="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300">
                {tHome("upload_photo")}
            </h3>
            <p className="mt-2 text-sm leading-snug font-medium text-slate-500 transition-colors group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-300">
                {tHome("upload_subtitle")}
            </p>
            ```
        *   Implement specific micro-animations for cards like "Voice Triage" or "Pharmacy Map" using additional `div`s with Tailwind `animate-*` classes or custom keyframe animations if required. Not documented in this PR.

**2. CI Test Setup:**

*   Open `apps/api/tests/setup.ts`.
*   Add the following line to define the mock `API_SECRET_KEY` environment variable:
    ```typescript
    process.env.API_SECRET_KEY = "test-secret-key";
    ```

**Dependencies:**
*   Tailwind CSS for styling.
*   `next-intl` for internationalization.
*   Lucide React for icons.

**Gotchas:**
*   Ensure the `group` class is correctly applied to parent elements for `group-hover:` variants to function.
*   Verify color consistency across light and dark modes for all new UI elements and gradients.
*   The exact implementation details for some micro-animations are not fully captured in the provided diff and may require further design reference.

## Impact on System Architecture

This PR primarily enhances the user-facing frontend and improves the robustness of our development workflow.

*   **Frontend User Experience:** The redesign of the "Explore Features" section significantly elevates the visual appeal and interactivity of the SahiDawa landing page. This improved UI/UX is critical for user engagement, conveying a sense of modernity and trustworthiness, and potentially setting a new standard for interactive elements across the platform.
*   **CI/CD Reliability:** The fix in `apps/api/tests/setup.ts` directly addresses a critical point of failure in our CI pipeline. By ensuring the `API_SECRET_KEY` is consistently available during test runs, we eliminate a source of build failures, leading to more stable and reliable automated testing. This improves developer productivity by reducing time spent on CI debugging and ensures that our backend services are properly validated.
*   **Maintainability:** The extensive use of Tailwind CSS for the new UI elements promotes maintainability by co-locating styles with their respective components, reducing the need for separate, potentially conflicting, CSS files.

This change does not introduce new services, APIs, or database schema modifications. It is a focused enhancement of existing components and a critical infrastructure fix.

## Testing & Verification

**1. Frontend UI/UX Verification:**

*   **Local Development:** The changes were verified by running the `apps/web` application locally and navigating to the landing page to visually inspect the new "Explore Features" section.
*   **Visual Inspection:** Screenshots and GIFs provided in the PR description served as proof of the new design, including the 3D hover effects, glowing gradients, and micro-animations for each feature card.
*   **Responsiveness:** The UI was manually checked across various screen sizes to ensure the new design elements adapted correctly and maintained their aesthetic appeal.
*   **Interaction Testing:** Hover states, click actions (`handleNavigation`), and active states (`active:scale-[0.98]`) were manually tested to confirm smooth transitions and correct functionality.
*   **Dark Mode:** The appearance of all new UI elements was verified in dark mode to ensure proper color schemes, contrast, and overall visual consistency.

**2. CI Test Fix Verification:**

*   **CI Pipeline Execution:** The primary verification for the `API_SECRET_KEY` fix was the successful execution of the CI pipeline after the change was merged. The PR description explicitly states that the fix was "to resolve the failing CI build," indicating that the CI now passes reliably.
*   **Local Test Runs:** Running `npm test` or equivalent commands within the `apps/api` directory locally would confirm that tests dependent on the `API_SECRET_KEY` environment variable now execute without configuration errors.

**Edge Cases:**
*   **Browser Compatibility:** Not documented in this PR.
*   **Accessibility:** Not documented in this PR.
*   **Performance:** Not documented in this PR.
*   **Micro-animations:** The specific implementation details for all described micro-animations (e.g., pulsing waveform, radar rings) are not fully detailed in the provided diff, so their comprehensive verification would rely on visual inspection against design specifications.