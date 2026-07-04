# PR #3186 — Refactor/unify shared constants

> **Merged:** 2026-07-04 | **Author:** @ANISHA-RAWAT | **Area:** Frontend | **Impact Score:** 69

## What Changed

We bootstrapped the `@sahidawa/shared` package within our monorepo workspace to centralize shared configurations and constants. We migrated key numeric limits—specifically `MAX_INTERACTION_MEDICINES` and `MAX_BULK_UPLOAD_ITEMS`—out of duplicated local declarations in `apps/web` and `apps/api` and into this unified package. Additionally, we refactored our Text-to-Speech (TTS) playback system to coordinate through a new global Zustand audio store, preventing overlapping audio playbacks and memory leaks.

## The Problem Being Solved

Prior to this PR, our system suffered from configuration drift and duplicate code paths:
1. **Validation Mismatch Bug:** The frontend interaction checker allowed users to select up to 50 medicines, but the API's Zod schema and GET-route validation strictly capped requests at 20. This caused a silent failure where selecting between 21 and 50 medicines passed client-side validation but was rejected by the server with a `400 Bad Request`.
2. **Hardcoded Magic Numbers:** The pharmacy bulk-upload limit of 500 items was hardcoded as a raw literal across multiple files, including the API's insert and update routes and the frontend's help text.
3. **Uncoordinated Audio Playback:** The cloud TTS hook (`useCloudTTS.ts`) managed its own local `HTMLAudioElement` ref and object URLs. If a user triggered multiple TTS playbacks in rapid succession or navigated away, audio tracks could overlap, and revoked object URLs or dangling event listeners could cause memory leaks and unexpected audio behavior.

## Files Modified

- `apps/api/src/routes/interactions.ts`
- `apps/api/src/routes/pharmacies.ts`
- `apps/web/app/[locale]/(dashboard)/pharmacy/inventory/bulk-upload/page.tsx`
- `apps/web/app/[locale]/interaction-checker/page.tsx`
- `apps/web/app/[locale]/voice/lib/useCloudTTS.ts`
- `apps/web/stores/useAudioStore.ts`
- `packages/shared/package.json`
- `packages/shared/src/index.ts`
- `packages/shared/src/limits.ts`
- `packages/shared/tsconfig.json`

## Implementation Details

### 1. Bootstrapping `@sahidawa/shared`
We created a new package in the `packages/` directory, which was already declared in our root `package.json` workspaces array but lacked an implementation.
- **`packages/shared/package.json`**: Defines the package name as `@sahidawa/shared`, sets up the entry point to `dist/index.js`, and configures build scripts.
- **`packages/shared/tsconfig.json`**: Configures TypeScript compilation options for the shared package.
- **`packages/shared/src/limits.ts`**: Declares and exports our unified limits:
  ```typescript
  export const MAX_INTERACTION_MEDICINES = 50;
  export const MAX_BULK_UPLOAD_ITEMS = 500;
  ```
- **`packages/shared/src/index.ts`**: Re-exports all constants from `limits.ts`.

### 2. API and Frontend Integration
- **Interactions Route (`apps/api/src/routes/interactions.ts`):** Imported `MAX_INTERACTION_MEDICINES` and updated the Zod schema validation and the manual array length check to use this constant, raising the API limit from 20 to 50.
- **Pharmacies Route (`apps/api/src/routes/pharmacies.ts`):** Replaced hardcoded `500` checks in both the insert and update bulk-upload CSV parsing blocks with `MAX_BULK_UPLOAD_ITEMS`.
- **Bulk Upload Page (`apps/web/app/[locale]/(dashboard)/pharmacy/inventory/bulk-upload/page.tsx`):** Replaced hardcoded text with the imported `MAX_BULK_UPLOAD_ITEMS` constant.
- **Interaction Checker Page (`apps/web/app/[locale]/interaction-checker/page.tsx`):** Replaced hardcoded `50` limits in the array slicing and error state handling with `MAX_INTERACTION_MEDICINES`.

### 3. TTS Audio Playback Refactoring
We introduced a global Zustand store to coordinate audio playback across the entire application:
- **`apps/web/stores/useAudioStore.ts`**:
  - Tracks `currentTrackId` (string | null).
  - Provides a `play(trackId)` action to set the active track.
  - Provides a `stopIfCurrent(trackId)` action to clear the active track if it matches the caller's ID.
