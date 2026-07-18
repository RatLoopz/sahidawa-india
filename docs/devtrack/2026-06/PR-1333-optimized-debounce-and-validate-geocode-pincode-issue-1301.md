# PR #1333 — Optimized debounce and validate geocode pincode issue#1301

> **Merged:** 2026-06-06 | **Author:** @hrx01-dev | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #1301

## What Changed

This pull request significantly enhances the `ReportWizard` component by implementing robust client-side validation and a debouncing mechanism for the pincode input field. We have updated the `zod` schema to enforce a stricter 6-digit Indian pincode format and introduced a `useEffect` hook that intelligently delays and filters API calls to the `geocodePincode` endpoint, preventing unnecessary network requests and auto-populating city and state fields efficiently.

## The Problem Being Solved

Previously, our system was making an excessive number of API requests to the `geocodePincode` endpoint within the `ReportWizard`. This occurred for every keystroke in the pincode input field, regardless of whether the input was a complete, valid 6-digit Indian pincode. This "API hammering" led to several issues: increased server load, unnecessary network traffic, and a potentially degraded user experience due to redundant or premature geocoding attempts. The problem was specifically tracked in issue #1301, highlighting the need for a more performant and intelligent approach to handling pincode input and subsequent geocoding.

## Files Modified

- `apps/web/components/reports/ReportWizard.tsx`

## Implementation Details

The core changes are concentrated within the `Step3` functional component of `apps/web/components/reports/ReportWizard.tsx`.

1.  **Enhanced Pincode Schema Validation:**
    *   The `pincode` field within the `zod` schema definition was updated.
    *   The previous regex `^\d{6}$` (which allowed any 6 digits, including those starting with '0') was replaced with `^[1-9][0-9]{5}$`. This new regex specifically validates for a 6-digit string that must not start with '0', aligning with the standard format for Indian pincodes.
    *   The associated error message was refined to `"Enter a valid 6-digit Indian Pincode (cannot start with 0)"`, providing clearer user guidance.

2.  **Debounced Geocoding `useEffect` Hook:**
    *   Inside `Step3`, we now leverage `watch` and `setValue` from `useFormContext` to monitor the `pincode` field and programmatically update other form fields.
    *   A `useEffect` hook is introduced, with `pincode` and `setValue` as its dependencies, ensuring it reacts to changes in the pincode input.
    *   **Regex Shielding (Immediate Validation):** A local `PIN_REGEX = /^[1-9][0-9]{5}$/` is defined within the `useEffect`. An immediate check `if (!PIN_REGEX.test(pincode)) return;` is performed. This serves as the first layer of defense: if the `pincode` does not conform to the valid 6-digit Indian pincode format, the `useEffect` exits early, preventing any further processing or the initiation of a network request.
    *   **Debounce Logic:** If the pincode passes the initial regex check, a `setTimeout` is initiated with a `500` millisecond delay. This `setTimeout` encapsulates the asynchronous call to the `geocodePincode` API.
    *   **API Call and Auto-population:**
        *   The `setTimeout` callback executes an `async` function.
        *   It calls `geocodePincode(pincode)`. The returned `geo` object is cast to `any` to allow flexible access to its `city` and `state` properties.
        *   If `geo` data is successfully retrieved, `setValue("city", geo.city, { shouldValidate: true })` and `setValue("state", geo.state, { shouldValidate: true })` are called. The `{ shouldValidate: true }` option ensures that these auto-populated fields are also validated against their respective schema rules.
        *   A `try-catch` block is used to gracefully handle any errors that might occur during the `geocodePincode` API call, logging them to the console.
    *   **Cleanup Function:** The `useEffect` returns a cleanup function `() => clearTimeout(timer)`. This is critical for debouncing: if the `pincode` value changes again before the 500ms `setTimeout` completes, the `clearTimeout` function cancels the pending API request, and a new timer is started for the latest `pincode` value. This ensures only the request for the final, stable input is sent.

## Technical Decisions

We made several deliberate technical decisions to address the performance and validation issues:

1.  **Dual-Layer Validation:** We chose to implement validation at two distinct layers:
    *   **`zod` Schema Validation:** This provides immediate, synchronous feedback to the user directly on the form field. It's crucial for a good user experience, as it prevents users from even attempting to submit invalid formats and immediately guides them towards correct input. The specific regex `^[1-9][0-9]{5}$` was chosen for its precision in matching Indian pincode standards.
    *   **`useEffect` Regex Shielding:** This second layer of validation within the `useEffect` acts as a gatekeeper for the API call. Even if a user bypasses or temporarily invalidates the `zod` schema (e.g., by rapidly typing), this check ensures that no network request is initiated unless the `pincode` strictly adheres to the valid format.
2.  **`useEffect` with `setTimeout`/`clearTimeout` for Debouncing:** This is a standard and highly effective React pattern for handling asynchronous operations triggered by rapidly changing user input.
    *   **Why `useEffect`?** It's the idiomatic way in React to perform side effects that depend on component state or props.
    *   **Why `setTimeout`/`clearTimeout`?** This combination provides a robust debouncing mechanism. It ensures that the `geocodePincode` API is invoked only after the user has ceased typing for a specified duration (500ms). This drastically reduces the number of API calls, directly solving the "API hammering" problem.
    *   **Why 500ms?** This delay is a common heuristic, offering a good balance between user responsiveness (not too long to wait) and effective API call reduction.
    *   **Why `setValue` with `shouldValidate: true`?** When auto-populating city and state, we want these fields to also undergo their own form validation. This maintains data integrity and consistency across the entire form.
