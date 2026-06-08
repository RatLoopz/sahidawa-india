# PR #1469 — feat: add scan history feature

> **Merged:** 2026-06-07 | **Author:** @JaswanthAkula121 | **Area:** Frontend | **Impact Score:** 19 | **Closes:** #925

## What Changed

We have introduced a new "Scan History" feature to the SahiDawa web application, enabling users to persistently store, view, and manage their past medicine verification results locally on their device. This includes a new `/history` page displaying a list of previous scans with their verification status and summary statistics, along with the ability to delete individual history entries. The feature is designed to be offline-first, leveraging IndexedDB for local data storage.

## The Problem Being Solved

Prior to this change, our SahiDawa web application treated each medicine scan as a transient event. Once a user completed a scan and navigated away from the results page, the information about that specific verification was lost. This meant users could not revisit past scan results, track their verification activity over time, or easily re-check details of previously scanned medicines without performing a new scan. There was no aggregated view of a user's scanning patterns (e.g., how many verified versus suspicious items they encountered). This lack of persistence diminished the user experience, particularly for frequent users who desired a personal log of their interactions with the platform.

## Files Modified

- `apps/web/app/[locale]/history/layout.tsx`
- `apps/web/app/[locale]/history/page.tsx`
- `apps/web/app/[locale]/scan/page.tsx`
- `apps/web/lib/db/scanHistory.ts`

## Implementation Details

The implementation of the scan history feature involved the creation of a new IndexedDB service, a dedicated history page, and modifications to the existing scan page to integrate history saving.

1.  **IndexedDB Service (`apps/web/lib/db/scanHistory.ts`):**
    *   This new module is responsible for all interactions with IndexedDB for storing scan history.
    *   It utilizes the `idb` library, a promise-based wrapper for IndexedDB, to simplify asynchronous operations.
    *   `dbPromise` is initialized using `openDB("sahi-dawa-scan-history", 1, { upgrade(...) })`. This initialization is guarded by `typeof window !== 'undefined'` to ensure it only runs in the browser environment, making it safe for Next.js's Server-Side Rendering (SSR).
    *   The `upgrade` callback defines the `scan-history` object store with `keyPath: "id"` and `autoIncrement: false`. An index is also created on the `timestamp` field for efficient sorting.
    *   `saveScanHistory(entry: ScanHistoryEntry)`: This asynchronous function takes a `ScanHistoryEntry` object, opens a `readwrite` transaction on the `scan-history` store, and uses `put(entry)` to add a new entry or update an existing one if the `id` matches.
    *   `getScanHistory()`: This asynchronous function opens a `readonly` transaction and retrieves all entries from the `scan-history` object store using `getAll()`.
    *   `deleteScanHistory(id: string)`: This asynchronous function opens a `readwrite` transaction and removes a specific entry from the `scan-history` store using `delete(id)`.

2.  **History Page (`apps/web/app/[locale]/history/page.tsx`):**
    *   This is a new client-side React component (`"use client"`) that renders the user interface for viewing scan history.
    *   It uses `useState` to manage the `history` array (of type `any[]` in the current implementation, ideally `ScanHistoryEntry[]`) and `useEffect` to trigger `loadHistory()` when the component mounts.
    *   The `loadHistory()` function asynchronously fetches all scan history entries using `getScanHistory()` from `apps/web/lib/db/scanHistory.ts`. It then sorts the retrieved data by `timestamp` in descending order (newest first) before updating the component's state. Error handling logs any failures to the console.
    *   The `handleDelete(id: string)` function is an asynchronous callback that invokes `deleteScanHistory(id)` and then reloads the history to reflect the change in the UI.
    *   The page displays a summary dashboard with `Total`, `Verified`, `Suspicious`, and `Fake` counts, calculated by filtering the `history` state.
    *   It conditionally renders either a "No Scan History Yet" message or a list of individual history items. Each item shows the `medicineName`, `status` (with dynamic styling based on status), `timestamp`, and a "Delete" button.

3.  **History Layout (`apps/web/app/[locale]/history/layout.tsx`):**
    *   A minimal Next.js App Router layout component that simply renders its `children`. This provides the necessary routing structure for the history page.

