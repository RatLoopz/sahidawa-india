# PR #3563 — Perf : PapaParse accumulates massive arrays in memory during Bulk Upload#3546

> **Merged:** 2026-07-13 | **Author:** @hrx01-dev | **Area:** Backend | **Impact Score:** 9 | **Closes:** #3546

## What Changed

We modified the `parseCsvIncremental` function in `apps/api/src/routes/pharmacies.ts` to improve performance by batching CSV insertions every 500 rows, pausing the parser during database queries, and freeing up heap memory after each batch insertion. This change addresses the issue of PapaParse accumulating massive arrays in memory during bulk uploads, which previously led to performance issues.

## The Problem Being Solved

Before this PR, our system was prone to memory issues when handling large CSV files for bulk uploads. The `parseCsvIncremental` function would accumulate all rows in memory before inserting them into the database, leading to performance degradation and potential crashes. This was inefficient and limited our system's ability to handle large-scale uploads.

## Files Modified

- `apps/api/src/routes/pharmacies.ts`

## Implementation Details

The `parseCsvIncremental` function now utilizes a batching mechanism, where rows are inserted into the database in batches of 500. This is achieved by checking the length of the `rowsToInsert` array and pausing the parser using `parser.pause()` when the batch size is reached. The batch is then inserted into the database, and the `rowsToInsert` array is cleared to free up memory. After the database query completes, the parser is resumed using `parser.resume()`. If an error occurs during insertion, the parser is aborted using `parser.abort()`, and an error message is returned. The function also handles straggler rows by inserting any remaining rows in the `rowsToInsert` array after the parser has finished processing the CSV file.

## Technical Decisions

We chose to use a batch size of 500 rows based on a balance between performance and memory usage. A larger batch size would improve performance but increase memory usage, while a smaller batch size would reduce memory usage but decrease performance. We also decided to use the `parser.pause()` and `parser.resume()` methods to control the parser's execution, allowing us to efficiently handle large CSV files. Additionally, we utilized the `supabase` library to interact with the database, taking advantage of its support for bulk insertions.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, follow these steps:
1. Modify the `parseCsvIncremental` function to utilize a batching mechanism, where rows are inserted into the database in batches of 500.
2. Use the `parser.pause()` and `parser.resume()` methods to control the parser's execution, allowing for efficient handling of large CSV files.
3. Clear the `rowsToInsert` array after each batch insertion to free up memory.
4. Handle straggler rows by inserting any remaining rows in the `rowsToInsert` array after the parser has finished processing the CSV file.
5. Utilize the `supabase` library to interact with the database, taking advantage of its support for bulk insertions.

## Impact on System Architecture

This change improves the overall performance and scalability of our system, allowing it to handle large-scale bulk uploads without significant memory issues. It also sets a precedent for efficient data processing and memory management, which can be applied to other areas of the system. By addressing this performance bottleneck, we unlock the potential for future development and expansion of our system's capabilities.

## Testing & Verification

This change was tested by uploading large CSV files and verifying that the system can handle them without significant performance degradation or memory issues. We also tested error scenarios, such as inserting rows with invalid data, to ensure that the system correctly handles and reports errors. Additionally, we verified that the batching mechanism correctly handles straggler rows and that the `rowsToInsert` array is properly cleared after each batch insertion.