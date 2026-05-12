# PR #68 — Revert "test(api): add Supabase backend connection test"

> **Merged:** 2026-05-12 | **Author:** @dipexplorer | **Area:** Backend | **Impact Score:** 6

## What Changed

This pull request entirely removes the `apps/api/src/backend-test.ts` file from our codebase. This file previously contained a standalone TypeScript script designed to test the connection to our Supabase backend, including environment variable loading and a sample data fetch.

## The Problem Being Solved

This PR reverts a previous change (RatLoopz/sahidawa-india#66) that introduced a specific Supabase backend connection test. The explicit reason for reverting the original PR is not documented in this PR. However, the action implies that the presence of this specific test script was deemed unnecessary, temporary, or problematic for our `apps/api` module's testing strategy.

## Files Modified

- `apps/api/src/backend-test.ts` (deleted)

## Implementation Details

The implementation of this PR is a direct file deletion. The `apps/api/src/backend-test.ts` file, which was removed, previously contained the following logic:

1.  **Environment Variable Loading:** It utilized the `dotenv` library to load environment variables from a `.env` file into `process.env`.
2.  **Supabase Client Initialization:** It imported `createClient