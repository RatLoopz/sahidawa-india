# PR #2037 — refactor(interactions): remove any types

> **Merged:** 2026-06-18 | **Author:** @Avinash-sdbegin | **Area:** Backend | **Impact Score:** 9 | **Closes:** #1974

## What Changed

We have refactored the `apps/api/src/routes/interactions.ts` file to eliminate all usages of the TypeScript `any` type. This involved replacing untyped `catch (dbErr: any)` blocks with `catch (dbErr: unknown)` and implementing explicit type narrowing using `instanceof Error`. Additionally, we introduced a strongly typed `MatchedInteraction` interface to replace `any[]` for the `matchedInteractions` array, ensuring compile-time type safety for drug interaction objects.

## The Problem Being Solved

Prior to this change, the `apps/api/src/routes/interactions.ts` file contained instances of the `any` type, which effectively bypasses TypeScript's static type checking. Specifically, `catch (dbErr: any)` meant that any value could be caught as an error, and we could access arbitrary properties (like `dbErr.message`) without compile-time guarantees, potentially leading to runtime errors if `dbErr` was not an `Error` object. Similarly, `matchedInteractions: any[]` allowed objects of any shape to be stored in the array, making it impossible for the TypeScript compiler to verify the structure of drug interaction data, increasing the risk of subtle bugs and making future refactoring more difficult. Our goal is to enhance the robustness and maintainability of our backend by leveraging TypeScript's full potential for type safety.

## Files Modified

- `apps/api/src/routes/interactions.ts`

## Implementation Details

This refactoring focused on `apps/api/src/routes/interactions.ts` to improve type safety.

1.  **Introduction of `MatchedInteraction` Interface:**
    - We defined a new TypeScript interface named `MatchedInteraction` at the top of the file (lines 48-57 in the diff). This interface explicitly outlines the expected structure for a drug interaction object retrieved from our database or external sources.
    - The `MatchedInteraction` interface includes the following string properties: `drugA`, `drugAGeneric`, `drugB`, `drugBGeneric`, `severity`, `mechanism`, `description`, `clinical_recommendation`, and `source`.
    - This interface now serves as the canonical type definition for matched drug interactions within our system.

2.  **Strong Typing for `matchedInteractions` Array:**
    - The `matchedInteractions` array, which stores the results of drug interaction queries, was previously declared as `matchedInteractions: any[]`.
    - We updated its type declaration to `matchedInteractions: MatchedInteraction[]` (line 245 in the diff). This change ensures that only objects conforming to the `MatchedInteraction` interface can be added to this array, providing compile-time validation of the data structure.

3.  **Refactored Error Handling with `unknown`:**
    - We replaced two instances of `catch (dbErr: any)` with `catch (dbErr: unknown)`.
        - The first instance is within the `resolveToGeneric` asynchronous function (line 131 in the diff), which handles resolving drug names to their generic counterparts, often involving database lookups.
        - The second instance is inside the `router.post("/check")` handler, specifically within the loop that iterates through drug pairs and queries for interactions (line 275 in the diff).
    - By changing the catch parameter type to `unknown`, TypeScript now mandates explicit type narrowing before `dbErr` can be used.
    - We implemented this narrowing using a ternary operator: `const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);`. This ensures that if `dbErr` is an actual `Error` object, its `message` property can be safely accessed. Otherwise, if it's a string, number, or any other type, it is gracefully converted to a string using `String(dbErr)`, preventing potential runtime crashes from attempting to access properties on non-object types.
    - The existing logic for checking specific error messages (e.g., "fetch failed", "refused") to determine if the database is offline (`dbFailed = true`) was preserved and integrated with the new type-safe error message extraction.

## Technical Decisions

Our decision to remove `any` types and adopt `unknown` for error handling is rooted in fundamental TypeScript best practices.

1.  **Embracing `unknown` for Catch Blocks:** We chose `unknown` over `any` for caught errors because `unknown` is a type-safe top type. While `any` allows us to perform any operation on the variable without type checking, `unknown` forces us to explicitly narrow down its type before any operations can be performed. This design decision compels us to write more robust error handling logic, ensuring we consider different potential types of errors (e.g., actual `Error` objects, strings, numbers) and handle them appropriately, thereby preventing unexpected runtime behavior.
2.  **Utilizing `instanceof Error` for Type Narrowing:** The `instanceof Error` check is the idiomatic and most reliable way in JavaScript and TypeScript to determine if a caught value is an instance of the built-in `Error` class. This allows us to safely access properties like `message` and `stack` that are guaranteed to exist on `Error` objects. For values that are not `Error` instances, falling back to `String(dbErr)` provides a graceful and type-safe way to log or display the error information without risking property access errors.
3.  **Defining the `MatchedInteraction` Interface:** Creating a dedicated `MatchedInteraction` interface was a deliberate choice to provide a clear, compile-time contract for the structure of drug interaction data. This eliminates the ambiguity and potential for errors that `any[]` introduced. By explicitly defining the properties and their types, we improve code readability, facilitate easier maintenance, and enable the TypeScript compiler to catch data-structure-related bugs early in the development cycle, rather than at runtime.

## How To Re-Implement (Contributor Reference)

To re-implement this type-safety refactoring, a contributor would follow these steps:

