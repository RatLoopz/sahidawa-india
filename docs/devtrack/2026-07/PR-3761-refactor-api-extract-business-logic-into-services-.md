# PR #3761 — refactor(api): extract business logic into services and repositories

> **Merged:** 2026-07-20 | **Author:** @Avinash-sdbegin | **Area:** Backend | **Impact Score:** 52 | **Closes:** #3681

## What Changed

This PR refactors the `pharmacies.ts` and `scan.ts` files by extracting business logic into dedicated service and repository layers. New files `pharmacy.service.ts`, `scan.service.ts`, `pharmacy.repository.ts`, `scan.repository.ts`, and `redis.repository.ts` have been added to encapsulate the logic. The route handlers in `pharmacies.ts` and `scan.ts` have been simplified to focus on HTTP request/response handling, while the business logic has been moved to the respective services and repositories.

## The Problem Being Solved

Before this PR, the business logic was tightly coupled with the route handlers, making the code harder to maintain and understand. This refactor aims to separate concerns, improve code readability, and make it easier to test and extend the functionality.

## Files Modified

- `apps/api/src/repositories/pharmacy.repository.ts`
- `apps/api/src/repositories/redis.repository.ts`
- `apps/api/src/repositories/scan.repository.ts`
- `apps/api/src/routes/pharmacies.ts`
- `apps/api/src/routes/scan.ts`
- `apps/api/src/services/pharmacy.service.ts`
- `apps/api/src/services/scan.service.ts`

## Implementation Details

The `pharmacy.repository.ts` file contains functions for interacting with the `pharmacies` table, such as `findByLicenseId`, `insertPharmacy`, and `updatePharmacy`. The `scan.repository.ts` file contains functions for searching medicines, such as `searchMedicinesByWords` and `findMedicineByMatchedName`. The `pharmacy.service.ts` file contains functions that orchestrate the business logic, such as `registerPharmacy`. The `redis.repository.ts` file contains functions for interacting with Redis, such as `get` and `set`.

The `pharmacies.ts` file has been updated to use the new `pharmacyService` and `pharmacyRepository` to handle pharmacy-related logic. The `scan.ts` file has been updated to use the new `scanRepository` to handle scan-related logic.

Key functions and classes used include:

* `supabase` from `@supabase/supabase-js` for interacting with the database
* `redisClient` from `redis` for interacting with Redis
* `zod` for validation
* `multer` for handling file uploads

## Technical Decisions

The decision to extract business logic into services and repositories was made to improve code maintainability, readability, and testability. This approach allows for a clear separation of concerns and makes it easier to modify or extend the functionality without affecting other parts of the codebase.

The choice of using `supabase` and `redisClient` was made due to their simplicity and ease of use. `zod` was chosen for validation due to its robustness and flexibility. `multer` was chosen for handling file uploads due to its popularity and ease of use.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, follow these steps:

1. Create a new file for the repository, e.g., `pharmacy.repository.ts`.
2. Define functions for interacting with the database, e.g., `findByLicenseId`, `insertPharmacy`, and `updatePharmacy`.
3. Create a new file for the service, e.g., `pharmacy.service.ts`.
4. Define functions that orchestrate the business logic, e.g., `registerPharmacy`.
5. Update the route handlers to use the new service and repository.
6. Test the functionality using a testing framework, e.g., Jest.

Gotchas:

* Make sure to handle errors properly and log them for debugging purposes.
* Use validation to ensure that the data is correct and consistent.
* Use caching to improve performance, if necessary.

## Impact on System Architecture

This refactor improves the overall system architecture by separating concerns and making the code more modular. It allows for easier maintenance, testing, and extension of the functionality. The new services and repositories can be reused in other parts of the codebase, reducing code duplication and improving consistency.

## Testing & Verification

The functionality has been tested by ensuring that the project builds successfully after refactoring and all imports resolve correctly. No UI changes were introduced, and the API behavior remains the same. Additional testing can be done using a testing framework, e.g., Jest, to ensure that the functionality works as expected. Edge cases, such as error handling and validation, should be tested thoroughly to ensure that the system behaves correctly in all scenarios.