We considered using external debounce utility libraries (like Lodash's `debounce`), but the native `setTimeout`/`clearTimeout` approach within `useEffect` was deemed sufficient for this specific requirement, avoiding an additional dependency and keeping our bundle size optimized.

## How To Re-Implement (Contributor Reference)

To implement a similar debounced API call pattern for an input field in another part of the SahiDawa platform:

1.  **Identify Target Component and Input:** Locate the functional component and the specific form input (e.g., `pincode`) that requires debounced API interaction.
2.  **Update Form Schema:**
    *   Modify the `zod` schema (or equivalent) for the target field to include precise regex validation. For a 6-digit Indian pincode, use:
        ```typescript
        fieldName: z
            .string()
            .transform(sanitize) // Assuming a sanitize function exists
            .pipe(
                z
                    .string()
                    .regex(
                        /^[1-9][0-9]{5}$/,
                        "Enter a valid 6-digit Indian Pincode (cannot start with 0)"
                    )
            ),
        ```
3.  **Access Form Context:**
    *   Within the component, destructure `watch` and `setValue` from `useFormContext()`:
        ```typescript
        const { watch, setValue } = useFormContext<FormValues>();
        const fieldValue = watch("fieldName"); // e.g., watch("pincode")
        ```
4.  **Implement `useEffect`:**
    *   Create a `useEffect` hook with `fieldValue` and `setValue` as dependencies:
        ```typescript
        useEffect(() => {
            // ... implementation details ...
        }, [fieldValue, setValue]);
        ```
5.  **Add Immediate Input Validation (Regex Shielding):**
    *   Inside the `useEffect`, define the validation regex and add an early return:
        ```typescript
        const FIELD_REGEX = /^[1-9][0-9]{5}$/; // Adjust regex as needed
        if (!FIELD_REGEX.test(fieldValue)) {
            // Optional: Clear dependent fields if input becomes invalid
            // setValue("dependentField1", "");
            return;
        }
        ```
6.  **Set Up Debounce Timer:**
    *   Wrap your API call logic in a `setTimeout`:
        ```typescript
        const timer = setTimeout(async () => {
            // Your API call and state update logic here
        }, 500); // Adjust debounce delay as necessary
        ```
7.  **Perform API Call and Update Form State:**
    *   Inside the `setTimeout` callback, make your asynchronous API call.
    *   Use `setValue` to update other form fields based on the API response, ensuring to include `{ shouldValidate: true }` for auto-populated fields if validation is desired.
    *   Implement `try-catch` for robust error handling.
        ```typescript
        try {
            const apiResponse = (await yourApiFunction(fieldValue)) as any; // Cast if needed
            if (apiResponse) {
                setValue("dependentField1", apiResponse.data.field1, { shouldValidate: true });
                setValue("dependentField2", apiResponse.data.field2, { shouldValidate: true });
            }
        } catch (err) {
            console.error("API call for fieldName failed:", err);
        }
        ```
8.  **Add Cleanup Function:**
    *   Return a cleanup function from `useEffect` to clear the timer:
        ```typescript
        return () => clearTimeout(timer);
        ```

## Impact on System Architecture

This change primarily enhances the frontend's performance and user experience within the `ReportWizard` by optimizing how we interact with external geocoding services. By drastically reducing the number of redundant API calls, we alleviate unnecessary load on our backend infrastructure, contributing to improved system stability and resource utilization. This established pattern of debounced and validated API calls for user input sets a strong precedent for future frontend development across the SahiDawa platform, promoting efficient and responsible interaction with backend services. It directly improves the responsiveness and perceived speed of the application for users filling out reports, as they will experience smoother and more accurate auto-population without delays from premature or invalid geocoding attempts.

## Testing & Verification

The specific proof of work and detailed test cases are "Not documented in this PR". However, based on the implementation, we would verify the changes through the following:

**Functional Verification:**

1.  **Pincode Input Validation:**
    *   **Invalid Length:** Typing fewer than 6 digits (e.g., `123`) should immediately display the schema error message: "Enter a valid 6-digit Indian Pincode (cannot start with 0)".
    *   **Invalid Start Digit:** Typing 6 digits starting with '0' (e.g., `012345`) should immediately display the same schema error message.
    *   **Valid Format:** Typing a valid 6-digit pincode (e.g., `110001`) should clear any validation errors.
2.  **Debounce Mechanism:**
    *   **Rapid Typing:** Type a valid 6-digit pincode quickly (e.g., `110001`). Observe network requests in the browser's developer tools. Only one `geocodePincode` request should be initiated approximately 500ms after the last keystroke.
    *   **Typing and Deleting:** Type a valid pincode, then immediately backspace or change a digit before the 500ms debounce period elapses. The previous pending `geocodePincode` request should be cancelled, and a new timer should start for the modified input (if it remains valid).
    *   **Invalid to Valid:** Type an invalid pincode (e.g., `123`), then correct it to a valid one (e.g., `110001`). The API call should only trigger for `110001` after the debounce period.
3.  **Auto-population:**
    *   **Successful Geocoding:** Enter a known valid pincode (e.g., `110001` for Delhi). After the 500ms debounce, the "City" and "State" fields should automatically populate with the corresponding values (e.g., "Delhi" and "Delhi").
    *   **No Geocoding Data:** Enter a valid pincode for which the `geocodePincode` API is known to return no data or an empty response. Verify that the "City" and "State" fields remain empty or are cleared, and no errors are displayed to the user.
    *   **API Error:** Simulate an API error (e.g., network issue, server error). Verify that the application does not crash and that the error is logged to the console.

**Edge Cases:**
*   **Empty Pincode:** Ensure that an empty pincode field does not trigger any API calls.
*   **Rapid Focus Changes:** Verify that tabbing in and out of the pincode field rapidly does not cause unintended API calls.
*   **Component Unmount:** Ensure that if the `ReportWizard` component unmounts while a debounce timer is active, the timer is properly cleared to prevent memory leaks or errors.