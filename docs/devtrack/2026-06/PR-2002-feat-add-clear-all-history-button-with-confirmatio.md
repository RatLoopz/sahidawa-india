# PR #2002 — Feat : Add "Clear All History" button with confirmation to history/page.tsx

> **Merged:** 2026-06-19 | **Author:** @hrx01-dev | **Area:** Frontend | **Impact Score:** 8 | **Closes:** #1952

## What Changed

We have implemented a "Clear All History" button on the scan history page (`/history`) that allows users to delete all their local scan entries. This functionality is accompanied by a custom, in-page confirmation dialog to prevent accidental data loss, and the button only renders when there are existing history items.

## The Problem Being Solved

Previously, users could only delete individual scan history entries from their local device. There was no mechanism to perform a bulk deletion of all accumulated scan history. This posed a limitation for users who wished to clear their entire local history for privacy reasons, to declutter their interface, or to start fresh without manually deleting each entry one by one. The absence of a clear-all option also meant less control over personal data stored locally by the SahiDawa application.

## Files Modified

- `apps/web/app/[locale]/history/page.tsx`
- `apps/web/messages/en.json`

## Implementation Details

The core changes are concentrated within the `HistoryPage` component in `apps/web/app/[locale]/history/page.tsx`.

1.  **State Management**: A new state variable, `showClearConfirmation`, has been introduced using `useState(false)` to control the visibility of the confirmation dialog for clearing all history.
2.  **Database Integration**:
    - The `clearScanHistory` function was imported from `@/lib/db/scanHistory`. This function is responsible for deleting all entries from the local IndexedDB `scanHistory` store.
    - The existing `getScanHistory` and `deleteScanHistory` functions were already present and are used for loading and individual deletion, respectively.
3.  **`handleClearAllHistory` Function**:
    - A new asynchronous function, `handleClearAllHistory`, was added.
    - When invoked, it first calls `await clearScanHistory()` to remove all data.
    - Immediately after, it calls `await loadHistory()` to refresh the `history` state, which in turn updates the UI to reflect the empty history state.
    - Finally, `setShowClearConfirmation(false)` is called to hide the confirmation dialog.
    - Basic error handling with `try...catch` is included, logging any failures to the console.
4.  **`handleCancelClear` Function**:
    - A simple function `handleCancelClear` was added, which sets `setShowClearConfirmation(false)` to dismiss the confirmation dialog without performing any deletion.
5.  **UI Rendering**:
    - **"Clear All History" Button**: A new `<button>` element with text "Clear All History" (translated via `t("clear_all_button")`) and a `Trash2` icon from `lucide-react` was added.
        - This button is conditionally rendered: `{history.length > 0 && (...) }`, ensuring it only appears when there are items in the `history` array.
        - Its `onClick` handler sets `setShowClearConfirmation(true)`.
        - It includes `aria-label={t("clear_all_button_aria_label")}` for accessibility.
    - **Confirmation Dialog**: A `div` element containing the "Are you sure?" message and "Cancel" / "Confirm" buttons is conditionally rendered based on the `showClearConfirmation` state: `{showClearConfirmation && (...) }`.
        - This dialog uses Tailwind CSS classes for styling, including `animate-in fade-in slide-in-from-top-2` for a smooth appearance.
        - The "Cancel" button's `onClick` calls `handleCancelClear`.
        - The "Confirm" button's `onClick` calls `handleClearAllHistory`.
    - **Empty State Component**: The previous inline `div` for displaying "No Scan History Yet" was replaced with the reusable `EmptyState` component, imported from `@/components/ui/EmptyState`. This component now receives `icon`, `title`, and `description` props, all sourced from translation keys.
6.  **Internationalization (i18n)**:
    - All new user-facing strings, including the page title, button labels, confirmation messages, sync messages, and empty state text, have been added to `apps/web/messages/en.json`.
    - The `useTranslations("History")` hook is used to retrieve these strings, ensuring the feature is fully localizable.
    - Existing hardcoded strings like "Scan History" for the page title, "Export to CSV", "Sync to Cloud", and various statistics labels were also replaced with their respective translation keys.

## Technical Decisions

1.  **Custom Confirmation Dialog vs. `window.confirm()`**: We opted for a custom, in-page confirmation dialog instead of the browser's native `window.confirm()`.
    - **Why**: This provides a more consistent user experience (UX) with the SahiDawa application's design language, allows for full control over styling, and is more accessible. Crucially, it also enables proper internationalization of the confirmation message and buttons, which `window.confirm()` does not natively support.
2.  **Conditional Button Rendering**: The "Clear All History" button is only displayed when `history.length > 0`.
    - **Why**: This improves UX by preventing users from attempting to clear an already empty history, reducing unnecessary clicks and potential confusion.
3.  **Separation of Concerns for `clearScanHistory`**: The actual database clearing logic is encapsulated in a dedicated function `clearScanHistory` within `@/lib/db/scanHistory`.
    - **Why**: This promotes modularity, reusability, and testability of the database operation, keeping the UI component focused on presentation and user interaction.
4.  **Immediate UI Refresh**: After clearing history, `loadHistory()` is called immediately.
    - **Why**: This ensures the user interface updates in real-time to reflect the empty state, providing instant feedback without requiring a page reload.
5.  **`EmptyState` Component Usage**: The generic `div` for the empty history message was replaced with the `EmptyState` component.
    - **Why**: This adheres to our component-based design principles, promoting UI consistency and reusability across the application for various empty data scenarios.
6.  **Comprehensive Internationalization**: All new and several existing UI strings were moved to `messages/en.json`.
    - **Why**: This aligns with our commitment to supporting multiple languages and ensures that the application is ready for localization from the outset, reducing technical debt for future language additions.

## How To Re-Implement (Contributor Reference)

