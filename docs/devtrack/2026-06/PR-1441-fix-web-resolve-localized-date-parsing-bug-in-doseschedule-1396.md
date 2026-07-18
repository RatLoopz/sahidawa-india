# PR #1441 — fix(web): resolve localized date parsing bug in DoseSchedule (#1396)

> **Merged:** 2026-06-07 | **Author:** @shauryavardhan1307 | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #1396

## What Changed

This PR refactors the `DoseSchedule.tsx` component to handle dates as raw JavaScript `Date` objects internally, rather than localized strings. Specifically, the `calculateMilestoneDate` function now returns a `Date | null`, and the `getDoseStatus` function now accepts a `Date | null` as input. Date formatting to the `"en-IN"` locale is now performed explicitly at the point of rendering within the TSX, ensuring consistent date parsing and display.

## The Problem Being Solved

Prior to this change, our system was susceptible to a common date parsing bug where a date string, previously formatted using `toLocaleDateString("en-IN", ...)`, would be re-parsed by `new Date()` in the `getDoseStatus` function. This re-parsing could lead to `Invalid Date` errors on certain browser engines or user locales that might not correctly interpret the `"en-IN"` formatted string (e.g., "Jun 7, 2026"). This inconsistency in parsing localized date strings across different environments caused incorrect dose status calculations and display issues for users.

## Files Modified

- `apps/web/components/vaccine/DoseSchedule.tsx`

## Implementation Details

The core of this change lies in standardizing the internal representation of dates within the `DoseSchedule` component to raw `Date` objects.

1.  **`calculateMilestoneDate` Function:**
    - The return type of `calculateMilestoneDate` was updated from `string | null` to `Date | null`.
    - The function now returns the `targetDate` as a raw `Date` object directly, after calculating it based on `initialDate` and `weeksOffset`.
    - The call to `targetDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })` was removed from this function.

2.  **`getDoseStatus` Function:**
    - The parameter `dateString: string | null` was changed to `doseDate: Date | null`.
    - The line `const doseDate = new Date(dateString);` was removed, as the function now directly receives a `Date` object.
    - A new local variable `targetDate` was introduced (`const targetDate = new Date(doseDate.getTime());`) to create a copy of the input `doseDate` before modifying its hours, minutes, seconds, and milliseconds to ensure comparisons are purely date-based and avoid mutating the original `doseDate` object.
    - The comparison logic (`targetDate.getTime() === today.getTime()` and `targetDate.getTime() < today.getTime()`) remains the same but now operates consistently on `Date` objects.

3.  **JSX Rendering Logic:**
    - The variable `dateString` used in the component's JSX was renamed to `milestoneDate` to reflect its new type (`Date | null`).
    - The `calculateMilestoneDate(weeks)` function call now correctly assigns a `Date` object to `milestoneDate`.
    - Within the rendering block for each dose, the `toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })` method is now called directly on `milestoneDate` only when the date needs to be displayed to the user. This ensures that localization happens precisely at the presentation layer.

## Technical Decisions

Our primary technical decision was to strictly separate the concerns of date calculation/comparison from date formatting.

1.  **Using Raw `Date` Objects for Internal Logic:** We chose to pass and operate on raw `Date` objects within our JavaScript/TypeScript logic (`calculateMilestoneDate`, `getDoseStatus`). This is a robust pattern because `Date` objects provide unambiguous, engine-agnostic representations of dates and times. This eliminates the need for error-prone string parsing and ensures that date comparisons and arithmetic are consistent across all user environments.
2.  **Localizing at Render Time:** By moving the `toLocaleDateString()` call directly into the TSX rendering logic, we ensure that date formatting is a presentation-layer concern. This means the internal logic deals with the canonical `Date` object, and only when a human-readable string is required for display is the localization applied. This prevents the "round-trip" issue of formatting a date to a string and then attempting to re-parse that string, which was the root cause of the `Invalid Date` bug.
3.  **Targeting `"en-IN"` Locale:** The specific locale `"en-IN"` is critical for SahiDawa, as it ensures that dates are displayed in a format familiar and expected by our primary user base in India. This decision aligns with our platform's mission to serve Indian communities.

## How To Re-Implement (Contributor Reference)

To re-implement this pattern for date handling in other parts of our frontend:

1.  **Identify Date-Dependent Logic:** Locate any functions or components that perform date calculations, comparisons, or store dates.
2.  **Standardize to `Date` Objects:** Ensure that these functions consistently accept and return raw JavaScript `Date` objects. Avoid passing date strings between functions for internal logic.
    - _Example:_ If a function calculates a future date, it should return `new Date(...)`, not `new Date(...).toLocaleDateString(...)`.
3.  **Separate Formatting:** Only convert a `Date` object to a localized string at the very last moment, when it needs to be displayed in the UI.
    - _Code Pattern:_

        ```typescript
        // Internal logic: operates on Date objects
        const calculatedDate: Date | null = calculateSomeDate(inputDate);

        // ... later, in the JSX or a display utility ...
        {calculatedDate ? (
            <span>
                {calculatedDate.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                })}
            </span>
        ) : (
            <span>N/A</span>
        )}
        ```

4.  **Handle `null` or `undefined` Dates:** Always check for `null` or `undefined` before attempting to call methods on a `Date` object, as seen with `if (milestoneDate)`.
5.  **Avoid Mutation:** When comparing or manipulating `Date` objects, especially when setting hours/minutes/seconds to zero for day-only comparisons, create a copy of the `Date` object first (e.g., `const copyDate = new Date(originalDate.getTime());`) to prevent unintended side effects on the original object.

## Impact on System Architecture

This change reinforces a critical architectural principle for our frontend: data integrity and consistency. By ensuring that dates are handled as native `Date` objects within our application logic, we enhance the robustness and reliability of all date-dependent features. This pattern reduces the likelihood of locale-specific parsing errors, making our application more resilient across different user environments and browser engines. It sets a clear precedent for how date and time information should be managed in future SahiDawa frontend development, promoting a cleaner separation of concerns between business logic and presentation. This approach will simplify debugging and maintenance of date-related features moving forward.

## Testing & Verification

This change was thoroughly verified through existing unit tests. The proof of work included logs demonstrating that all 8 unit tests in `tests/DoseSchedule.test.tsx` passed successfully. These tests cover various scenarios, including:

- `calculates dates correctly`: Ensures the `calculateMilestoneDate` function correctly computes future dates based on offsets.
- `marks past doses as scheduled`: Verifies the `getDoseStatus` logic correctly identifies past dates.
- `shows pending state when no date is selected`: Confirms the handling of `null` or missing initial dates.
- `handles relative to birth vaccines correctly` and `handles relative to first dose vaccines correctly`: Validates the logic for different vaccine scheduling types.

The passing tests confirm that the refactoring to use raw `Date` objects internally and localize at render time did not introduce regressions and correctly resolved the underlying date parsing bug.
