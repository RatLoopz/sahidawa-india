# PR #1705 — feat(login): improve password input with visibility toggle

> **Merged:** 2026-06-12 | **Author:** @Yogender-verma | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #1698

## What Changed

This pull request introduces a password visibility toggle feature to the login form's password input field. Users can now click an eye icon within the password input to reveal or hide the characters they are typing, enhancing usability without altering the core login functionality, validation, or existing styling.

## The Problem Being Solved

Previously, users entering their password on the SahiDawa login page had no visual feedback on the characters being typed, as the input field always remained masked. This often led to frustration, typos, and increased cognitive load, especially for complex passwords or on mobile devices where typing accuracy can be lower. The absence of a visibility toggle could result in users repeatedly mistyping their password and failing to log in, degrading the overall user experience.

## Files Modified

- `apps/web/app/[locale]/login/page.tsx`

## Implementation Details

The implementation for the password visibility toggle is entirely contained within the `LoginPage` component located at `apps/web/app/[locale]/login/page.tsx`.

1.  **Icon Imports:** We extended our existing `lucide-react` icon imports to include `Eye` and `EyeOff`. These icons are used to visually represent the current state of the password visibility toggle.
2.  **State Management:** A new state variable, `showPassword`, was introduced using React's `useState` hook:
    ```typescript
    const [showPassword, setShowPassword] = useState(false);
    ```
    This boolean state controls whether the password input field's type is `text` (visible) or `password` (masked). It defaults to `false`, meaning the password is initially hidden.
3.  **Dynamic Input Type:** The `type` attribute of the `<input>` element for the password field was modified to be dynamic:
    ```html
    <input
        type={showPassword ? "text" : "password"}
        placeholder={t("passwordPlaceholder")}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        // ... other attributes
    />
    ```
    When `showPassword` is `true`, the input type becomes `text`, revealing the password. When `false`, it reverts to `password`, masking the input.
4.  **Toggle Button:** A `<button>` element was added directly adjacent to the password input field, within the same flex container.
    *   `type="button"`: This is crucial to prevent the button from triggering a form submission when clicked, ensuring it only serves its intended toggle function.
    *   `onClick={() => setShowPassword((v) => !v)}`: This handler toggles the `showPassword` state, which in turn updates the input's `type` attribute and re-renders the appropriate icon.
    *   **Accessibility:** `aria-label` and `aria-pressed` attributes were included to provide semantic information for assistive technologies:
        *   `aria-label={showPassword ? "Hide password" : "Show password"}` dynamically describes the button's action.
        *   `aria-pressed={showPassword}` indicates whether the toggle is currently active (password visible).
    *   **Conditional Icon Rendering:** The content of the button conditionally renders either the `EyeOff` icon (when `showPassword` is `true`, indicating the password is visible and can be hidden) or the `Eye` icon (when `showPassword` is `false`, indicating the password is hidden and can be shown).
    *   **Styling:** Tailwind CSS classes were applied for layout (`shrink-0`), appearance (`rounded`, `text-(--color-text-muted)`, `hover:text-(--color-text-primary)`), and focus indication (`focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none`).

This approach ensures that the password visibility toggle is a client-side UI enhancement that does not interfere with the existing login logic, form validation, or backend communication.

## Technical Decisions

1.  **Local State Management (`useState`):** We chose `useState` for managing the `showPassword` state because the functionality is entirely local to the `LoginPage` component. There's no need for this state to be shared across multiple components or persist beyond the component's lifecycle, making `useState` the most straightforward and performant solution.
2.  **`lucide-react` for Icons:** Our system already utilizes `lucide-react` for various icons across the application. By importing `Eye` and `EyeOff` from the same library, we maintain consistency in our icon set, avoid introducing new dependencies, and leverage existing styling and integration patterns.
3.  **Dynamic `type` Attribute:** The standard HTML way to toggle password visibility is by changing the `<input>` element's `type` attribute between `password` and `text`. This is a robust and widely supported browser feature, ensuring maximum compatibility and minimal custom implementation complexity.
4.  **Dedicated Toggle Button (`type="button"`):** It was critical to implement the toggle as a separate `<button type="button">` element rather than, for instance, a `div` with an `onClick` handler. This ensures proper semantic HTML, keyboard navigability, and prevents accidental form submission, which is a common pitfall when adding interactive elements within a form.
5.  **Accessibility (`aria-label`, `aria-pressed`):** We prioritized accessibility by including `aria-label` and `aria-pressed` attributes. This ensures that users relying on screen readers or other assistive technologies receive clear and accurate information about the button's purpose and current state, making the feature usable for everyone.

