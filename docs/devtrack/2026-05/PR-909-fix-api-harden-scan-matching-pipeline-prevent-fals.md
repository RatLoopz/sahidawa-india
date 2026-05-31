# PR #909 — fix(api): harden scan matching pipeline — prevent false-positive verification

> **Merged:** 2026-05-30 | **Author:** @shreyasfegade | **Area:** Backend | **Impact Score:** 9 | **Closes:** #894

## What Changed

This pull request significantly hardens our `POST /extract` API endpoint in `apps/api/src/routes/scan.ts` by refining the medicine name matching pipeline. We introduced stricter criteria for substring fallback matches, including a minimum candidate length and word-boundary regex matching, while capping their confidence score. Additionally, we implemented a new `matchSource` field to track the origin of a successful match and added a critical post-database lookup verification step specifically for substring fallback matches to prevent false positives. The API response now includes `matchScore` and `matchSource` for enhanced transparency.

## The Problem Being Solved

Prior to this change, our scan matching pipeline, particularly the "substring fallback" mechanism, was susceptible to false-positive verifications. The previous implementation used a simple `String.prototype.includes()` check, which could lead to incorrect matches. For example, if a user scanned "Panadol Extra" and our database contained "Panadol", the system might incorrectly identify "Panadol" as a match because "Panadol Extra" `includes` "Panadol". Furthermore, if the database lookup for "Panadol" (via `ILIKE`) then returned a different medicine like "Panadol Extra" (due to `ILIKE`'s broad matching), the system would still report a successful verification for "Panadol" even though the retrieved medicine was not an exact name match. This lack of precision undermined the reliability of our verification process, potentially leading to users receiving incorrect information about their medicines. The absence of `matchScore` and `matchSource` in the API response also made it difficult for client applications to understand the confidence and origin of a match.

## Files Modified

- `apps/api/src/routes/scan.ts`

## Implementation Details

The core changes are concentrated within the `router.post("/extract", ...)` handler in `apps/api/src/routes/scan.ts`, specifically within the medicine name matching logic.

1.  **Match Provenance Tracking:**
    We introduced a new local variable `matchSource: "advanced" | "ml_fuzzy" | "substring_fallback" | "none" = "none";` at the beginning of the matching block. This variable is updated to reflect which matching strategy successfully identified `matchedName` and `matchScore`.
    *   If `bestAdvancedScore >= 80`, `matchSource` is set to `"advanced"`.
    *   If `topMatch.score >= 50` from the ML fuzzy matcher, `matchSource` is set to `"ml_fuzzy"`.
    *   If the `substring_fallback` logic finds a match, `matchSource` is set to `"substring_fallback"`.

2.  **Substring Fallback Hardening:**
    The `if (!matchedName)` block, which handles the fallback substring matching, received significant updates:
    *   **Minimum Length Check:** Before attempting a substring match, we now check `if (lowerName.length < 5) continue;`. This prevents overly broad and low-confidence matches from very short candidate names.
    *   **Word-Boundary Regex:** The previous `normalizedText.includes(name.toLowerCase())` check was replaced with a more precise word-boundary regular expression.
        *   The candidate name (`lowerName`) is first escaped using `lowerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` to ensure special regex characters are treated literally.
        *   A new `RegExp` is constructed: `new RegExp(\`\\b\${escaped}\\b\`)`. The `\b` (word boundary) ensures that the match is for a whole word, preventing partial matches (e.g., "Advil" matching within "Advilon").
        *   The `boundary.test(normalizedText)` method is then used for the match.
    *   **Capped Score:** The `matchScore` for `substring_fallback` matches is now capped at `60`, down from `100`. This reflects its lower confidence compared to advanced or ML fuzzy matches.

3.  **Post-Fetch Verification for Fallback Matches:**
    After a potential `medicineData` record is retrieved from the database using `db.getMedicineByName(matchedName)`, we added a critical verification step:
    *   `if (medicineData && matchSource === "substring_fallback")`: This block executes only if a medicine record was found and the match originated from the `substring_fallback` strategy.
    *   We compare the lowercase `brand_name` or `generic_name` of the retrieved `medicineData` with the lowercase `matchedName` (referred to as `needle`).
    *   `if (dbBrand !== needle && dbGeneric !== needle)`: If neither the brand name nor the generic name from the database record *exactly* matches the `matchedName` that was used to query, it indicates a false positive where the `ILIKE` query returned a broader match.
    *   In such cases, `medicineData` is set to `null`, effectively dropping the match, and a warning is logged using `logger.warn` to indicate that a weak fallback match was dropped.

4.  **Response Includes Match Metadata:**
    The final JSON response object now includes two new additive fields:
    *   `matchScore: matchedName ? matchScore : null,`
    *   `matchSource: matchedName ? matchSource : null,`
    These fields are populated if a `matchedName` was found, otherwise they are `null`. This ensures backward compatibility for existing clients.

## Technical Decisions

1.  **Word-Boundary Regex (`\b`) for Substring Fallback:** We chose to replace `String.prototype.includes()` with a word-boundary regex (`\b${escaped}\b`) to drastically reduce false positives. `includes()` is too permissive, allowing "Panadol" to match "Panadol Extra" or "Advil" to match "Advilon". The `\b` ensures that only whole words are matched, providing a much higher degree of accuracy for this fallback mechanism. Escaping the candidate name prevents regex injection vulnerabilities if the name contains special characters.
2.  **Minimum Length (5 characters) for Substring Fallback:** Short strings (e.g., "A", "Rx") are highly ambiguous and prone to false matches. By requiring a minimum length of 5 characters, we filter out low-quality candidates that are unlikely to be accurate medicine names, thereby improving the signal-to-noise ratio for the fallback.
3.  **Capping Fallback Score at 60:** The `substring_fallback` is the least sophisticated and most error-prone matching strategy. Assigning it a score of `100` (as it was previously) implied perfect confidence, which was misleading. Capping it at `60` correctly positions it below the `advanced` (>=80) and `ml_fuzzy` (>=50, but generally higher for good matches) strategies, reflecting its role as a last-resort, lower-confidence match.
4.  **Post-Fetch Verification for Fallback Matches:** This is a critical safety net. Even with improved substring matching, the database lookup using `ILIKE` (which is case-insensitive and allows for partial matches) could still retrieve a record that *contains* the `matchedName` but isn't an *exact* match for its `brand_name` or `generic_name`. This verification step ensures that if our fallback mechanism identified "Panadol", the retrieved database record is indeed for "Panadol" and not "Panadol Extra". This prevents the system from verifying a medicine that was only loosely related by a substring.
5.  **Tracking `matchSource`:** This decision was made to provide transparency and enable more intelligent client-side behavior. Knowing whether a match came from a highly confident "advanced" algorithm, an "ml_fuzzy" model, or a "substring_fallback" allows client applications to display different confidence indicators or even prompt the user for confirmation for lower-confidence matches. It also provides invaluable data for debugging and future improvements to our matching algorithms.
6.  **Additive Response Fields:** Adding `matchScore` and `matchSource` as new fields to the existing response schema ensures backward compatibility. Existing clients that do not expect these fields will simply ignore them, while updated clients can leverage this new metadata.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, a contributor would follow these steps within the `apps/api/src/routes/scan.ts` file, specifically within the `router.post("/extract", ...)` handler:

1.  **Initialize Match Source:**
    Declare a variable to track the match source at the beginning of the matching logic, typically after `let matchScore = 0;`:
    ```typescript
    let matchSource: "advanced" | "ml_fuzzy" | "substring_fallback" | "none" = "none";
    ```

2.  **Update Match Source for Advanced Matcher:**
    Inside the `if (bestAdvancedScore >= 80)` block, after setting `matchedName` and `matchScore`:
    ```typescript
    matchSource = "advanced";
    ```

3.  **Update Match Source for ML Fuzzy Matcher:**
    Inside the `if (topMatch.score >= 50)` block for the ML fuzzy matcher, after setting `matchedName` and `matchScore`:
    ```typescript
    matchSource = "ml_fuzzy";
    ```

4.  **Harden Substring Fallback Logic:**
    Locate the `if (!matchedName)` block that iterates through `candidates`. Modify the loop as follows:
    ```typescript
    if (!matchedName) {
        const normalizedText = rawText.toLowerCase();
        for (const name of candidates) {
            const lowerName = name.toLowerCase();
            // Add minimum length check
            if (lowerName.length < 5) continue;

            // Escape special regex characters in the candidate name
            const escaped = lowerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            // Create a word-boundary regex
            const boundary = new RegExp(`\\b${escaped}\\b`);

            // Use regex for matching instead of .includes()
            if (boundary.test(normalizedText)) {
                matchedName = name;
                // Cap the score for fallback matches
                matchScore = 60;
                // Set match source
                matchSource = "substring_fallback";
                logger.info(`Substring fallback match: "${matchedName}" (capped score ${matchScore})`);
                break;
            }
        }
    }
    ```

5.  **Implement Post-Fetch Verification:**
    After the `try...catch` block where `medicineData = dbMed;` or `medicineData = db.getMedicineByName(matchedName);` occurs, add the following verification logic:
    ```typescript
    // Verify the returned record actually matches — not just a substring hit
    if (medicineData && matchSource === "substring_fallback") {
        const dbBrand = (medicineData.brand_name || "").toLowerCase();
        const dbGeneric = (medicineData.generic_name || "").toLowerCase();
        const needle = matchedName!.toLowerCase(); // matchedName is guaranteed to be non-null here

        if (dbBrand !== needle && dbGeneric !== needle) {
            logger.warn(
                `Dropping weak fallback match: "${matchedName}" resolved to "${medicineData.brand_name}" — not an exact name match`
            );
            medicineData = null; // Drop the match
        }
    }
    ```

6.  **Extend API Response:**
    In the final `res.json(...)` call, add the new fields to the response object:
    ```typescript
    res.json({
        // ... existing fields ...
        medicine: medicineResponse,
        matched: !!medicineResponse,
        matchScore: matchedName ? matchScore : null, // Add matchScore
        matchSource: matchedName ? matchSource : null, // Add matchSource
    });
    ```

This sequence ensures that the matching logic is hardened, provenance is tracked, and the API provides richer, more reliable information.

## Impact on System Architecture

This change primarily impacts the reliability and transparency of our backend API's medicine verification capabilities.

*   **Increased Reliability:** By significantly reducing false-positive verifications, we enhance the trustworthiness of the SahiDawa platform. Users can have higher confidence that when a medicine is "verified," it is indeed the exact medicine they scanned. This directly improves the core value proposition of our platform.
*   **Enhanced Transparency and Debuggability:** The introduction of `matchSource` and `matchScore` in the API response provides crucial metadata. Client applications can now use this information to display different UI elements (e.g., "High Confidence Match," "Possible Match, Please Confirm") or to color-code results based on the match's origin and score. For our engineering team, this metadata is invaluable for debugging matching issues and for future analysis to further refine our algorithms.
*   **Foundation for Future Development:** The clear distinction between matching strategies (advanced, ML fuzzy, substring fallback) through `matchSource` lays a foundation for more sophisticated logic. For instance, we could implement A/B testing of new matching algorithms more easily, or prioritize certain match sources over others in future iterations.
*   **No Major Architectural Shift:** This change is an enhancement within an existing API endpoint and does not introduce new services, databases, or significant changes to the overall system architecture. It's a targeted improvement to a critical component of our existing backend.

## Testing & Verification

Not documented in this PR. However, typical verification for such changes would involve:

*   **Unit Tests:** For the new regex logic to ensure correct word-boundary matching and proper escaping of special characters. Tests for the minimum length check.
*   **Integration Tests:** A suite of test cases for the `POST /extract` endpoint with various `rawText` inputs, including:
    *   Exact matches (e.g., "Crocin")
    *   Partial matches that should now fail (e.g., "Panadol Extra" matching "Panadol")
    *   Inputs containing special characters to verify regex escaping.
    *   Inputs where the `substring_fallback` should trigger, and then the post-fetch verification should correctly drop a non-exact match.
    *   Inputs that trigger `advanced` and `ml_fuzzy` matches to ensure they are unaffected.
*   **Response Schema Validation:** To confirm that `matchScore` and `matchSource` are correctly included in the JSON response and are `null` when no match is found.
*   **Logging Verification:** Checking `logger.info` and `logger.warn` messages to ensure they are emitted correctly for different match scenarios, especially when a weak fallback match is dropped.