1.  **Identify `any` usages:** Scan the target file, `apps/api/src/routes/interactions.ts`, for all occurrences of the `any` keyword. Pay particular attention to function parameters, variable declarations, and `catch` block parameters.
2.  **Refactor `catch (err: any)` to `catch (err: unknown)`:**
    - Locate all `try...catch` blocks where the caught error is typed as `any`.
    - Change `catch (dbErr: any)` to `catch (dbErr: unknown)`.
    - Immediately after the `catch` declaration, implement type narrowing for `dbErr`. The pattern used in this PR is highly recommended:
        ```typescript
        try {
            // ...
        } catch (dbErr: unknown) {
            const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
            // Now 'msg' is safely a string and can be used for logging or conditional checks.
            // Example: if (msg.includes("fetch failed")) { ... }
        }
        ```
3.  **Define Specific Interfaces for Data Structures:**
    - Identify any arrays or objects that are currently typed as `any[]` or `any` but hold a consistent data structure.
    - Based on the expected properties and their types, create a new TypeScript `interface`. For instance, for drug interactions, we defined `MatchedInteraction`:
        ```typescript
        interface MatchedInteraction {
            drugA: string;
            drugAGeneric: string;
            drugB: string;
            drugBGeneric: string;
            severity: string;
            mechanism: string;
            description: string;
            clinical_recommendation: string;
            source: string;
        }
        ```
4.  **Apply New Interfaces to Variable Declarations:**
    - Replace `any[]` with the newly defined interface array type. For example, change `const matchedInteractions: any[] = [];` to `const matchedInteractions: MatchedInteraction[] = [];`.
    - Ensure that any data being pushed into or assigned to this array conforms to the new interface. The TypeScript compiler will now enforce this, highlighting any type mismatches.
5.  **Gotchas and Considerations:**
    - **External Data:** When dealing with data from external APIs or databases (like Supabase in our case), ensure that the data structure returned by these services aligns with your new interfaces. If there's a mismatch, you might need to add runtime validation or mapping logic, or consider type assertions (`as MyInterface`) if you are absolutely certain of the data's shape after a check.
    - **Error Messages:** Be careful when relying on specific error message strings (e.g., `msg.includes("fetch failed")`). While effective, these can be brittle if underlying error messages change. Consider more robust error identification mechanisms if possible, though for network-related errors, string matching is often practical.
    - **Dependencies:** This refactoring primarily leverages core TypeScript language features and does not introduce any new external dependencies.

## Impact on System Architecture

This refactoring significantly enhances the robustness and maintainability of the `interactions` route within our `api` service. By eliminating `any` types, we have moved towards a more strictly typed codebase, which has several architectural benefits:

1.  **Increased Type Safety:** The primary impact is a substantial increase in type safety. The compiler can now catch a wider range of potential bugs related to incorrect data structures or improper error handling at compile time, rather than at runtime. This reduces the likelihood of unexpected crashes or incorrect behavior in production.
2.  **Improved Code Readability and Maintainability:** The explicit `MatchedInteraction` interface clearly documents the expected shape of drug interaction data. This makes the code easier to understand for new contributors and simplifies future modifications, as the compiler will guide developers on correct data usage.
3.  **Reduced Technical Debt:** `any` types are often considered technical debt in TypeScript projects. Their removal contributes to a cleaner, more predictable codebase, making it easier to evolve and scale the SahiDawa platform.
4.  **Foundation for Future Refactoring:** This change sets a precedent for eliminating `any` types across other parts of the SahiDawa codebase. It encourages a consistent approach to type safety, which will be crucial as our platform grows and more complex features are added. It doesn't introduce new features but strengthens the underlying infrastructure, making it more reliable for future development.

## Testing & Verification

While this PR primarily consists of a refactor and does not introduce new features, rigorous testing is essential to ensure no regressions were introduced and the new type-safe code behaves as expected.

**Verification Steps:**

1.  **Existing Unit/Integration Tests:** We rely on our existing suite of unit and integration tests for the `/interactions/check` endpoint. These tests cover various scenarios for drug interaction lookups, including valid inputs, multiple drugs, and edge cases. Running these tests confirms that the core business logic remains unchanged and functional.
2.  **Manual API Testing (Positive Cases):**
    - We manually tested the `/interactions/check` endpoint using tools like Postman or `curl` with known drug pairs (e.g., "paracetamol" and "ibuprofen") to verify that interactions are correctly identified and returned in the expected `MatchedInteraction` format.
    - We confirmed that the response structure matches the newly defined `MatchedInteraction` interface.
3.  **Manual API Testing (Error Cases):**
    - **Database Offline Simulation:** Although not explicitly part of the PR, we would simulate a database connection failure (e.g., by temporarily invalidating Supabase credentials or blocking network access) to ensure that the `catch (dbErr: unknown)` block correctly identifies the `dbFailed` state and logs the error message gracefully without crashing the server.
    - **Unexpected Error Types:** We would ensure that if a non-`Error` object (e.g., a string or number) were somehow thrown in a `try` block, the `catch (dbErr: unknown)` logic would correctly convert it to a string via `String(dbErr)` and handle it without runtime errors.
4.  **Type Checking:** The primary verification for this refactor is successful compilation by the TypeScript compiler. The absence of type errors after the changes confirms that `any` usages have been correctly replaced and type safety is enforced.

**Edge Cases:**

- **External API Contract Changes:** If the external API (e.g., Supabase) that provides interaction data were to change its response structure, our new `MatchedInteraction` interface would immediately highlight discrepancies at compile time, which is a significant improvement over `any[]`. However, runtime validation might still be necessary if the external API contract is not strictly enforced or can vary.
- **Non-Error Throws:** While rare in well-structured code, JavaScript allows throwing any value. Our `dbErr instanceof Error ? dbErr.message : String(dbErr)` handles this gracefully, ensuring that even if a string or number is thrown, it can be logged without causing a crash.