- **`apps/web/app/[locale]/voice/lib/useCloudTTS.ts`**:
  - Generates a stable, unique `trackId` per hook instance using `crypto.randomUUID()` (falling back to an incremental counter if unavailable).
  - Subscribes to the global `useAudioStore` to determine if its local track is the one currently playing.
  - Instantiates a fresh `Audio` element on every playback instead of reusing a single ref. This prevents previous event listeners from firing on newly loaded tracks.
  - Cleans up resources (pausing audio, clearing sources, and invoking `stopIfCurrent`) on unmount or when superseded by another track.

## Technical Decisions

### Monorepo Shared Package
We chose to bootstrap `@sahidawa/shared` rather than using a simple relative import path or duplicate config files. This ensures a clean separation of concerns, enforces a single source of truth, and allows us to share types, schemas, and utility functions between our Next.js frontend and Express API in the future.

### Standardizing on 50 Interaction Medicines
We decided to resolve the validation mismatch by increasing the API limit to 50 rather than lowering the frontend limit to 20. This decision prioritizes the user experience in rural health settings, where community health workers often need to cross-reference larger batches of medicines at once. 

### Fresh Audio Elements vs. Reused Refs
In `useCloudTTS.ts`, we abandoned the pattern of reusing a single `HTMLAudioElement` ref. Reusing a single ref across multiple asynchronous playback requests introduced race conditions where event listeners (like `onplay` or `onended`) from a previous track would execute on a newly loaded track. Creating a new `Audio` instance per playback and cleanly detaching listeners from the old instance resolved these edge cases.

## How To Re-Implement (Contributor Reference)

If you need to add a new shared constant or re-implement this architecture:

1. **Add to Shared Package:**
   Open `packages/shared/src/limits.ts`, define your constant, and ensure it is exported.
   ```typescript
   export const MY_NEW_LIMIT = 100;
   ```
2. **Export from Entrypoint:**
   Ensure it is exported in `packages/shared/src/index.ts`:
   ```typescript
   export * from "./limits";
   ```
3. **Build the Shared Package:**
   Run the build command from the root workspace to compile the TypeScript files:
   ```bash
   npm run build -w packages/shared
   ```
4. **Import in Apps:**
   Import the constant directly into your frontend or API files:
   ```typescript
   import { MY_NEW_LIMIT } from "@sahidawa/shared";
   ```
5. **Coordinate Audio Playback:**
   When writing any component or hook that plays audio, do not play it in isolation. Always register a unique track ID with `useAudioStore` and call `play(trackId)` before starting playback. Implement an effect to handle unmounting:
   ```typescript
   useEffect(() => {
       return () => {
           useAudioStore.getState().stopIfCurrent(myTrackId);
       };
   }, [myTrackId]);
   ```

## Impact on System Architecture

- **Zero-Drift Validation:** Eliminates client/server validation mismatches by sharing limits directly at compile time.
- **Scalable Monorepo Structure:** Establishes the foundation for sharing Zod validation schemas, TypeScript interfaces, and helper functions between the API and frontend.
- **Robust Audio Lifecycle:** Centralizes audio state management, ensuring that only one audio source plays at any given time across the entire application, which is crucial for low-resource devices running our voice-guided features.

## Testing & Verification

We verified this implementation through the following steps:
1. **Compilation Checks:** Ran `npm run build -w packages/shared` and verified successful compilation. Ran `npx tsc --noEmit` in both `apps/web` and `apps/api` to ensure no type errors occurred from the new imports.
2. **Interaction Checker Verification:** Selected 35 medicines in the frontend interaction checker. Verified that the request successfully reached the API and returned a `200 OK` response instead of the previous `400 Bad Request`.
3. **Bulk Upload Verification:** Attempted to upload a CSV containing 501 items. Verified that the API rejected the request with a `400` error displaying the message: `"Bulk upload exceeds the maximum limit of 500 items per request."`
4. **TTS Playback Verification:** Triggered multiple voice playbacks in rapid succession. Verified that the previous audio track immediately stopped playing and its object URL was revoked, preventing overlapping audio outputs.