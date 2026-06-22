# PR #2359 — fix(web): escape double quotes in calculator search to prevent PostgREST injection(closes #2201)

> **Merged:** 2026-06-22 | **Author:** @shauryavardhan1307 | **Area:** Frontend | **Impact Score:** 8 | **Closes:** #2201

## What Changed

We have implemented a critical security fix by integrating the `escapePostgrest` utility into the `searchMedicines` handler within the Medicine Calculator page (`apps/web/app/[locale]/calculator/page.tsx`). This change ensures that double quotes (`"`) in user-provided search queries are properly escaped to `""` before being used in Supabase's PostgREST `.or()` filter strings. A new JSDOM unit test (`apps/web/tests/calculator-search.test.tsx`) was added to specifically verify this escaping mechanism and prevent PostgREST injection vulnerabilities.

## The Problem Being Solved

Prior to this PR, the medicine search functionality on the Calculator page was vulnerable to PostgREST injection. If a user entered a search query containing unescaped double quotes, such as `Crocin" OR "Paracetamol`, the raw string passed to the Supabase `.or()` filter would be malformed. This could lead to broken queries, unexpected search results, or, in a worst-case scenario, allow an attacker to manipulate the database query to bypass intended search logic or extract sensitive information. The existing escaping for `[%_\\]` characters was insufficient for handling double quotes within the PostgREST string literal context, which requires doubling the quote character itself.

## Files Modified

- `apps/web/app/[locale]/calculator/page.tsx`
- `apps/web/tests/calculator-search.test.tsx`

## Implementation Details

The core of this implementation resides within the `searchMedicines` asynchronous function in `apps/web/app/[locale]/calculator/page.tsx`.
1.  **Import `escapePostgrest`:** We now import the `escapePostgrest` utility function from `@/lib/supabase/utils`. This utility is responsible for taking a raw string and escaping any double quotes by doubling them (e.g., `"` becomes `""`).
2.  **Apply Escaping:** Inside the `searchMedicines` function, after trimming the input `query` (assigned to `q`), we call `const escaped = escapePostgrest(q);`. This `escaped` string now contains the user's query with all double quotes safely handled according to PostgREST's string literal rules.
3.  **Construct Supabase Query:** The Supabase client call to `.from("medicines").select(...).or(...)` was modified. Previously, the `.or()` clause used `brand_name.ilike."${pattern}",generic_name.ilike."${pattern}"`. This has been updated to `brand_name.ilike."%${escaped}%",generic_name.ilike."%${escaped}%"`. The `escapePostgrest` function specifically handles the double quotes that delimit the string literals within the PostgREST `ilike` filter, ensuring the query remains valid and safe. The `%` wildcards are added around the `escaped` string to maintain the partial match search behavior.
4.  **New Test File:** A new JSDOM unit test file, `apps/web/tests/calculator-search.test.tsx`, was introduced. This test mocks the Supabase client to intercept the `.or()` call. It simulates a user typing a malicious query (`'Crocin" OR "Paracetamol'`) into the search input and then asserts that the argument passed to the mocked `.or()` function correctly contains the escaped string, specifically `brand_name.ilike."%Crocin"" OR ""Paracetamol%"` and `generic_name.ilike."%Crocin"" OR ""Paracetamol%"`. This verifies the `escapePostgrest` utility is correctly applied and the PostgREST query string is safely constructed.

## Technical Decisions

Our primary technical decision was to leverage a dedicated utility function, `escapePostgrest`, for handling string escaping specifically for PostgREST filters.
1.  **Utility Function Approach:** Instead of inlining the escaping logic directly in `searchMedicines`, we opted for `escapePostgrest` from `@/lib/supabase/utils`. This promotes code reusability, centralizes the escaping logic, and makes it easier to maintain and test. It also ensures consistency across any future parts of the application that might construct raw PostgREST queries, reducing the surface area for similar vulnerabilities.
2.  **Targeted Escaping:** The previous escaping `q.replace(/[%_\\]/g, "\\$&")` was specific to SQL `LIKE` patterns and did not address the issue of double quotes breaking the PostgREST string literal itself. By introducing `escapePostgrest`, we specifically target the PostgREST string literal escaping rules, which require doubling double quotes. This precise approach ensures we fix the specific vulnerability without over-escaping or introducing unintended side effects.
3.  **JSDOM Testing:** We chose JSDOM for the new unit test because it allows us to simulate browser interactions (like typing into an input) and verify the client-side logic that constructs the Supabase query. Mocking the Supabase client was crucial to inspect the exact arguments passed to the database functions without making actual network requests, ensuring the test is fast, isolated, and focused solely on the escaping logic.

## How To Re-Implement (Contributor Reference)

To re-implement this feature from scratch, a contributor would follow these steps:

1.  **Identify Vulnerable Query Points:** Locate any frontend code that constructs raw PostgREST filter strings, especially those using `.or()`, `.eq()`, `.ilike()`, etc., where user input is directly interpolated into the filter string. In this case, it was the `searchMedicines` function in `apps/web/app/[locale]/calculator/page.tsx`.
2.  **Create/Utilize Escaping Utility:**
    *   Ensure an `escapePostgrest` utility exists, typically in `lib/supabase/utils.ts` or a similar shared utility location.
    *   The core logic of this utility should be to replace all occurrences of `"` with `""`. A simple implementation might look like:
        ```typescript
        // lib/supabase/utils.ts
        export function escapePostgrest(value: string): string {
            return value.replace(/"/g, '""');
        }
        ```
