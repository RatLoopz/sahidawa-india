# PR #1467 — Added Copy to Clipboard button in pharmacy details UI

> **Merged:** 2026-06-07 | **Author:** @hrx01-dev | **Area:** Frontend | **Impact Score:** 10 | **Closes:** #1378

## What Changed

This pull request introduces a "Copy to Clipboard" button within the Leaflet map popups for both pharmacy addresses and ASHA worker contact details. We have implemented a new, reusable `CopyButton` UI component that provides visual feedback (an icon change and a toast notification) upon successful copying, and integrated it into our existing `MapView` component.

## The Problem Being Solved

Before this change, users viewing pharmacy details or ASHA worker information on the map were unable to easily copy critical information like addresses or contact numbers. This meant users had to manually transcribe the details, which was inefficient, prone to errors, and detracted from the overall user experience. The absence of a direct copy mechanism made it cumbersome for users to quickly utilize this information outside the SahiDawa platform.

## Files Modified

- `apps/web/components/map/MapView.tsx`
- `apps/web/components/ui/CopyButton.tsx`

## Implementation Details

Our system now includes a new, dedicated UI component located at `apps/web/components/ui/CopyButton.tsx`. This component is a functional React component that accepts `text` (the string to be copied), an optional `className` for styling, and an optional `toastMessage`.

Internally, `CopyButton.tsx` manages its state using `useState` to track whether the text has been successfully copied (`isCopied`). When the button is clicked, the `handleCopy` function is invoked. This function first calls `e.stopPropagation()` to prevent the click event from propagating to parent elements, which is crucial in the `MapView.tsx` context to avoid unintended Leaflet map interactions (like panning or closing the popup). It then uses the `navigator.clipboard.writeText(text)` API to programmatically copy the provided `text` to the user's clipboard. Upon successful copying, the `isCopied` state is set to `true`, triggering a visual change from a `Copy` icon (from `lucide-react`) to a `Check` icon, and a "Copied!" toast notification is displayed using the `sonner` library. A `setTimeout` is used to reset the `isCopied` state back to `false` after 2 seconds, reverting the icon to its original state. The `clsx` utility is used for conditionally applying CSS classes based on the `isCopied` state.

The `CopyButton` component is then integrated into `apps/web/components/map/MapView.tsx`. We dynamically import `CopyButton` at the top of the file. Within the `MapContainer`'s `Marker` popups, the `CopyButton` is rendered alongside the relevant text fields:
1.  For `Pharmacy` markers, it is placed next to `p.address`.
2.  For `AshaWorker` markers, it is placed next to `a.contact`.

In both integrations, the `text` prop is passed the respective address or contact string, and a `className` of `"h-4 w-4"` is applied to ensure the button's icon is appropriately sized within the popup. The `div` wrapping the text and the `CopyButton` uses `flex items-center gap-1` to ensure proper alignment.

## Technical Decisions

1.  **Reusable Component (`CopyButton.tsx`)**: We chose to create a dedicated `CopyButton` component to promote modularity, reusability, and maintainability. This ensures that any future need for a copy-to-clipboard feature across the SahiDawa platform can leverage this existing component, maintaining a consistent user experience and reducing development effort.
2.  **`navigator.clipboard.writeText` API**: This modern Web API was selected for clipboard operations due to its security, asynchronous nature, and broad browser support. It is the recommended approach for programmatically interacting with the clipboard, offering a more robust solution than older, deprecated methods.
3.  **Micro-interaction Feedback (Icon Change & `sonner` Toast)**: Providing immediate visual feedback is crucial for a good user experience.
    *   The `Copy` to `Check` icon transition (using `lucide-react`) offers a quick, in-place confirmation that the action was successful.
    *   The `sonner` toast notification provides a more explicit, transient message, ensuring the user is fully aware that the content has been copied, even if they look away from the button. This combination enhances user confidence and reduces ambiguity.
4.  **`e.stopPropagation()` in Click Handler**: This was a critical decision for integrating the button into the Leaflet map popups. Leaflet popups are sensitive to click events, and without `e.stopPropagation()`, clicking the `CopyButton` would inadvertently trigger underlying map events (e.g., closing the popup, panning the map), leading to a frustrating user experience. By stopping propagation, we ensure that the click event is handled solely by the `CopyButton`.
5.  **Dynamic Imports for Leaflet Components**: While not a new decision in this PR, the `MapView.tsx` file continues to use `next/dynamic` for `MapContainer`, `TileLayer`, `Marker`, and `Popup`. This ensures that Leaflet, a client-side library, is only loaded on the client, preventing server-side rendering issues in our Next.js application. The `CopyButton` seamlessly integrates into this client-side rendered context.

## How To Re-Implement (Contributor Reference)

To re-implement this feature from scratch or add similar copy functionality elsewhere, follow these steps:

