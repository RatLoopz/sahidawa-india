# PR #1249 — feat(web): improve OfflineErrorBoundary with dev stack trace and bett…

> **Merged:** 2026-06-04 | **Author:** @Avinash-sdbegin | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #929

## What Changed

We have significantly enhanced the `OfflineErrorBoundary` component within our `apps/web` frontend. This update primarily introduces a development-only mechanism to display detailed error stack traces directly in the browser UI, greatly improving the developer experience for debugging. Concurrently, we have refined the visual presentation of the fallback error card, providing a more modern and polished user interface while preserving existing offline detection, retry functionality, and dark mode compatibility.

## The Problem Being Solved

Before this change, when an error was caught by the `OfflineErrorBoundary` in `apps/web`, developers lacked immediate, in-browser visibility into the underlying error's stack trace and the React component stack. While errors were logged to the browser console, having to switch contexts and search through console output added friction to the debugging process. This made it less efficient to diagnose issues originating from components wrapped by the error boundary.

From a user experience perspective, the existing fallback UI for errors, while functional, was visually basic. It lacked modern styling elements such as rounded corners, subtle shadows, and improved spacing, which could lead to a less polished perception of the SahiDawa platform during unexpected error states.

## Files Modified

- `apps/web/components/OfflineErrorBoundary.tsx`

## Implementation Details

The core of this enhancement lies within the `OfflineErrorBoundary` React class component in `apps/web/components/OfflineErrorBoundary.tsx`.

1.  **State Augmentation:**
    We extended the `OfflineErrorBoundaryState` interface to include two new optional properties: `errorStack?: string;` and `componentStack?: string;`. These properties are initialized to empty strings (`""`) in the component's constructor, providing dedicated state to store error diagnostic information.

2.  **Enhanced `componentDidCatch` Lifecycle Method:**
    The `componentDidCatch(error: Error, info: React.ErrorInfo)` method, which is responsible for catching errors in child components, was updated.
    - The existing `console.error("OfflineErrorBoundary caught error:", error, info);` call remains to ensure standard console logging.
    - A new conditional block was introduced: `if (process.env.NODE_ENV === "development")`. This ensures that the following debugging logic is only active during development builds and is completely stripped out in production.
    - Inside this development-only block, we now perform more detailed console logging:
        - `console.group("🔴 OfflineErrorBoundary Dev Trace")` and `console.groupEnd()` are used to visually group the detailed error output in the browser console.
        - `console.error("Error:", error);`, `console.error("Stack:", error.stack);`, and `console.error("Component Stack:", info.componentStack);` explicitly log the error object, its JavaScript stack trace, and the React component stack trace, respectively.
    - Crucially, `this.setState({ errorStack: error.stack || "", componentStack: info.componentStack || "" });` is called to store the captured `error.stack` and `info.componentStack` in the component's state. This makes these details available for rendering in the UI.

3.  **UI Refinements in `render()`:**
    The `render()` method was updated to reflect the new UI design and conditionally display developer details.
    - **Error Card Styling:** The main `div` element wrapping the error message and actions now includes a comprehensive set of Tailwind CSS classes: `max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-700 dark:bg-slate-900`. This applies rounded corners, a subtle border, a background color (with dark mode support), increased padding, and a shadow for a more modern, card-like appearance.
    - **Icon Container Styling:** The `div` containing the `Wifi` or `AlertTriangle` icon was updated. Its dimensions were increased (`h-20 w-20`), and a `ring-4 ring-amber-50 dark:ring-amber-900/10` class was added to create a subtle accent ring around the icon, enhancing its visual prominence. The bottom margin (`mb-6`) was also adjusted for better spacing.
    - **Developer Error Details Section:**
        - A new `details` HTML element is conditionally rendered: `process.env.NODE_ENV === "development" && this.state.componentStack`. This ensures the section only appears in development mode and only if a component stack trace is available.
        - A `summary` element within `details` provides the clickable "Developer Error Details" text, allowing the section to be collapsed or expanded natively.
        - A `pre` element is used to display `this.state.componentStack`. It is styled with `mt-2 max-h-40 overflow-auto rounded bg-slate-100 p-3 text-xs dark:bg-slate-800` to provide a scrollable, monospaced, code-block-like display for the stack trace, respecting dark mode.

4.  **Dependency Cleanup:**
    The unused `Home` icon import from `lucide-react` was removed, streamlining the component's dependencies.

## Technical Decisions

1.  **Conditional Debugging with `process.env.NODE_ENV`:** We chose to gate the detailed error logging and UI display behind `process.env.NODE_ENV === "development"`. This is a standard and highly effective practice in React and Next.js applications. It ensures that sensitive debugging information is never exposed in production builds, prevents any performance overhead for end-users, and allows bundlers to completely remove the development-only code, optimizing the production bundle size.
2.  **Leveraging `componentDidCatch`:** As `OfflineErrorBoundary` is a class component designed as an error boundary, `componentDidCatch` is the correct and idiomatic React lifecycle method for catching errors in its child tree and updating the component's state to render a fallback UI.
3.  **Storing Stack Traces in State:** By storing `errorStack` and `componentStack` in the component's state, we enable dynamic rendering of these details in the UI. This provides immediate, visual feedback to developers without requiring them to inspect the console.
4.  **Native `details`/`summary` Elements for Collapsible UI:** For the "Developer Error Details" section, we opted for the native HTML `details` and `summary` elements. This choice provides an accessible, semantic, and zero-JavaScript solution for a collapsible section, reducing complexity and relying on browser-native functionality.
5.  **Tailwind CSS for Styling:** All UI improvements were implemented using Tailwind CSS utility classes. This aligns with our existing frontend styling conventions in `apps/web`, ensuring consistency, maintainability, and efficient styling with dark mode support.
6.  **Lucide-react for Icons:** We continued to use `lucide-react` for icons, maintaining consistency with our current icon library and ensuring a unified visual language.

