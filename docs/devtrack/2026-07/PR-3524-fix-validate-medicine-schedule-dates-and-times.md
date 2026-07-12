# PR #3524 — fix: validate medicine schedule dates and times

> **Merged:** 2026-07-12 | **Author:** @mayurigade-hub | **Area:** Backend | **Impact Score:** 9 | **Closes:** #3521

## What Changed

We introduced strict calendar date and 24-hour time validation to our medicine scheduling API. By leveraging Zod's `.refine()` method alongside custom date and time parsing helper functions, we now reject impossible calendar dates (such as February 31st), invalid 24-hour times (such as 99:99 or 24:00), and inverted date ranges where the `end_date` precedes the `start_date`.

## The Problem Being Solved

Previously, our medicine scheduling API only validated the format of date and time strings using basic regular expressions (e.g., matching `^\d{4}-\d{2}-\d{2}$` and `^\d{2}:\d{2}$`). This allowed logically impossible inputs like `2026-02-31` or `99:99` to pass validation and be persisted in our Supabase database. 

This resulted in corrupt reminder data, broken cron jobs, and silent failures when calculating medicine adherence metrics for rural patients. Furthermore, users could set an `end_date` that occurred before the `start_date`, causing infinite loops or logical errors in our scheduling engine.

## Files Modified

- `apps/api/src/routes/medicineSchedules.ts`
- `apps/api/tests/medicineSchedules.test.ts`

## Implementation Details

### Custom Validation Helpers
We implemented two core helper functions to handle semantic validation beyond regex matching:
1. **`isRealDateString(value: string): boolean`**: Extracts the year, month, and day from a `YYYY-MM-DD` string. It constructs a UTC date using `Date.UTC(year, month - 1, day)` and reads the parts back out. If JavaScript's automatic date rollover changes the values (e.g., `2026-02-31` rolls over to March 3rd), the function detects the mismatch and returns `false`.
2. **`isRealTimeString(value: string): boolean`**: Extracts hours and minutes from an `HH:MM` string and ensures that hours are between `0` and `23` and minutes are between `0` and `59`.

### Schema Refactoring
We refactored our Zod validation schemas to incorporate these helpers:
- **`dateStringSchema`**: Validates the `YYYY-MM-DD` format via regex and refines it using `isRealDateString`.
- **`timeStringSchema`**: Validates the `HH:MM` format via regex and refines it using `isRealTimeString`.
- **`createScheduleObjectSchema`**: Replaces raw regex validations with `dateStringSchema` and `timeStringSchema` for `times`, `start_date`, and `end_date`.
- **`createScheduleSchema`**: Extends `createScheduleObjectSchema` with a refinement ensuring `end_date >= start_date`.
- **`updateScheduleSchema`**: Extends the partial version of `createScheduleObjectSchema` with a refinement ensuring that if both dates are provided, `end_date >= start_date`.

### Partial Update Handling in PUT Route
In the `PUT /:id` route, we handle partial updates where a user might update only `start_date` or only `end_date`. Since a schema-level validation cannot access the database to compare against the unmodified date, we added a database lookup:
- If either `start_date` or `end_date` is provided in the payload, we fetch the existing schedule from Supabase.
- We merge the incoming update with the existing database values to establish the `effectiveStartDate` and `effectiveEndDate`.
- If the resulting range is inverted (`effectiveEndDate < effectiveStartDate`), we reject the request with a `400 Bad Request` status code.

## Technical Decisions

- **Native JS Date Rollover Check**: We chose to use native `Date.UTC` validation rather than importing a heavy external library like `moment` or `date-fns`. This keeps our API bundle lightweight and highly performant, which is critical for our resource-constrained deployment environments.
- **Database-Backed Validation on PUT**: We decided to perform a database fetch during partial updates rather than forcing clients to always send both `start_date` and `end_date`. This preserves the flexibility of our REST API while guaranteeing strict logical consistency.

## How To Re-Implement (Contributor Reference)

If you need to implement similar date/time validation in another route (e.g., vaccinations or doctor appointments):

1. **Import or define the validation schemas**:
   ```typescript
   const dateStringSchema = z
       .string()
       .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
       .refine(isRealDateString, { message: "Date must be a real calendar date" });
   ```
2. **Apply range validation**:
   Always use `.refine()` on the parent object schema when validating dependent fields:
   ```typescript
   const rangeSchema = z.object({
       start_date: dateStringSchema,
       end_date: dateStringSchema.nullable().optional()
   }).refine(data => !data.end_date || data.end_date >= data.start_date, {
       message: "end_date must not be before start_date",
       path: ["end_date"]
   });
   ```
3. **Handle partial updates**:
   When writing `PUT` or `PATCH` handlers, do not rely solely on Zod for range validation if the fields are optional. You must fetch the existing record from the database, merge the fields, and perform the logical check manually before executing the update query.

## Impact on System Architecture

- **Data Integrity**: This change prevents corrupt date and time values from entering our Supabase database, ensuring that downstream notification workers and SMS reminder systems can safely parse dates without encountering runtime exceptions.
- **API Reliability**: By failing fast at the API boundary, we reduce the risk of silent failures in our scheduling engine, leading to more predictable behavior for our rural health workers and patients.

## Testing & Verification

We added comprehensive integration tests in `apps/api/tests/medicineSchedules.test.ts` using `supertest` to verify the new validation rules:
- **Invalid Times**: Verifies that requests with times like `99:99` or `24:00` are rejected with a `400` status code.
- **Invalid Dates**: Verifies that impossible calendar dates like `2026-02-31` are rejected for both `start_date` and `end_date`.
- **Inverted Ranges**: Verifies that requests where `end_date` is earlier than `start_date` are rejected.
- **Valid Ranges**: Verifies that requests where `end_date` equals `start_date` are successfully accepted with a `201` status code.
- **Partial Updates**: Verifies that partial updates via `PUT` are validated against existing database values.