To re-implement a "Clear All" feature with confirmation in a similar Next.js/React component:

1.  **Define State for Confirmation**:
    - In your functional component, declare a state variable to control the visibility of the confirmation dialog:
        ```typescript
        const [showConfirmation, setShowConfirmation] = useState(false);
        ```
2.  **Create Database Utility Function**:
    - Ensure you have a utility function that performs the bulk deletion operation in your data layer (e.g., `lib/db/yourDbModule.ts`):
        ```typescript
        // lib/db/scanHistory.ts (example)
        export async function clearScanHistory(): Promise<void> {
            const db = await getDb(); // Assuming getDb() connects to IndexedDB
            const tx = db.transaction("scanHistory", "readwrite");
            const store = tx.objectStore("scanHistory");
            await store.clear(); // Clears all objects from the store
            await tx.done;
        }
        ```
3.  **Implement Clear Handler**:
    - Create an asynchronous function in your component to handle the "confirm clear" action:
        ```typescript
        const handleClearAll = async () => {
            try {
                await clearScanHistory(); // Call your database utility
                await loadData(); // Function to reload/refresh your component's data
                setShowConfirmation(false); // Hide the confirmation dialog
                // Optional: Show a success toast/notification
            } catch (error) {
                console.error("Failed to clear data:", error);
                // Optional: Show an error toast/notification
            }
        };
        ```
4.  **Implement Cancel Handler**:
    - Create a simple function to handle canceling the confirmation:
        ```typescript
        const handleCancelClear = () => {
            setShowConfirmation(false);
        };
        ```
5.  **Render the "Clear All" Button**:
    - Place a button in your JSX, typically with a conditional render based on whether there's data to clear:
        ```tsx
        {
            data.length > 0 && ( // Assuming 'data' is your list of items
                <button
                    onClick={() => setShowConfirmation(true)}
                    className="your-styling-classes"
                    aria-label={t("clear_all_button_aria_label")}
                >
                    <Trash2 size={16} /> {t("clear_all_button")}
                </button>
            );
        }
        ```
6.  **Render the Confirmation Dialog**:
    - Conditionally render the confirmation UI based on `showConfirmation` state:
        ```tsx
        {
            showConfirmation && (
                <div className="animate-in fade-in slide-in-from-top-2 z-20 mb-4 rounded-xl border border-red-400/30 bg-red-950/50 p-4 text-sm font-medium backdrop-blur-sm">
                    <p className="mb-3 text-red-100">{t("clear_confirm_message")}</p>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={handleCancelClear}
                            className="rounded-md px-4 py-2 text-white transition-colors hover:bg-white/10"
                        >
                            {t("clear_cancel_button")}
                        </button>
                        <button
                            onClick={handleClearAll}
                            className="rounded-md bg-red-600 px-4 py-2 font-bold text-white transition-colors hover:bg-red-700"
                        >
                            {t("clear_confirm_button")}
                        </button>
                    </div>
                </div>
            );
        }
        ```
7.  **Internationalization**:
    - Ensure all user-facing strings for the button, confirmation message, and dialog buttons are added to your `messages/en.json` (or other locale files) and retrieved using `useTranslations`.
8.  **Styling and Accessibility**:
    - Apply appropriate CSS classes (e.g., Tailwind CSS) for visual appeal.
    - Include `aria-label` attributes for buttons to improve accessibility.

## Impact on System Architecture

This change primarily impacts the frontend user experience and the local data management layer.

1.  **Enhanced User Control**: It significantly improves user agency by providing a direct and clear way to manage their local scan history, aligning with principles of data privacy and user empowerment.
2.  **New Database Utility**: The introduction of `clearScanHistory()` in `@/lib/db/scanHistory` adds a new, atomic operation to our local IndexedDB interaction module. This function is now part of the public API of our local database utilities, making it available for other parts of the application if needed for bulk data removal.
3.  **Frontend Component Reusability**: The adoption of the `EmptyState` component for the history page's empty state reinforces our modular frontend architecture and promotes consistency across the application.
4.  **Reinforced i18n Practices**: By moving all new and several existing strings into translation files, this PR strengthens our commitment to internationalization, making future localization efforts smoother and more consistent.
5.  **Improved UX Pattern**: The custom confirmation dialog establishes a pattern for handling sensitive user actions, offering a more integrated and branded experience compared to native browser prompts.

## Testing & Verification

The following verification steps were performed to ensure the correct functionality of the "Clear All History" feature:

1.  **Button Visibility**:
    - Verified that the "Clear All History" button appears only when there is at least one item in the scan history.
    - Verified that the button disappears when the scan history is empty.
2.  **Confirmation Dialog Interaction**:
    - Clicked the "Clear All History" button and confirmed that the custom confirmation dialog appears.
    - Clicked "Cancel" within the confirmation dialog and verified that the dialog disappears, and the history remains unchanged.
    - Clicked "Clear All History" again, then clicked "Clear All" (Confirm) within the dialog.
3.  **History Clearing**:
    - Verified that after confirming, all scan history entries are successfully removed from the UI.
    - Verified that the page transitions to the `EmptyState` component, displaying "No Scan History Yet".
    - (Implicitly) Verified that the `clearScanHistory()` function correctly interacts with the local IndexedDB to remove all entries.
4.  **Internationalization**:
    - Verified that all new strings (button labels, confirmation message, empty state text, sync messages, stat labels, item labels) are correctly rendered using the `next-intl` translation system.
5.  **Edge Cases**:
    - Tested with an empty history initially (button should not appear).
    - Tested with a single history item (button should appear, clear should work).
    - Tested with multiple history items (button should appear, clear should work).

No specific automated tests (unit/integration) were added in this PR, but the manual verification steps, including screenshots provided in the PR, confirmed the expected behavior.
