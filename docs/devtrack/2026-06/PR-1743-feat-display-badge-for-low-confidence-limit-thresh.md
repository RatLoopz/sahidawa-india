# PR #1743 — feat: display badge for low confidence limit (threshold 75)

> **Merged:** 2026-06-12 | **Author:** @Ayush2496 | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #1486

## What Changed

We have introduced a new user interface component, `LowConfidenceBanner`, to the `apps/web/app/[locale]/scan/page.tsx` file. This banner now prominently displays a "Low Confidence Match" warning whenever a medicine is identified through fuzzy matching with a confidence score strictly below 75%. The `fuzzyScore` is now managed within the `ScanPage` component's state and is passed down to the `VerifiedSafeResult` and `CounterfeitAlertResult` components to enable this conditional display.

## The Problem Being Solved

Prior to this change, when our system identified a medicine using fuzzy matching, the user was presented with the result without any explicit indication of the confidence level of that match. This lack of transparency could lead users to mistakenly assume an exact or highly confident match, even when the underlying fuzzy score was low. Such an oversight posed a potential safety risk, as users might rely on a less-than-certain identification for critical health decisions. The SahiDawa platform was missing a clear and immediate mechanism to warn users about these low-confidence fuzzy matches.

## Files Modified

- `apps/web/app/[locale]/scan/page.tsx`

## Implementation Details

The implementation of the low confidence banner involved several key modifications within the `apps/web/app/[locale]/scan/page.tsx` file:

1.  **`fuzzyScore` State Management:**
    - A new React state variable, `fuzzyScore`, was introduced within the `ScanPage` functional component using `const [fuzzyScore, setFuzzyScore] = useState<number | null>(null);`. This state is initialized to `null`.
    - This `fuzzyScore` state is populated within the `handleOcrScan` asynchronous function. After the `fuzzyMatchMedicine` utility returns a list of matches, if `topMatch.score` (from `matchRes[0]`) is greater than or equal to 60, `setFuzzyScore(topMatch.score)` is called to store the confidence score.
    - Crucially, the `fuzzyScore` is reset to `null` in all relevant verification and scan reset flows to ensure the banner does not persist incorrectly across different user interactions. This includes:
        - At the beginning of `handleVerifyBatch` before calling `verifyMedicine`.
        - Within `handleScanAgain` for a full reset.
        - Within `handleResetScan` for a partial reset.
        - Within `handleCancelScan` when the OCR process is cancelled.

2.  **`isLowConfidenceScore` Helper Function:**
    - A utility function, `isLowConfidenceScore`, was added to the file:
        ```typescript
        function isLowConfidenceScore(score: number | null | undefined): boolean {
            if (score == null) return false;
            return score < 75;
        }
        ```
    - This function takes a `score` (which can be `number`, `null`, or `undefined`) and returns `true` only if the score is a number and is strictly less than 75. This defines the threshold for displaying the low confidence warning.

3.  **`LowConfidenceBanner` Component:**
    - A new React functional component, `LowConfidenceBanner`, was created. It accepts a single prop: `score` (`number | null | undefined`).
    - The component's rendering is conditional: `if (!isLowConfidenceScore(score)) return null;`. This ensures the banner is only rendered when the `isLowConfidenceScore` helper returns `true`.
    - When rendered, the banner is styled with amber-themed Tailwind CSS classes (e.g., `border-amber-300`, `bg-amber-50`, `text-amber-800`) to visually convey a warning. It includes an `AlertTriangle` icon (presumably from `lucide-react` or a similar icon library) and two paragraphs of text: "Low Confidence Match" (bold) and "This result may not be accurate (match score: X%). Please verify this medicine independently before use." The `score` is rounded using `Math.round(score)` before being displayed.

4.  **Integration into Result Components:**
    - The `fuzzyScore` state variable from `ScanPage` is now passed as a new prop to both the `VerifiedSafeResult` and `CounterfeitAlertResult` components.
    - Inside both `VerifiedSafeResult` and `CounterfeitAlertResult`, the `LowConfidenceBanner` component is rendered, receiving the `fuzzyScore` prop: `<LowConfidenceBanner score={fuzzyScore} />`. This placement ensures the banner appears prominently within the result display, below the main medicine details and CDSCO status, but above other detailed information.

## Technical Decisions