3.  **Integrate Escaping into Query Handler:**
    *   Import the `escapePostgrest` function into the relevant file (e.g., `apps/web/app/[locale]/calculator/page.tsx`):
        ```typescript
        import { escapePostgrest } from "@/lib/supabase/utils";
        ```
    *   Before constructing the Supabase query, apply the escaping to the user's input. For the `searchMedicines` function:
        ```typescript
        async function searchMedicines(query: string): Promise<Medicine[]> {
            const q = query.trim();
            if (q.length < 2) return [];

            const escaped = escapePostgrest(q); // Apply escaping here

            const { data, error } = await supabase
                .from("medicines")
                .select(
                    "id, brand_name, generic_name, manufacturer, mrp, jan_aushadhi_price, composition, cdsco_approval_status"
                )
                .or(`brand_name.ilike."%${escaped}%",generic_name.ilike."%${escaped}%"`) // Use the escaped string
                .limit(20);
            // ... rest of the function
        }
        ```
4.  **Add Comprehensive Unit Tests:**
    *   Create a new test file (e.g., `apps/web/tests/calculator-search.test.tsx`).
    *   Set up a `jest-environment jsdom` to simulate a browser environment if UI interaction is involved.
    *   Mock the Supabase client to intercept database calls. For instance, to mock `.or()` and related methods:
        ```typescript
        jest.mock("@/lib/supabase", () => {
            const mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });
            const mockOr = jest.fn().mockReturnValue({ limit: mockLimit });
            const mockSelect = jest.fn().mockReturnValue({ or: mockOr });
            const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });
            return {
                supabase: {
                    from: mockFrom,
                    _mockOr: mockOr, // Expose for assertion
                },
            };
        });
        ```
    *   Render the component under test (e.g., `<CalculatorPage />`).
    *   Simulate user input with a problematic string (e.g., `'Crocin" OR "Paracetamol'`) using `fireEvent.change` on the relevant input element.
    *   Use `waitFor` to ensure debounced functions or asynchronous operations complete before assertions.
    *   Assert that the mocked Supabase function (`_mockOr` in this case) was called with the correctly escaped string. The assertion should check for `""` where `"` was originally present, verifying the PostgREST query string is safely constructed.

## Impact on System Architecture

This change primarily strengthens the security posture of our frontend application by mitigating a class of PostgREST injection vulnerabilities. It establishes a clear pattern for handling user input when constructing raw Supabase query strings, promoting safer development practices. While the immediate impact is localized to the Medicine Calculator search, the `escapePostgrest` utility is now a reusable component in `@/lib/supabase/utils`, which can be readily adopted by other parts of the system that interact with Supabase via raw filters. This reduces the likelihood of similar vulnerabilities appearing in new features and standardizes our approach to Supabase query construction, making our system more robust and secure against malicious input.

## Testing & Verification

This change was thoroughly tested through a newly introduced JSDOM unit test in `apps/web/tests/calculator-search.test.tsx`.

**Test Scenario:**
The test simulates a user searching for `'Crocin" OR "Paracetamol'` in the medicine calculator's search input.

**Verification Steps:**
1.  The test renders the `CalculatorPage` component within a JSDOM environment.
2.  It uses `@testing-library/react`'s `fireEvent.change` to simulate typing the problematic query into the search `combobox` element.
3.  It then uses `waitFor` to allow for the debounced search function (typically 300ms in `MedicineSearchSelect`) to execute and trigger the Supabase client call.
4.  Crucially, the test mocks the Supabase client (`@/lib/supabase`) to intercept the `supabase.from("medicines").select(...).or(...)` call without making actual network requests.
5.  It asserts that the `_mockOr` function (our exposed mock for the `.or()` method) was called.
6.  Finally, it verifies the exact argument passed to `_mockOr`. The assertions `expect(callArg).toContain('brand_name.ilike."%Crocin"" OR ""Paracetamol%"');` and `expect(callArg).toContain('generic_name.ilike."%Crocin"" OR ""Paracetamol%"');` confirm that the double quotes in the original query were correctly escaped to `""` within the PostgREST filter string, effectively preventing injection and ensuring the query remains syntactically valid.

**Edge Cases:**
*   **Empty Query:** Handled by the existing `if (q.length < 2) return [];` check before escaping is applied.
*   **Query with no double quotes:** The `escapePostgrest` function will simply return the original string, having no adverse effect on valid queries.
*   **Query with only double quotes:** E.g., `""`. This would be escaped to `""""`, which is a valid (though likely empty-matching) PostgREST string literal.
*   **Other special characters:** The `escapePostgrest` utility specifically targets double quotes, which are critical for PostgREST string literal integrity. Other characters like `%`, `_`, `\` are handled by the `ilike` operator's own pattern matching rules, but the primary vulnerability addressed here was the breaking of the string literal itself by unescaped double quotes.