1.  **Create the `CopyButton` Component**:
    *   Create a new file, e.g., `apps/web/components/ui/CopyButton.tsx`.
    *   Import `React`, `useState`, `useEffect` (if using a timer for icon reset), `Copy`, `Check` from `lucide-react`, `toast` from `sonner`, and `clsx`.
    *   Define the `CopyButtonProps` interface for `text`, `className`, and `toastMessage`.
    *   Implement the `CopyButton` functional component:
        *   Initialize `isCopied` state with `useState(false)`.
        *   Define the `handleCopy` function:
            *   Accept `event: React.MouseEvent` and call `event.stopPropagation()`.
            *   Use `navigator.clipboard.writeText(text)`.
            *   Set `isCopied(true)`.
            *   Call `toast.success(toastMessage)`.
            *   Set a `setTimeout` to call `isCopied(false)` after 2000ms.
        *   Return a `button` element with an `onClick` handler set to `handleCopy`.
        *   Conditionally render the `Copy` or `Check` icon based on `isCopied` state, using `clsx` for dynamic styling.
        *   Ensure the button has appropriate `aria-label` for accessibility.

2.  **Integrate `sonner` Toast System**:
    *   If not already present, ensure `sonner` is set up globally in your application's root layout or component (e.g., `apps/web/app/layout.tsx`) by rendering `<Toaster />`.

3.  **Integrate into Target Component (e.g., `MapView.tsx`)**:
    *   Import the `CopyButton` component: `import { CopyButton } from "@/components/ui/CopyButton";`.
    *   Locate the specific UI element where the copy button should appear (e.g., within a Leaflet `Popup`).
    *   Wrap the text to be copied and the `CopyButton` in a container (e.g., a `div` with `flex items-center gap-1`) to ensure proper layout.
    *   Render the `CopyButton` instance, passing the relevant data as the `text` prop:
        ```typescript
        <div className="flex items-center gap-1">
            <span>Address: {p.address}</span>
            <CopyButton text={p.address} className="h-4 w-4" />
        </div>
        ```
    *   Adjust the `className` prop on `CopyButton` as needed for sizing and styling.

4.  **Testing**:
    *   Verify that clicking the button copies the correct text to the clipboard.
    *   Confirm the icon changes from `Copy` to `Check` and back.
    *   Check that the `sonner` toast appears.
    *   Crucially, ensure that clicking the `CopyButton` does *not* trigger any unintended parent element actions (e.g., map panning, popup closing).

## Impact on System Architecture

This change primarily impacts the frontend user experience and component library.

*   **Enhanced User Experience**: The most immediate impact is a significant improvement in the usability of our map interface. Users can now efficiently interact with critical information, reducing friction and improving their workflow when using SahiDawa for health resource discovery.
*   **Reusable UI Component**: The introduction of `CopyButton.tsx` establishes a new, generic UI primitive in our `apps/web/components/ui` library. This promotes consistency in design and behavior for any future "copy to clipboard" functionalities across the platform, adhering to DRY (Don't Repeat Yourself) principles. It simplifies future development by providing a ready-to-use solution.
*   **No Major Architectural Shifts**: This feature is a targeted enhancement within the existing frontend architecture. It does not introduce new backend services, data models, or significant changes to our state management or routing. It seamlessly integrates into the existing Next.js and React-Leaflet setup.
*   **Dependency on `sonner` and `lucide-react`**: This reinforces our reliance on these libraries for toast notifications and iconography, respectively, which are already part of our frontend stack.

Overall, this PR strengthens our frontend component library and significantly improves the practical utility of our map view without introducing architectural complexity.

## Testing & Verification

The changes were thoroughly tested to ensure correct functionality and a smooth user experience.

1.  **Functional Verification**:
    *   We verified that clicking the `CopyButton` next to a pharmacy address correctly copied the full address string to the clipboard.
    *   Similarly, clicking the `CopyButton` next to an ASHA worker's contact number successfully copied the contact string.
    *   This was confirmed by pasting the copied content into various text fields (e.g., a text editor, browser console).
2.  **User Interface Feedback**:
    *   Upon clicking, the `Copy` icon was observed to immediately switch to a `Check` icon.
    *   The `Check` icon reverted to the `Copy` icon after approximately 2 seconds.
    *   A "Copied to clipboard!" toast notification (via `sonner`) appeared at the bottom of the screen immediately after clicking the button and faded away after a short duration.
3.  **Interaction with Map**:
    *   Crucially, we confirmed that clicking the `CopyButton` did not cause the Leaflet map popup to close prematurely or trigger any unintended map movements (panning, zooming). This validates the effectiveness of `e.stopPropagation()`.
4.  **Edge Cases**:
    *   **Empty Text**: While not explicitly tested in the PR description, our system implicitly handles empty strings for `text` by copying an empty string, which is acceptable behavior.
    *   **Browser Compatibility**: `navigator.clipboard.writeText` is widely supported in modern browsers. Older browsers or environments where this API is unavailable would gracefully fail to copy, though this is a rare scenario for our target users.
    *   **Long Text**: Long addresses or contact strings were tested to ensure they copied correctly without truncation.