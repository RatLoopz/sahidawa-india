# PR #3659 — fix: enforce schedule frequency and dose time consistency

> **Merged:** 2026-07-17 | **Author:** @Shreya-nipunge | **Area:** Backend | **Impact Score:** 9 | **Closes:** #3656

## What Changed

We introduced strict validation rules to ensure that a medicine schedule's `frequency` matches the number of unique dose times specified in the `times` array. This validation is enforced during both schedule creation (`POST`) and updates (`PUT`). For partial updates where only one of these fields is modified, our system now fetches the existing schedule from the database to validate the merged state before committing any changes.

## The Problem Being Solved

Before this PR, our API allowed inconsistent medicine schedules to be saved in the database. For example, a user could create a schedule with a `frequency` of 3 but provide only two dose times (e.g., `["08:00", "20:00"]`), or provide duplicate times (e.g., `["08:00", "08:00"]`). 

This inconsistency caused critical failures downstream. SahiDawa's notification engine and offline-first mobile synchronization rely on the exact alignment of the daily frequency count and the timing array to generate push notifications and adherence logs for rural patients. Furthermore, during partial updates (`PUT`), users could bypass validation by updating the `frequency` or `times` independently, leaving the record in an invalid state.

## Files Modified

- `apps/api/src/routes/medicineSchedules.ts`
- `apps/api/tests/medicineSchedules.test.ts`

## Implementation Details

### 1. Zod Schema Enhancements
We extracted and centralized the validation logic for schedule frequency and dose times in `apps/api/src/routes/medicineSchedules.ts`:

- **`validateFrequencyAndTimes`**: A custom validation helper that uses Zod's `RefinementCtx`. It checks for duplicate times by comparing the size of a `Set` of times against the array length. It then asserts that the `frequency` integer matches the count of unique dose times.
- **`frequencyTimesSchema`**: A reusable Zod object schema combining `frequency` and `times` with the `validateFrequencyAndTimes` refinement.
- **`createScheduleSchema`**: Updated to run the `validateFrequencyAndTimes` refinement on creation payloads.
- **`updateScheduleSchema`**: Updated to run a partial refinement. If both `frequency` and `times` are provided in the update payload, they are validated immediately.

### 2. Database-Backed Partial Update Validation
In the `PUT /:id` route handler, we implemented a state-merging validation flow:
- We determine if the update touches dates (`touchesDates`) or dose timings (`touchesDoseTiming`).
- If the update is partial (e.g., the request contains `frequency` but not `times`, or `start_date` but not `end_date`), we execute a single, consolidated Supabase query to fetch the existing schedule's `start_date`, `end_date`, `frequency`, and `times`.
- We construct the "effective" values by merging the incoming payload with the fetched database values (e.g., `parsed.data.times ?? existing?.times`).
- We validate the merged timing values using `frequencyTimesSchema.safeParse()`. If validation fails, we return a `400 Bad Request` with detailed field-level errors.

## Technical Decisions

- **Zod `superRefine` over `refine`**: We chose `superRefine` because it allows us to attach custom error issues directly to specific paths (e.g., `["times"]` or `["frequency"]`). This ensures that frontend clients receive precise, actionable error messages rather than a generic root-level validation error.
- **Consolidated Database Fetching**: To keep the API performant, we combined the database fetches for date validation and timing validation into a single Supabase query. This prevents redundant database round-trips when a user updates both a date and a timing field.
- **Fail-Fast Validation**: We perform all consistency checks *before* invoking the Supabase `.update()` operation, preventing unnecessary database writes and transaction overhead.

## How To Re-Implement (Contributor Reference)

If you need to implement similar multi-field consistency validations in other routes, follow this pattern:

1. **Define a Validation Helper**:
   ```typescript
   const validateFields = (data: { fieldA: type; fieldB: type }, ctx: z.RefinementCtx) => {
       if (/* condition fails */) {
           ctx.addIssue({
               code: "custom",
               path: ["fieldA"],
               message: "Your error message",
           });
       }
   };
   ```

2. **Apply to Schemas**:
   Use `.superRefine(validateFields)` on your creation schema. For update schemas, make the fields optional (`.partial()`) and apply the refinement conditionally only if both fields are present in the payload.

3. **Handle Partial Updates in the Controller**:
   - Detect if only one of the dependent fields is being updated.
   - Fetch the existing record's values from the database.
   - Merge the incoming payload with the database values:
     ```typescript
     const effectiveFieldA = incoming.fieldA ?? existing.fieldA;
     const effectiveFieldB = incoming.fieldB ?? existing.fieldB;
     ```
   - Run the merged object through your validation schema using `.safeParse()`.
   - Return a `400` status with the flattened errors if validation fails.

## Impact on System Architecture

- **Data Integrity**: This change guarantees that every medicine schedule stored in our database is structurally valid, preventing runtime errors in our notification workers and offline synchronization queues.
- **API Reliability**: Standardizes validation error payloads, allowing client applications to render inline form errors seamlessly.
- **No Database Migrations**: This validation is handled entirely in the application layer, avoiding the need for complex database constraints or migrations.

## Testing & Verification

We added comprehensive integration tests in `apps/api/tests/medicineSchedules.test.ts` using `supertest` to verify the new validation rules:

- **Creation Tests**:
  - Rejects `POST` requests where `frequency` does not match the number of unique dose times.
  - Rejects `POST` requests containing duplicate dose times (e.g., `["08:00", "08:00"]`).
- **Update Tests**:
  - Rejects `PUT` requests with inconsistent `frequency` and `times` in the same payload.
  - Rejects partial `PUT` requests (e.g., updating only `frequency`) that are inconsistent with the stored `times`.
  - Accepts partial `PUT` requests (e.g., updating only `times`) that remain consistent with the stored `frequency`.

All 38 tests in the medicine schedules suite passed successfully.