## How To Re-Implement (Contributor Reference)

To re-implement a password visibility toggle similar to this, follow these steps:

1.  **Identify Target Component:** Locate the React component containing the password input field (e.g., `apps/web/app/[locale]/login/page.tsx`).
2.  **Import Icons:** If using `lucide-react`, import the necessary icons for showing and hiding the password.
    ```typescript
    import { Eye, EyeOff } from "lucide-react";
    ```
3.  **Declare State Variable:** Inside your functional component, declare a state variable to manage the visibility.
    ```typescript
    const [showPassword, setShowPassword] = useState(false);
    ```
4.  **Modify Input `type`:** Find your password `<input>` element and dynamically set its `type` attribute based on the `showPassword` state.
    ```html
    <input
        type={showPassword ? "text" : "password"}
        // ... other input props
    />
    ```
5.  **Add Toggle Button:** Place a `<button>` element immediately next to your password input, typically within the same container (e.g., a `div` with `flex` display).
    *   Ensure `type="button"` to prevent form submission.
    *   Attach an `onClick` handler to toggle the state.
    *   Conditionally render the appropriate icon based on `showPassword`.
    *   Add accessibility attributes.
    ```html
    <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        aria-label={showPassword ? "Hide password" : "Show password"}
        aria-pressed={showPassword}
        className="shrink-0 rounded text-(--color-text-muted) transition hover:text-(--color-text-primary) focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
    >
        {showPassword ? (
            <EyeOff className="h-5 w-5" />
        ) : (
            <Eye className="h-5 w-5" />
        )}
    </button>
    ```
6.  **Styling:** Apply appropriate CSS (e.g., Tailwind CSS) to position the button correctly within the input field, ensure it's visually appealing, and provide hover/focus states. Ensure the button doesn't interfere with the input's text flow.

## Impact on System Architecture

This change has a minimal and localized impact on the overall SahiDawa system architecture.

*   **Frontend-Only Enhancement:** The modification is purely a client-side UI enhancement within the `apps/web` Next.js application. It does not affect our backend services, API contracts, database schema, or core business logic for authentication.
*   **Improved UX:** It significantly improves the user experience for a critical interaction point (login), potentially reducing user errors and support requests related to login failures.
*   **No New Dependencies:** By leveraging existing `lucide-react` imports and standard React/HTML patterns, we avoided introducing any new external libraries or complex frameworks, maintaining our current dependency footprint.
*   **Accessibility Standard:** The inclusion of `aria-label` and `aria-pressed` sets a good precedent for ensuring new UI features are accessible by design, aligning with our commitment to an inclusive platform.
*   **Future Development:** This pattern can be easily replicated for other input fields requiring similar visibility toggles (e.g., password confirmation fields, sensitive data entry).

## Testing & Verification

The changes introduced by this PR were verified through manual testing, as indicated by the "Proof of Work" screenshots provided in the PR description.

1.  **Functional Verification:**
    *   We confirmed that navigating to the login page (`/login`) correctly displays the password input field with the new eye icon.
    *   Clicking the eye icon successfully toggles the `type` attribute of the password input between `password` and `text`, visually revealing and masking the entered characters.
    *   The icon itself correctly changes between `Eye` and `EyeOff` states corresponding to the password visibility.
    *   The existing login functionality (entering credentials and submitting the form) remains unaffected by the presence and interaction of the toggle.
    *   Form validation messages (if any) continue to display correctly.
2.  **UI/UX Verification:**
    *   The eye icon is correctly positioned within the password input field, without overlapping text or other elements.
    *   The styling (colors, hover effects, focus states) of the toggle button is consistent with our design system.
3.  **Edge Cases Considered (Implicitly/Explicitly):**
    *   **Empty Password Field:** The toggle functions correctly even when the password field is empty.
    *   **Typing and Toggling:** Users can type, toggle visibility, continue typing, and toggle again, with the input state preserving correctly.
    *   **Keyboard Navigation:** The toggle button is a standard HTML `<button>`, making it inherently focusable via keyboard (`Tab` key) and activatable (`Enter`/`Space` key), ensuring basic keyboard accessibility.
    *   **Screen Reader Compatibility:** The `aria-label` and `aria-pressed` attributes provide semantic information to screen readers, enhancing accessibility for visually impaired users.