# DevTrack: Feature - Typo-Tolerant Fuzzy Search for Medicine Names (#1076)

## Overview

This feature addresses Issue #1076 by introducing typo-tolerant medicine brand and generic name searching.

1. **Fuzzy Search API Endpoints:** Implemented the missing `/api/v1/scan/match` (fuzzy match scoring) and `/api/v1/scan/verify-brand` (brand-based lookup verification) routes on the Express API backend using an optimized Levenshtein distance string similarity score.
2. **Typo-Tolerant Search suggestions:** Integrated the backend fuzzy match fallback directly into the frontend global `SearchBar` component. If Supabase exact substring matches return sparse suggestions, the search bar automatically triggers fuzzy matching to provide typo-tolerant suggestions (e.g. `Paracetemol` -> `Paracetamol`).

---

## Detailed Changes

### 1. API Backend (`apps/api/src/routes/scan.ts`)

- Added a custom Levenshtein distance string similarity scoring algorithm in JavaScript.
- Registered a robust `POST /match` endpoint that takes a name query, pulls candidates from the `medicines` table, calculates similarity scores, and returns the top 3 matches having a score >= 50.
- Registered a `POST /verify-brand` endpoint that retrieves the complete database record for a matched medicine name to support subsequent scan verification steps.

### 2. Frontend Search Bar (`apps/web/app/[locale]/components/SearchBar.tsx`)

- Updated suggestions fetching logic to statically import and call `fuzzyMatchBrand()` from `@/lib/api`.
- Programmed a smart fallback: if exact/substring search returns fewer than 3 suggestions (indicating a potential spelling error or typo), it requests fuzzy matching suggestions from the backend API, deduplicates them, and populates the listbox smoothly under 100ms.
