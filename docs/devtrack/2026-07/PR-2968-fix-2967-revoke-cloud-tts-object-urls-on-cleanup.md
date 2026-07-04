# PR #2968 — fix(#2967): revoke cloud TTS object URLs on cleanup

> **Merged:** 2026-07-02 | **Author:** @Shreya-nipunge | **Area:** Frontend | **Impact Score:** 8 | **Closes:** #2967

## What Changed

We introduced a robust memory management mechanism to our Cloud Text-to-Speech (TTS) hook (`useCloudTTS`) by tracking and revoking Blob object URLs across all possible lifecycles. We added an active object URL reference (`activeObjectUrlRef`), implemented an idempotent cleanup helper (`cleanupObjectUrl`), and integrated it into playback completion, error handling, manual stops, source replacements, and component unmounts. Finally, we added a comprehensive unit test suite in `apps/web/tests/useCloudTTS.test.tsx` to prevent future memory leak regressions.

## The Problem Being Solved

Before this PR, our Cloud TTS system suffered from a critical memory leak. When a user requested voice output, the system fetched the audio bytes, created an in-memory Blob, and generated an object URL via `URL.createObjectURL(audioBlob)` to feed into the HTMLAudioElement. However, this object URL was only revoked when playback naturally ended (`onended` event). 

If a user manually stopped the playback, if an error occurred during playback, if a new audio source replaced the current one, if `audio.play()` failed, or if the component unmounted before playback completed, the Blob remained allocated in browser memory. In a rural health platform like SahiDawa where users frequently listen to multiple medicine instructions, this cumulative memory leak could degrade performance or crash the browser on low-end mobile devices common in rural India.

## Files Modified

- `apps/web/app/[locale]/voice/lib/useCloudTTS.ts`
- `apps/web/tests/useCloudTTS.test.tsx`

## Implementation Details

### Ref-Based URL Tracking
We introduced `activeObjectUrlRef = useRef<string | null>(null)` to hold the current Blob URL. This allows us to access the active URL across renders without triggering unnecessary re-renders.

### Idempotent Cleanup Helper
The `cleanupObjectUrl` helper function takes an optional URL parameter (defaulting to `activeObjectUrlRef.current`). It verifies that the URL exists and matches the active ref, calls `URL.revokeObjectURL(url)`, and clears the ref (`activeObjectUrlRef.current = null`). This prevents double-revocation errors.

```typescript
const cleanupObjectUrl = useCallback((url = activeObjectUrlRef.current) => {
    if (!url) return;
    if (activeObjectUrlRef.current !== url) return;

    URL.revokeObjectURL(url);
    activeObjectUrlRef.current = null;
}, []);
```

### Unmount Lifecycle Hook
We added a `useEffect` hook that returns a cleanup function. When the component unmounts, it pauses the audio element, resets its source (`src = ""`), clears event listeners (`onplay`, `onended`, `onerror`), and calls `cleanupObjectUrl()`.

```typescript
useEffect(() => {
    return () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current.onplay = null;
            audioRef.current.onended = null;
            audioRef.current.onerror = null;
        }
        cleanupObjectUrl();
    };
}, [cleanupObjectUrl]);
```

### Playback Lifecycle Integration
- **Source Replacement:** In `playTTS`, before assigning the new `audioUrl` to `audio.src`, we call `cleanupObjectUrl()` to release the previous audio resource.
- **Event Handlers:** In `handleEnded` and `handleError` event handlers, we call `cleanupObjectUrl(audioUrl)`.
- **Play Failures:** In the `catch` block of `playTTS`, if `createdAudioUrl` was generated but playback failed to start, we call `cleanupObjectUrl(createdAudioUrl)`.
- **Manual Stop:** In `stopTTS`, we call `cleanupObjectUrl()` to release the memory immediately when a user stops playback.

## Technical Decisions

- **React Refs over State:** We chose `useRef` (`activeObjectUrlRef`) instead of `useState` to track the active object URL. Since revoking an object URL is a side effect that does not require a UI re-render, using a ref avoids unnecessary render cycles and ensures we always have access to the latest URL synchronously.
- **Idempotent Helper Pattern:** The `cleanupObjectUrl` helper checks if the URL being cleaned up matches the current active URL. This prevents race conditions where a fast-clicking user triggers multiple TTS requests, ensuring we don't prematurely revoke a newly created URL while cleaning up an old one.
- **Explicit Event Listener Teardown:** In the unmount effect, we explicitly set `audio.onplay`, `audio.onended`, and `audio.onerror` to `null`. This prevents memory leaks associated with closures retaining references to component state or options callbacks.

## How To Re-Implement (Contributor Reference)

If you need to implement this memory management pattern in another hook or audio player within SahiDawa, follow these steps:

1. **Define a Ref for the URL:**
   ```typescript
   const activeObjectUrlRef = useRef<string | null>(null);
   ```
2. **Implement the Idempotent Cleanup Helper:**
   ```typescript
   const cleanupObjectUrl = useCallback((url = activeObjectUrlRef.current) => {
       if (!url || activeObjectUrlRef.current !== url) return;
       URL.revokeObjectURL(url);
       activeObjectUrlRef.current = null;
   }, []);
   ```
3. **Set Up Unmount Cleanup:**
   Ensure that when the component unmounts, the audio is paused, the source is cleared, event handlers are nullified, and the object URL is revoked.
4. **Track Local URL Creation:**
   In your asynchronous generation function, track the newly created URL in a local variable (e.g., `let createdAudioUrl: string | null = null;`). If an error occurs before the URL is assigned to the ref, clean it up in the `catch` block.
5. **Clean Up Before Re-assignment:**
   Always call `cleanupObjectUrl()` right before assigning a new URL to your media element's `src` attribute.

## Impact on System Architecture

This change significantly hardens our frontend memory management. SahiDawa is designed to run reliably on low-resource mobile browsers in rural areas where network bandwidth and device memory are highly constrained. By ensuring that every dynamically generated audio Blob is immediately garbage collected once it is no longer needed, we prevent cumulative memory bloat. This makes our voice-guided medicine verification feature robust enough for extended sessions without causing browser tab crashes.

## Testing & Verification

We verified this change by writing a comprehensive unit test suite in `apps/web/tests/useCloudTTS.test.tsx` using Jest and `jsdom`. 

The tests mock the global `Audio` element, `fetch`, and `URL.createObjectURL`/`URL.revokeObjectURL` APIs. We tested 6 distinct scenarios:
1. **Natural End:** Revocation when playback ends naturally.
2. **Playback Error:** Revocation when playback encounters an error.
3. **Manual Stop:** Revocation when playback is manually stopped.
4. **Source Replacement:** Revocation of the previous URL before replacing it with a new source.
5. **Unmount:** Revocation on component unmount.
6. **Double-cleanup Protection:** Ensuring the same URL is not revoked twice.

All tests passed successfully under `npm.cmd test -w web -- useCloudTTS.test.tsx --runInBand`.