4.  **Scan Page Integration (`apps/web/app/[locale]/scan/page.tsx`):**
    *   The `ScanPage` component was modified to integrate the history saving mechanism.
    *   It now imports `saveScanHistory` from `apps/web/lib/db/scanHistory.ts` and `structuredLog` for error reporting.
    *   Two new helper functions, `getScanHistoryStatus` and `getScanHistoryMedicineName`, were introduced to standardize the mapping of `VerifyResult` objects to the `status` and `medicineName` fields of a `ScanHistoryEntry`.
    *   The `processVerificationResult` asynchronous function, which is responsible for handling the outcome of a medicine verification, was updated. After a verification result is determined (regardless of whether it's verified, suspicious, or fake), `saveScanHistory` is called.
    *   A new `ScanHistoryEntry` is constructed with a unique `id` generated by `crypto.randomUUID()`, the current `timestamp` from `Date.now()`, and the `medicineName` and `status` derived using the new helper functions.
    *   Any errors during the `saveScanHistory` operation are caught and logged using `structuredLog`.
    *   The previous `recordScanHistory`, `buildLocalScanHistoryEntry`, and `saveLocalScanHistoryEntry` functions, which might have handled temporary local storage, were removed in favor of the new, persistent IndexedDB approach.

## Technical Decisions

*   **Offline-First Persistence with IndexedDB:** We chose IndexedDB, specifically through the `idb` library, for local data persistence. This decision was driven by the requirement for an offline-first experience, crucial for SahiDawa's operation in rural areas with unreliable internet access. IndexedDB offers robust, client-side storage for structured data, superior to alternatives like LocalStorage (which has limited capacity, is synchronous, and lacks indexing capabilities) or SessionStorage (which is not persistent across sessions).
*   **`idb` Library for IndexedDB Abstraction:** The `idb` library was selected for its modern, promise-based API. This significantly simplifies working with IndexedDB, reducing boilerplate and improving readability compared to the native IndexedDB API, while still providing full access to its capabilities.
*   **Next.js App Router and Client Components:** The `/history` page (`apps/web/app/[locale]/history/page.tsx`) is explicitly marked as a client component (`"use client"`). This is a critical decision because IndexedDB is a browser-specific API and cannot be accessed during Next.js's Server-Side Rendering (SSR) phase. By ensuring the component runs only on the client, we prevent runtime errors and ensure proper functionality.
*   **SSR-Safe IndexedDB Initialization:** The `dbPromise` in `apps/web/lib/db/scanHistory.ts` is conditionally initialized only when `typeof window !== 'undefined'`. This pattern is essential for Next.js applications to prevent errors during the build process or SSR, where the `window` object is not available.
*   **Comprehensive History Saving:** The decision to save all scan attempts, including "suspicious" and "fake" results, is intentional. This provides users with a complete and accurate record of their interactions, allowing them to track potentially problematic medicines and not just successful verifications, which enhances the platform's utility and transparency.
*   **Streamlined Scan Page Integration:** The previous, more complex `ScanHistoryContext` and related helper functions in `apps/web/app/[locale]/scan/page.tsx` were replaced with direct calls to `saveScanHistory` and dedicated, simpler helper functions (`getScanHistoryStatus`, `getScanHistoryMedicineName`). This centralizes the logic for transforming scan results into history entries, making the scan page cleaner and the history saving logic more focused.

## How To Re-Implement (Contributor Reference)

To re-implement the scan history feature, a contributor would follow these steps:

1.  **Install `idb`:**
    *   Add the `idb` library to the project dependencies: `npm install idb`.

2.  **Create the IndexedDB Service Module:**
    *   Create a new file at `apps/web/lib/db/scanHistory.ts`.
    *   Define the `ScanHistoryEntry` interface to specify the structure of history records (e.g., `id`, `timestamp`, `medicineName`, `status`).
    *   Implement the `openDB` call within a `typeof window !== 'undefined'` guard to ensure SSR safety.
    *   In the `upgrade` callback of `openDB`, create the `scan-history` object store with `keyPath: 'id'` and an index on `timestamp`.
    *   Implement `saveScanHistory(entry: ScanHistoryEntry)` using `db.transaction(STORE_NAME, 'readwrite').store.put(entry)`.
    *   Implement `getScanHistory(): Promise<ScanHistoryEntry[]>` using `db.transaction(STORE_NAME, 'readonly').store.getAll()`.
    *   Implement `deleteScanHistory(id: string)` using `db.transaction(STORE_NAME, 'readwrite').store.delete(id)`.

    ```typescript
    // apps/web/lib/db/scanHistory.ts
    import { openDB, IDBPDatabase } from 'idb';

    export interface ScanHistoryEntry {
        id: string;
        timestamp: number; // Unix timestamp for sorting
        medicineName: string;
        status: 'VERIFIED' | 'SUSPICIOUS' | 'FAKE';
        // Add other relevant fields from VerifyResult as needed for display
    }

    const DB_NAME = 'sahi-dawa-scan-history';
    const DB_VERSION = 1;
    const STORE_NAME = 'scan-history';

    let dbPromise: Promise<IDBPDatabase<unknown>>;

    if (typeof window !== 'undefined') {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            },
        });
    } else {
        dbPromise = Promise.reject(new Error("IndexedDB is not available in SSR environment."));
    }

    export async function saveScanHistory(entry: ScanHistoryEntry) {
        const db = await dbPromise;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        await tx.store.put(entry);
        await tx.done;
    }

    export async function getScanHistory(): Promise<ScanHistoryEntry[]> {
        const db = await dbPromise;
        return db.transaction(STORE_NAME, 'readonly').store.getAll();
    }

    export async function deleteScanHistory(id: string) {
        const db = await dbPromise;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        await tx.store.delete(id);
        await tx.done;
    }
    ```

3.  **Modify the Scan Page (`apps/web/app/[locale]/scan/page.tsx`):**
    *   Import `saveScanHistory` and the `ScanHistoryEntry` type.
    *   Define helper functions like `getScanHistoryStatus(result: VerifyResult)` and `getScanHistoryMedicineName(result: VerifyResult, fallbackBrandName?: string)` to map the `VerifyResult` object to the `ScanHistoryEntry` fields.
    *   Within the `processVerificationResult` (or equivalent) function, after a `VerifyResult` is obtained, construct a `ScanHistoryEntry` object.
        *   Use `crypto.randomUUID()` for the `id`.
        *   Use `Date.now()` for the `timestamp`.
        *   Use the helper functions to populate `medicineName` and `status`.
    *   Call `void saveScanHistory(historyEntry).catch(...)` to persist the entry, including error logging using `structuredLog`.
    *   Remove any legacy local storage or temporary history saving logic.

4.  **Create the History Page (`apps/web/app/[locale]/history/page.tsx`):**
    *   Create the file and add `"use client";` at the top.
    *   Import `useEffect`, `useState`, `getScanHistory`, and `deleteScanHistory`.
    *   In the default export function `HistoryPage()`, declare `useState` for the history array.
    *   Use `useEffect` to call an `async` function (e.g., `loadHistory`) that fetches history using `getScanHistory()`, sorts it by `timestamp`, and updates the state.
    *   Implement an `async` `handleDelete(id: string)` function that calls `deleteScanHistory(id)` and then reloads the history.
    *   Render the UI, including:
        *   A dashboard with counts (Total, Verified, Suspicious, Fake) derived from the history state.
        *   Conditional rendering for an empty history state.
        *   A mapped list of history items, each displaying `medicineName`, `status`, `timestamp`, and a "Delete" button that calls `handleDelete`.

    ```typescript
    // apps/web/app/[locale]/history/page.tsx
    "use client";

    import { useEffect, useState } from "react";
    import { getScanHistory, deleteScanHistory, ScanHistoryEntry } from "@/lib/db/scanHistory";

    export default function HistoryPage() {
        const [history, setHistory] = useState<ScanHistoryEntry[]>([]);

        useEffect(() => {
            loadHistory();
        }, []);

        async function loadHistory() {
            try {
                const data = await getScanHistory();
                const sorted = data.sort((a, b) => b.timestamp - a.timestamp); // Newest first
                setHistory(sorted);
            } catch (error) {
                console.error("History load failed:", error);
            }
        }

        async function handleDelete(id: string) {
            await deleteScanHistory(id);
            await loadHistory(); // Reload history after deletion
        }

        const verifiedCount = history.filter(item => item.status === "VERIFIED").length;
        const suspiciousCount = history.filter(item => item.status === "SUSPICIOUS").length;
        const fakeCount = history.filter(item => item.status === "FAKE").length;

        return (
            <div className="min-h-screen bg-(--color-surface-page) p-6 text-(--color-text-primary)">
                <div className="mx-auto max-w-3xl">
                    <h1 className="mb-6 text-4xl font-black">Scan History</h1>
                    <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
                        {/* Dashboard stats display */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-sm opacity-70">Total</p>
                            <h2 className="mt-2 text-3xl font-bold">{history.length}</h2>
                        </div>
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                            <p className="text-sm text-emerald-300">Verified</p>
                            <h2 className="mt-2 text-3xl font-bold text-emerald-400">{verifiedCount}</h2>
                        </div>
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                            <p className="text-sm text-amber-300">Suspicious</p>
                            <h2 className="mt-2 text-3xl font-bold text-amber-400">{suspiciousCount}</h2>
                        </div>
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                            <p className="text-sm text-red-300">Fake</p>
                            <h2 className="mt-2 text-3xl font-bold text-red-400">{fakeCount}</h2>
                        </div>
                    </div>

                    {history.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                            <h2 className="text-2xl font-bold">No Scan History Yet</h2>
                            <p className="mt-2 opacity-70">Your verified medicines will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {history.map((item) => (
                                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-sm">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h2 className="text-xl font-bold">{item.medicineName}</h2>
                                            <p className="mt-2">
                                                Status:
                                                <span className={`ml-2 font-semibold ${
                                                    item.status?.toLowerCase() === "verified" ? "text-emerald-400" :
                                                    item.status?.toLowerCase() === "fake" ? "text-red-400" :
                                                    "text-amber-400"
                                                }`}>
                                                    {item.status}
                                                </span>
                                            </p>
                                            <p className="mt-2 text-sm opacity-70">
                                                {new Date(item.timestamp).toLocaleString()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-400"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }
    ```

5.  **Create the History Layout (`apps/web/app/[locale]/history/layout.tsx`):**
    *   A simple layout component for the route.
    ```typescript
    // apps/web/app/[locale]/history/layout.tsx
    export default function HistoryLayout({ children }: { children: React.ReactNode }) {
        return children;
    }
    ```

6.  **Add Navigation:** Ensure there's a link to `/history` in the application's main navigation.

**Gotchas:**
*   **Client-Side Only:** All IndexedDB operations *must* be performed in client components or within `useEffect` hooks to avoid errors during server-side rendering.
*   **Error Handling:** Always include `try...catch` blocks for asynchronous IndexedDB operations, as they can fail due to various reasons (e.g., storage limits, user permissions).
*   **Unique IDs:** Use a robust method like `crypto.randomUUID()` to generate unique identifiers for each history entry to prevent data collisions.

## Impact on System Architecture

This change significantly impacts our SahiDawa system architecture by:

*   **Establishing Offline-First Patterns:** We have laid down a clear architectural pattern for implementing offline-first features using IndexedDB. This is a foundational step for future functionalities that require local data persistence and resilience to network interruptions, which is crucial for SahiDawa's mission in rural health.
*   **Enhanced Frontend Capabilities:** The web application's frontend now possesses robust client-side data persistence, moving beyond a purely stateless interaction model for scan results. This allows for richer, more personalized user experiences.
*   **Improved User Experience and Engagement:** By providing users with a personal, persistent record of their interactions, we foster greater trust and utility in the platform. This can lead to increased user engagement and reliance on SahiDawa for medicine verification.
*   **Decoupled Data Storage Logic:** The creation of `apps/web/lib/db/scanHistory.ts` centralizes all IndexedDB-related logic for scan history. This promotes a cleaner, more modular architecture by separating data access concerns from UI components, making the codebase more maintainable and testable.
*   **Foundation for Local Analytics:** While currently displaying basic summary counts, this local history data forms a powerful foundation for more advanced client-side analytics or personalized insights into a user's scanning habits, without requiring immediate server-side data synchronization.
*   **Increased Frontend Complexity:** The introduction of client-side state management for history, asynchronous data fetching, and IndexedDB interactions adds a layer of complexity to the frontend. This necessitates careful consideration for future feature development, performance optimizations, and ongoing maintenance.

## Testing & Verification

The feature was tested and verified through several methods:

*   **Local Feature Testing:** The author performed local testing of the feature, confirming its basic functionality as indicated in the PR checklist.
*   **Offline Functionality Verification:** Explicit testing was conducted to ensure the feature works offline using IndexedDB. This implies scenarios where network connectivity was simulated as unavailable, and the history page could still load and display previously saved scans.
*   **Screenshot-Based Proof of Work:** Screenshots were provided to visually confirm key aspects of the feature:
    *   The complete scan verification flow, demonstrating that a scan successfully leads to a history entry.
    *   The history dashboard UI, validating the correct display of total, verified, suspicious, and fake scan counts.
    *   A failed verification attempt being correctly saved and displayed in the history, confirming that non-verified results are also persisted.
    *   The delete history functionality, showing that individual entries can be successfully removed from the local record.
*   **Edge Cases:**
    *   **Empty History:** The UI correctly handles the state where no scan history exists, displaying an informative message.
    *   **Error Handling:** While `console.error` is used for logging IndexedDB operation failures, the current UI does not provide explicit user feedback for such errors. This is an area for potential future enhancement.
    *   **Data Integrity:** The use of `idb` with `keyPath: 'id'` inherently helps maintain data integrity for individual entries, ensuring unique identification and preventing accidental overwrites based on the `id`.
    *   **Storage Limits:** IndexedDB offers significantly larger storage limits than other client-side storage options, making it suitable for typical user history sizes. The system would gracefully handle storage limit errors by throwing an exception if encountered.