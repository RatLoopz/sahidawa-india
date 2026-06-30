# PR #2805 — fix(#2802): guard corrupt medicine bookmarks storage

> **Merged:** 2026-06-29 | **Author:** @Shreya-nipunge | **Area:** Frontend | **Impact Score:** 10 | **Closes:** #2802

## What Changed

We introduced defensive parsing and validation for the `medicine-bookmarks` key in `localStorage` across our frontend application. Specifically, we added a self-healing helper function `getSavedMedicineBookmarks` to safely retrieve, parse, and validate stored bookmarks. If the stored data is corrupt, malformed, or does not conform to an array structure, our system now gracefully resets the key to an empty array (`"[]"`) and returns an empty list instead of crashing the UI.

## The Problem Being Solved

Previously, our application directly parsed the `medicine-bookmarks` local storage value using `JSON.parse(localStorage.getItem("medicine-bookmarks") || "[]")` without verifying the integrity or shape of the retrieved data. This created two critical vulnerabilities:
1. **Malformed JSON Crashes**: If a user's browser stored invalid JSON (e.g., `"not-json"`), `JSON.parse` would throw an unhandled syntax error, leading to a complete white-screen crash of the `/my-medicines` page and any page rendering a `GenericAlternativeCard`.
2. **Type Mismatch Errors**: If the stored JSON was valid but resolved to an object instead of an array (e.g., `{"test": true}`), downstream array operations such as `.some()` or `.filter()` would throw runtime exceptions like `saved.some is not a function`.

These issues severely impacted the reliability of our platform, particularly for rural users who might experience interrupted sessions, browser crashes, or storage corruption.

## Files Modified

- `apps/web/app/[locale]/my-medicines/page.tsx`
- `apps/web/components/GenericAlternativeCard.tsx`

## Implementation Details

We implemented a unified defensive retrieval pattern via a new local helper function, `getSavedMedicineBookmarks()`, in both modified files.

### The `getSavedMedicineBookmarks` Helper Function
This function executes the following sequence to guarantee safe state recovery:
1. **SSR Guard**: Checks if `typeof window === "undefined"` to prevent Next.js server-side rendering errors, returning an empty array `[]` if executed on the server.
2. **Retrieval**: Fetches the raw string from `localStorage.getItem("medicine-bookmarks")`. If the key does not exist, it returns `[]`.
3. **Parsing & Validation**: Wraps `JSON.parse` in a `try-catch` block. Once parsed, it explicitly checks the data type using `Array.isArray(parsed)`.
4. **Self-Healing Reset**: If the parsed data is not an array, or if parsing throws an exception, the function catches the error, overwrites the corrupt storage key with a clean stringified empty array (`localStorage.setItem("medicine-bookmarks", "[]")`), and returns `[]`.

### Integration Points
- **`apps/web/app/[locale]/my-medicines/page.tsx`**: Replaced the direct `JSON.parse` call inside the page's initialization `useEffect` hook with `getSavedMedicineBookmarks()`. This ensures the user's bookmarked medicines list loads safely.
- **`apps/web/components/GenericAlternativeCard.tsx`**: Replaced direct storage reads in both the initial bookmark status check (`useEffect`) and the bookmark toggle handler (`handleBookmark`) with the new helper function.

## Technical Decisions

- **Self-Healing Storage Over Silent Failure**: Instead of simply returning an empty array when parsing fails, we chose to actively overwrite the corrupt `localStorage` key with `"[]"`. This self-healing mechanism ensures that subsequent reads do not repeatedly trigger parsing exceptions or require continuous recovery overhead.
- **Local Helper Duplication**: We implemented `getSavedMedicineBookmarks` locally within both files rather than exporting it from a shared utility file. While this introduces minor duplication, it keeps the bug fix highly localized, minimizes import dependency chains, and ensures type safety tailored to the specific interfaces (`BookmarkedMedicine[]` vs. `GenericAlternative[]`) used in each file.
- **TypeScript Type Safety**: The helper functions are explicitly typed to return arrays matching their respective component requirements, ensuring that downstream operations (like `.some()` and `.filter()`) remain fully type-safe.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar safe-storage retrieval pattern for other `localStorage` keys in our system, follow these steps:

1. **Define the Safe Getter**: Implement a helper function matching this structure:
   ```typescript
   function getSafeStorageData<T>(): T[] {
       if (typeof window === "undefined") return [];

       try {
           const stored = localStorage.getItem("your-storage-key");
           if (!stored) return [];

           const parsed = JSON.parse(stored);
           if (!Array.isArray(parsed)) {
               localStorage.setItem("your-storage-key", "[]");
               return [];
           }

           return parsed as T[];
       } catch {
           localStorage.setItem("your-storage-key", "[]");
           return [];
       }
   }
   ```
2. **Execute Inside Client-Side Contexts**: Always call this helper inside `useEffect` hooks or event handlers (like `onClick`) to guarantee that it only runs on the client side, avoiding Next.js hydration mismatches.
3. **Avoid Direct Writes Without Validation**: When writing back to `localStorage`, ensure you are stringifying a validated array structure to prevent re-introducing corrupt states.

## Impact on System Architecture

This change introduces a robust, fault-tolerant pattern for client-side state management within SahiDawa. By transitioning from fragile direct-parsing to defensive, self-healing reads, we prevent local state corruption from escalating into application-wide crashes. This improves the resilience of our offline-first capabilities, which are critical for rural healthcare workers operating in low-connectivity environments where browser sessions might be interrupted or corrupted.

## Testing & Verification

We verified the fix using manual browser console testing to simulate various states of local storage corruption:

- **Test Case 1: Invalid JSON String**
  - Command: `localStorage.setItem("medicine-bookmarks", "not-json")`
  - Result: Navigating to `/my-medicines` and alternative card pages did not crash the application. The system safely caught the syntax error, reset the storage key to `[]`, and rendered an empty bookmarks list.
- **Test Case 2: Incorrect Data Shape (Object instead of Array)**
  - Command: `localStorage.setItem("medicine-bookmarks", JSON.stringify({ test: true }))`
  - Result: The application did not throw `saved.some is not a function`. The system detected that the parsed object was not an array, reset the storage key to `[]`, and continued rendering normally.
- **Test Case 3: Valid Array Data**
  - Command: `localStorage.setItem("medicine-bookmarks", JSON.stringify([{ alternative_name: "Paracetamol" }]))`
  - Result: The application successfully parsed the array, identified the bookmarked item, and rendered the active bookmark state without modifying the valid storage.