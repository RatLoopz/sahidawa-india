# PR #3317 — fix(api): implement proper query bypass on voice verification layer-2…

> **Merged:** 2026-07-07 | **Author:** @Avinash-sdbegin | **Area:** Backend | **Impact Score:** 9 | **Closes:** #2834

## What Changed

We refactored the voice verification route in `apps/api/src/routes/medicine.ts` to enforce a strict Layer-2 Redis cache lookup immediately following audio transcription. On a Layer-2 cache hit (by transcribed text), the system now immediately returns the cached payload and back-fills the Layer-1 cache (by audio hash) to bypass future transcription steps. We eliminated redundant database queries to Supabase by flattening the control flow and ensuring cache hits short-circuit the execution path.

## The Problem Being Solved

Before this PR, the voice verification endpoint suffered from inefficient cache-bypass behavior and redundant database queries. Even when a transcribed text matched an existing Layer-2 cache entry, the control flow did not reliably short-circuit the database query or properly synchronize the Layer-1 (audio hash) and Layer-2 (transcribed text) caches. This resulted in unnecessary Supabase database reads, increased latency for rural users on slow networks, and wasted compute resources on redundant ML transcription and database lookups for identical or highly similar voice queries.

## Files Modified

- `apps/api/src/routes/medicine.ts`

## Implementation Details

### Early Exit for Empty Transcriptions
We added an explicit check `if (transcribedText === "")` to immediately return a `transcription_failed` status, preventing downstream processing and database queries when the audio cannot be transcribed.

### Layer-2 Cache Interception
We call `getCachedVoiceResult(transcribedText)` immediately after transcription. If a cache hit occurs:
1. We log the event: `Voice verification served from text cache for: "${transcribedText}"`.
2. We back-fill the Layer-1 audio hash cache using `await setCachedVoiceByAudioHash(audioHash, cachedByText)`.
3. We return the response immediately via `res.json(cachedByText)`.

### Supabase Query Bypass
The Supabase query using `.or(buildMedicineVoiceSearchFilter(transcribedText))` is now strictly positioned after the Layer-2 cache check. It is only executed on a cache miss.

### Dual-Layer Cache Synchronization
On a cache miss, after querying Supabase and building the `verificationResult`, we use `Promise.all` to concurrently write to both cache layers:
```typescript
await Promise.all([
    setCachedVoiceResult(transcribedText, result),
    setCachedVoiceByAudioHash(audioHash, result),
]);
```
This ensures that future requests with either the same audio hash (Layer 1) or the same transcribed text (Layer 2) will hit the cache.

## Technical Decisions

- **Flattening the Control Flow:** We removed nested conditional blocks (`if (transcribedText) { ... }`) to make the execution path linear and easier to reason about. This prevents edge cases where a falsy or unexpected transcription state could bypass cache logic.
- **Asynchronous Back-filling:** When a Layer-2 cache hit occurs, we write to the Layer-1 cache (`setCachedVoiceByAudioHash`). This ensures that future requests with the exact same audio file (matching the `audioHash`) bypass the expensive machine learning transcription step entirely, shifting the performance profile from $O(\text{ML} + \text{DB})$ to $O(1)$ Redis lookups.
- **Concurrent Cache Writes:** Using `Promise.all` for cache population ensures that both Redis writes happen in parallel, minimizing the response latency for the initial cache-miss request.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or modify this caching layer, follow this execution flow:

1. **Validate Transcription:** After the transcription engine returns `transcribedText`, check if it is empty. If empty, return a `transcription_failed` response immediately.
2. **Query Layer-2 Cache:** Call `getCachedVoiceResult(transcribedText)`.
3. **Handle Layer-2 Hit:** If a record is found, write it to the Layer-1 cache using `setCachedVoiceByAudioHash(audioHash, cachedByText)` and return the response.
4. **Handle Layer-2 Miss:** Query Supabase using the helper `buildMedicineVoiceSearchFilter(transcribedText)`.
5. **Construct Payload:** Build the verification payload, then write to both Redis caches concurrently using `Promise.all([setCachedVoiceResult(...), setCachedVoiceByAudioHash(...)])`.

> ⚠️ **Gotcha:** Ensure that the `audioHash` is correctly calculated and passed down. If the Layer-1 cache is not back-filled during a Layer-2 hit, identical audio files will still trigger the transcription engine, defeating the multi-tier caching strategy.

## Impact on System Architecture

This change optimizes our multi-tier caching strategy:
- **Layer-1 (Audio Hash -> Verification Result):** Bypasses both ML transcription and DB queries.
- **Layer-2 (Transcribed Text -> Verification Result):** Bypasses DB queries.

By back-filling Layer-1 from Layer-2 hits, we dynamically upgrade text-only cache hits to audio-hash cache hits, drastically reducing the load on our transcription services. This significantly reduces Supabase read costs and improves API response times, which is critical for SahiDawa's rural health workers operating in low-bandwidth environments.

## Testing & Verification

- **Cache Hit Verification:** Verified that sending a voice request with a previously transcribed medicine name returns the cached result instantly without triggering a Supabase query.
- **Cache Miss Verification:** Confirmed that a new medicine name correctly queries Supabase, populates both Layer-1 and Layer-2 Redis caches, and returns the correct payload.
- **Back-fill Verification:** Confirmed that after a Layer-2 cache hit, a subsequent request with the exact same audio file hits the Layer-1 cache, bypassing transcription entirely.