1.  **Threshold of 75% for Low Confidence:** The decision to set the low confidence threshold at 75% was made to strike a balance between providing critical warnings and avoiding "alert fatigue" for the user. Scores below 75% are considered sufficiently ambiguous to warrant an explicit user warning, prompting independent verification. Conversely, scores at or above 75% are deemed reliable enough not to require a specific warning banner, even though they originate from fuzzy matches.
2.  **Dedicated `LowConfidenceBanner` Component:** We opted to create a separate, self-contained `LowConfidenceBanner` component. This approach adheres to React's principles of component reusability and separation of concerns. It encapsulates the UI and conditional rendering logic for the warning, making the parent `ScanPage`, `VerifiedSafeResult`, and `CounterfeitAlertResult` components cleaner and easier to manage.
3.  **`isLowConfidenceScore` Helper Function:** Abstracting the core logic for determining a "low confidence" score into a dedicated helper function (`isLowConfidenceScore`) significantly improves code readability and maintainability. This centralization makes it straightforward to modify the confidence threshold or introduce more complex conditions for warnings in the future without scattering logic across multiple parts of the codebase.
4.  **React `useState` for `fuzzyScore`:** Utilizing React's `useState` hook within `ScanPage` for `fuzzyScore` is the standard and most appropriate pattern for managing UI-specific, mutable data. Passing this state down as a prop to child components (`VerifiedSafeResult`, `CounterfeitAlertResult`) follows typical React data flow principles. The diligent resetting of `fuzzyScore` in all relevant scan and reset flows is crucial to prevent stale data and ensure the banner accurately reflects the current scan result.
5.  **Prominent Banner Placement:** The `LowConfidenceBanner` is strategically placed within both `VerifiedSafeResult` and `CounterfeitAlertResult` components, just below the main medicine identification and CDSCO approval status. This ensures that the warning is immediately visible and cannot be easily overlooked by the user when a fuzzy match result is displayed.

## How To Re-Implement (Contributor Reference)

To re-implement this feature from scratch, a contributor would follow these steps:

1.  **Introduce `fuzzyScore` State:**
    - In `apps/web/app/[locale]/scan/page.tsx`, within the `ScanPage` functional component, add the following state declaration:
        ```typescript
        const [fuzzyScore, setFuzzyScore] = useState<number | null>(null);
        ```

2.  **Populate `fuzzyScore` from Fuzzy Match Results:**
    - Locate the `handleOcrScan` asynchronous function. Inside the `if (matchRes.length > 0)` block, after `const topMatch = matchRes[0];`, add the line to set the fuzzy score if it meets a minimum relevance threshold (e.g., 60, as in the original implementation):
        ```typescript
        if (topMatch.score >= 60) {
            setParsedBrand(topMatch.name);
            setFuzzyScore(topMatch.score); // Add this line
            // ... rest of the logic
        }
        ```

3.  **Reset `fuzzyScore` in Scan/Reset Flows:**
    - Ensure `setFuzzyScore(null);` is called in all functions that clear or reset the scan state to prevent the banner from persisting from previous scans. Specifically, add this line in:
        - `handleVerifyBatch` (at the beginning, before API call).
        - `handleScanAgain`.
        - `handleResetScan`.
        - `handleCancelScan`.

4.  **Create `isLowConfidenceScore` Helper Function:**
    - Define this function at the top of `apps/web/app/[locale]/scan/page.tsx`, outside the `ScanPage` component:
        ```typescript
        function isLowConfidenceScore(score: number | null | undefined): boolean {
            if (score == null) return false;
            return score < 75; // The defined threshold
        }
        ```

5.  **Create `LowConfidenceBanner` Component:**
    - Define this React functional component below `isLowConfidenceScore` in the same file. Remember to import `AlertTriangle` from your icon library (e.g., `lucide-react`).

        ```typescript
        import { AlertTriangle } from "lucide-react"; // Example import

        function LowConfidenceBanner({ score }: { score: number | null | undefined }) {
            if (!isLowConfidenceScore(score)) return null;
            return (
                <div className="flex w-full items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-left dark:border-amber-800 dark:bg-amber-950/30">
                    <AlertTriangle
                        size={20}
                        className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                    />
                    <div>
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                            Low Confidence Match
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed font-medium text-amber-700 dark:text-amber-400">
                            This result may not be accurate
                            {score != null ? ` (match score: ${Math.round(score)}%)` : ""}. Please verify
                            this medicine independently before use.
                        </p>
                    </div>
                </div>
            );
        }
        ```