## How To Re-Implement (Contributor Reference)

To re-implement or extend this feature, a contributor would follow these steps:

1.  **Locate the Error Boundary:** Identify the `OfflineErrorBoundary` class component in `apps/web/components/OfflineErrorBoundary.tsx`.
2.  **Update Component State:**
    - Modify the `OfflineErrorBoundaryState` interface to include `errorStack?: string;` and `componentStack?: string;`.
    - In the `OfflineErrorBoundary` constructor, initialize these new state properties: `errorStack: "", componentStack: ""`.
3.  **Enhance `componentDidCatch`:**
    - Inside the `componentDidCatch(error: Error, info: React.ErrorInfo)` method, after the initial `console.error` call, add a conditional block:

        ```typescript
        if (process.env.NODE_ENV === "development") {
            console.group("🔴 OfflineErrorBoundary Dev Trace");
            console.error("Error:", error);
            console.error("Stack:", error.stack);
            console.error("Component Stack:", info.componentStack);
            console.groupEnd();

            this.setState({
                errorStack: error.stack || "", // Use fallback for potentially undefined stack
                componentStack: info.componentStack || "",
            });
        }
        ```

4.  **Modify `render()` for UI Updates:**
    - Locate the main `div` that wraps the error message and buttons. Update its `className` to include the new styling:
      `className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-700 dark:bg-slate-900"`
    - Find the `div` containing the `Wifi` or `AlertTriangle` icon. Adjust its `className`:
      `className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 ring-4 ring-amber-50 dark:bg-amber-900/20 dark:ring-amber-900/10"`
    - Below the main error card `div` (but still within the `render` method's return fragment), add the conditional developer details section:
        ```typescript
        {process.env.NODE_ENV === "development" &&
            this.state.componentStack && (
                <details className="mt-6 text-left">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Developer Error Details
                    </summary>
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-100 p-3 text-xs dark:bg-slate-800">
                        {this.state.componentStack}
                    </pre>
                </details>
        )}
        ```
5.  **Clean Up Imports:** Remove any unused icon imports, such as `Home` from `lucide-react`.

**Dependencies:** This implementation relies on React's class component features, Next.js's `process.env.NODE_ENV` for environment-specific logic, and Tailwind CSS for styling.

## Impact on System Architecture

This change primarily impacts the developer experience and the robustness of our frontend error handling.

- **Enhanced Developer Productivity:** The most significant impact is on our frontend development workflow. By providing immediate, in-browser visibility of full stack traces for errors caught by `OfflineErrorBoundary`, we empower developers to diagnose and resolve issues much faster. This reduces the cognitive load of debugging and allows for more efficient iteration.
- **No Production Overhead:** Crucially, the use of `process.env.NODE_ENV === "development"` ensures that all debugging-specific code and UI elements are completely excluded from production builds. This means there is no impact on bundle size, performance, or security for our end-users.
- **Improved User Experience (Minor):** While not a core architectural change, the refined UI for error states contributes to a more professional and consistent user experience across the SahiDawa platform.
- **Reinforced Error Boundary Pattern:** By making error boundaries more useful for debugging, this change implicitly reinforces the importance and utility of using React error boundaries for graceful error handling in our applications. It encourages developers to wrap potentially unstable parts of the UI with error boundaries, knowing that they will now provide better diagnostic information.
- **No Backend Impact:** This change is entirely frontend-focused and has no direct impact on our backend services or data models.

## Testing & Verification

We verified this change through a combination of local development testing and visual inspection.

1.  **Local Project Verification:** The contributor confirmed that the project compiled and built without errors after the changes were applied, ensuring no regressions in the build process.
2.  **UI Verification:**
    - Screenshots were provided demonstrating the improved fallback UI. This confirmed that the new styling (rounded corners, border, shadow, enhanced icon container, and spacing) was correctly applied and rendered as intended.
    - Additional screenshots specifically showed the "Developer Error Details" section visible in development mode, confirming its conditional rendering and correct display of the stack trace.
3.  **Functional Preservation:** The PR description explicitly states that existing dark mode support, offline detection, and retry behavior were preserved. This implies these functionalities were tested to ensure they remained intact and fully operational after the UI and debugging enhancements.
4.  **Edge Cases:**
    - **Production Environment:** The `process.env.NODE_ENV` check is a robust mechanism to ensure the developer-specific features are absent in production. While not explicitly shown in screenshots, this is a standard practice that implicitly verifies the production behavior.
    - **Error without Stack:** The use of `error.stack || ""` handles cases where an error object might not contain a stack trace, preventing potential `undefined` errors.
    - **Offline vs. General Error:** The `OfflineErrorBoundary` continues to correctly differentiate between network-related errors (`isOfflineError`) and other unexpected errors, displaying the appropriate icon and message to the user.
