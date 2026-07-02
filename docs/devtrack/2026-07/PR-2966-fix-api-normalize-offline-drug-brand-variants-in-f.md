# PR #2966 — fix(api): normalize offline drug brand variants in fallback lookup

> **Merged:** 2026-07-02 | **Author:** @sureshsuriya | **Area:** Backend | **Impact Score:** 9 | **Closes:** #2816

## What Changed

We introduced a brand name normalization helper function (`normalizeOfflineBrandName`) in our API's interaction route to sanitize user inputs before querying our static offline fallback map. This helper strips out common dosage numbers (such as 500, 650), units (mg), and non-alphanumeric separators (spaces, hyphens, commas, periods) from user-submitted drug names. We then updated our offline fallback resolver (`resolveToGeneric`) to use this normalized string when querying our static `localBrandMap`, ensuring that common Indian drug variants like "Crocin 650" or "Dolo-650" map correctly to their generic equivalent ("paracetamol") when the database is offline.

## The Problem Being Solved

In rural Indian health contexts, internet connectivity is highly unstable, forcing our system to frequently fall back to an offline static database (`localBrandMap`) to check for drug-drug interactions. Previously, the offline fallback resolver only performed a basic lowercase conversion and stripped spaces (`lowerInput.replace(/\s+/g, "")`). This meant that if a user entered "Crocin 650", "Dolo-650", or "Calpol 500mg", the lookup key became `crocin650`, `dolo-650`, or `calpol500mg`. Because our static dictionary maps clean, generic-adjacent brand names (like `crocin`, `dolo`, `calpol`) to their generic counterparts (e.g., `paracetamol`), these lookup attempts failed. This resulted in unresolved generic names, preventing critical interaction checks from executing and leaving rural healthcare workers without safety warnings.

## Files Modified

- `apps/api/src/routes/interactions.ts`
- `apps/api/tests/interactions.test.ts`

## Implementation Details

### 1. Normalization Helper Function
We added the `normalizeOfflineBrandName` function to `apps/api/src/routes/interactions.ts`:
```typescript
function normalizeOfflineBrandName(input: string): string {
    return input
        .toLowerCase()
        .replace(/\b(500|650|500mg|650mg|mg)\b/g, "")
        .replace(/[\s\-_,.]+/g, "");
}
```
This function performs two primary transformations:
- It uses a word-boundary regex `\b(500|650|500mg|650mg|mg)\b` to strip out common dosages and units without accidentally corrupting brand names that might contain these character sequences internally.
- It uses the character class regex `[\s\-_,.]+` to strip out all whitespaces, hyphens, underscores, commas, and periods, leaving a clean, continuous alphanumeric string.

### 2. Fallback Resolution Integration
Inside `resolveToGeneric(input: string)`, we modified the offline fallback block (triggered when `dbFailed` is true):
```typescript
if (dbFailed) {
    // Fallback to local static map
    const normalizedForOffline = normalizeOfflineBrandName(input);
    const mapped = localBrandMap[normalizedForOffline];
    if (mapped) {
        genericName = mapped;
    }
}
```
This replaces the old lookup logic which relied on `lowerInput.replace(/\s+/g, "")`.

### 3. Cache Warming Code Quality
We also refactored the formatting of `warmInteractionCache()` and its associated `setInterval` to adhere to clean code standards and prevent unhandled promise rejections by explicitly marking the interval callback with `void warmInteractionCache()`.

## Technical Decisions

### Regex-based Normalization
We chose a lightweight, regex-based normalization approach over a heavy NLP or fuzzy-matching library because the API must remain highly performant and run efficiently in resource-constrained environments. 

### Targeted Dosage Stripping
We explicitly targeted common dosages like `500`, `650`, and `mg` because these represent the vast majority of user input variations for common over-the-counter and prescription drugs in India (e.g., Crocin, Dolo, Calpol).

### Preserving Online Behavior
We deliberately kept the online database lookup behavior untouched. The Supabase database has its own robust text search and mapping capabilities; this regex normalization is strictly a safety net for our static offline fallback map.

## How To Re-Implement (Contributor Reference)

If you need to implement or extend this brand normalization logic in another service, follow these steps:

1. **Define the Normalizer:** Create a utility function that sanitizes input strings by converting them to lowercase, stripping out numeric dosages (e.g., `500`, `650`), units (`mg`), and punctuation/whitespace characters.
2. **Locate the Offline Fallback Block:** Find the generic name resolution logic (typically triggered when the primary database connection fails).
3. **Apply Normalization:** Pass the raw user input through the normalization function before attempting to look up the key in the static brand-to-generic mapping dictionary (`localBrandMap`).
4. **Handle Fallbacks Gracefully:** Ensure that if the lookup succeeds, the mapped generic name is returned; otherwise, fall back gracefully to the original input.
5. **Write Integration Tests:** Mock a database failure (e.g., `dbConfig.isSupabaseOffline = true`) and verify that inputs containing dosages and hyphens (e.g., "Dolo-650") successfully resolve to their generic counterparts (e.g., "paracetamol") and trigger the correct interaction warnings.

## Impact on System Architecture

This change significantly hardens our offline-first capability. By ensuring that brand name variations resolve correctly without database access, we guarantee that critical drug-drug interaction warnings remain functional even in deep offline mode. It decouples the user's input formatting from the static dictionary keys, making our offline fallback layer far more resilient to real-world user input patterns.

## Testing & Verification

We added regression tests in `apps/api/tests/interactions.test.ts` under the `POST /api/v1/interactions/check` suite.

The tests mock an offline state by setting `dbConfig.isSupabaseOffline = true` and verify that inputs like `["Crocin 650", "Coumadin"]`, `["Dolo-650", "Warfarin"]`, and `["Calpol 500mg", "Warfarin"]` successfully resolve to `paracetamol` and `warfarin`, triggering a "serious" interaction warning.

All 7 tests in the interaction suite passed successfully:
```text
PASS apps/api/tests/interactions.test.ts

Tests: 7 passed, 7 total
```