6.  **Pass `fuzzyScore` to Result Components:**
    - In the `ScanPage` component's `return` statement, locate the `VerifiedSafeResult` and `CounterfeitAlertResult` components. Add the `fuzzyScore` prop to both:
        ```typescript
        // ... inside ScanPage return
        <VerifiedSafeResult
            // ... existing props
            fuzzyScore={fuzzyScore} // Add this
        />
        // ...
        <CounterfeitAlertResult
            // ... existing props
            fuzzyScore={fuzzyScore} // Add this
        />
        ```
    - Update the prop types for `VerifiedSafeResult` and `CounterfeitAlertResult` to include `fuzzyScore?: number | null;`.

7.  **Render `LowConfidenceBanner` in Result Components:**
    - Inside the `VerifiedSafeResult` component, add the `LowConfidenceBanner` after the `CdscoStatusBadge`:
        ```typescript
        // ... inside VerifiedSafeResult
        <CdscoStatusBadge status={medicine.cdsco_approval_status} />
        <LowConfidenceBanner score={fuzzyScore} /> {/* Add this */}
        // ...
        ```
    - Inside the `CounterfeitAlertResult` component, add the `LowConfidenceBanner` after the initial alert message div:
        ```typescript
        // ... inside CounterfeitAlertResult
        </div> {/* closing div for initial alert message */}
        <LowConfidenceBanner score={fuzzyScore} /> {/* Add this */}
        // ...
        ```

## Impact on System Architecture

This change primarily impacts the frontend user experience and state management within the `ScanPage` component.

- **Enhanced User Trust and Safety:** This feature significantly improves the transparency and reliability of the SahiDawa platform from a user's perspective. By explicitly warning about low-confidence matches, we empower users to make more informed decisions regarding medicine verification, directly aligning with our core mission of promoting health safety.
- **Frontend State Management Refinement:** The introduction of `fuzzyScore` as a new piece of frontend state within `ScanPage` necessitates careful management across various scan and reset flows. This reinforces the importance of robust and predictable state handling in complex, interactive components.
- **Modular Component Design:** The creation of `LowConfidenceBanner` and the `isLowConfidenceScore` helper function promotes a more modular and maintainable frontend architecture. These components encapsulate specific UI and business logic, making them potentially reusable for similar warning mechanisms in other parts of the application.
- **No Backend Impact:** This is purely a frontend-driven enhancement. It leverages existing data (the fuzzy match score) already provided by our backend services via the `fuzzyMatchMedicine` function, requiring no changes to our backend APIs, data models, or database schema.
- **Foundation for Future Confidence Indicators:** This implementation establishes a clear pattern for displaying confidence levels to users. This foundation could be extended in the future to include different thresholds, more granular confidence indicators for various data points, or more sophisticated UI feedback based on the quality of data matches.

## Testing & Verification

The verification for this change primarily relied on manual testing and visual inspection, as detailed in the PR description's "Behavior" table.

- **Manual Scenario Testing:**
    - **Exact batch lookup (`score = null`)**: The `isLowConfidenceScore` function correctly returns `false` when `score` is `null`, preventing the banner from being displayed.
    - **Score ≥ 75**: The `isLowConfidenceScore` function correctly returns `false` when the score is 75 or higher, ensuring the banner is not shown for confident fuzzy matches.
    - **Score = 75**: Specifically tested to confirm that the `score < 75` condition evaluates to `false`, thus not showing the banner.
    - **Score < 75**: The `isLowConfidenceScore` function correctly returns `true`, leading to the display of the `LowConfidenceBanner`. This was visually confirmed via the provided screenshot.
    - **No match found**: In scenarios where no match is found, the `fuzzyScore` would remain `null` or the result flow would bypass the components that display the banner, thus preventing its erroneous display.

- **Visual Verification:** The provided screenshot in the PR confirms the correct visual appearance, styling, and content of the `LowConfidenceBanner` when a low confidence score is present.

- **Edge Cases Handled:**
    - The `isLowConfidenceScore` helper explicitly handles `null` or `undefined` scores, ensuring the banner does not appear when no fuzzy score is available (e.g., for exact matches or no match found).
    - The `Math.round(score)` within the banner's text ensures that any decimal fuzzy scores are presented to the user in a clean, rounded percentage format.

- **Unit/Component Testing:** Not documented in this PR.
