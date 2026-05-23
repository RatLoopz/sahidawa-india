# Voice Triage Emergency Detection Design

## Summary

Issue [#441](https://github.com/RatLoopz/sahidawa-india/issues/441) is about improving emergency symptom detection inside Voice Triage. The current implementation uses a tiny flat phrase list in the web client and only applies deterministic emergency matching in one place. That is fragile for production because multilingual coverage is narrow, normalization is basic, and server results can drift from client-side safety behavior.

The design for this issue is to move emergency keyword detection into a shared `apps/web` module used by both the Voice Triage page and the API route, while expanding phrase coverage and improving transcript normalization.

## Goals

- Expand emergency phrase coverage significantly.
- Support multilingual and common regional emergency wording.
- Improve transcript normalization before matching.
- Use one shared deterministic matcher in both client and server code paths.
- Preserve the current fast local emergency alert behavior in the browser.
- Ensure server-side triage results cannot suppress a deterministic emergency match.
- Add focused tests for normalization, detection, and API behavior.

## Non-Goals

- Moving emergency detection into `apps/ml` for this issue.
- Replacing deterministic matching with fuzzy search or model-based classification.
- Changing the overall Voice Triage UI flow.
- Redesigning the AI triage prompt beyond the minimum needed to integrate shared emergency results.

## Existing Context

### Current Client Detection

- [`apps/web/app/[locale]/voice/lib/emergency.ts`](/home/user/sahidawa-india/apps/web/app/[locale]/voice/lib/emergency.ts) currently lowercases text, strips punctuation, and matches a short flat phrase list.
- [`apps/web/app/[locale]/voice/page.tsx`](/home/user/sahidawa-india/apps/web/app/[locale]/voice/page.tsx) uses that result to show the fast local emergency warning before the AI round-trip completes.

### Current Server Triage

- [`apps/web/app/api/chat/route.ts`](/home/user/sahidawa-india/apps/web/app/api/chat/route.ts) sends the transcript to Gemini and trusts the parsed `emergency` boolean from the AI response.
- The current API route does not run the deterministic emergency matcher itself.

### Current Test Coverage

- [`apps/web/tests/voice-helpers.test.ts`](/home/user/sahidawa-india/apps/web/tests/voice-helpers.test.ts) covers only a small subset of the existing emergency detection behavior.

## Recommended Approach

Use a shared matcher in `apps/web/lib/voice` and import it from both the client page and the API route. This gives production a single source of truth without adding a new service boundary or making emergency detection depend on the ML app.

Why this is the best production direction:

- It avoids client/server drift.
- It preserves the instant local alert UX.
- It keeps deployment simple because both call sites already live in `apps/web`.
- It makes future phrase and language updates low-risk because they happen in one module with one test surface.

## Architecture

### Shared Emergency Module

Create a shared module under `apps/web/lib/voice` with:

- a transcript normalization helper
- a structured emergency phrase catalog
- a `detectEmergencyKeywords` function that returns a richer result

Suggested return shape:

```ts
type EmergencyDetectionResult = {
    isEmergency: boolean;
    matchedGroups: string[];
    matches: string[];
};
```

### Client Integration

[`apps/web/app/[locale]/voice/page.tsx`](/home/user/sahidawa-india/apps/web/app/[locale]/voice/page.tsx) should import the shared matcher and keep its current responsibility:

- detect emergencies immediately after transcript capture
- store matched phrases for the current UI warning
- continue into AI triage using the transcript

### Server Integration

[`apps/web/app/api/chat/route.ts`](/home/user/sahidawa-india/apps/web/app/api/chat/route.ts) should import the same shared matcher and run it against the latest transcript before returning the final voice-triage payload.

Final emergency state should be:

- `true` when the AI says emergency
- `true` when the deterministic matcher finds emergency phrases
- `false` only when both are negative

This preserves safety if the model is conservative or inconsistent.

## Detection Pipeline

### Normalization

Normalization should stay deterministic and cheap enough for both browser and server execution:

- lowercase with Unicode support
- strip punctuation that breaks phrase matching
- collapse repeated whitespace
- preserve non-Latin scripts
- produce a normalized search string that still supports transliterated Hindi and Hinglish phrases

This issue should not add fuzzy matching, stemming, or heavyweight NLP.

### Phrase Catalog

Replace the flat phrase list with grouped entries:

```ts
type EmergencyPhraseGroup = {
    id: string;
    phrases: readonly string[];
};
```

Group examples:

- `breathing_distress`
- `chest_pain`
- `unconsciousness`
- `seizure`
- `stroke_symptoms`
- `severe_bleeding`

Each group should include:

- English phrases
- Indian-language script phrases where practical for the supported Voice Triage languages
- common romanized variants such as Hinglish inputs

## Testing

Add tests in [`apps/web/tests/voice-helpers.test.ts`](/home/user/sahidawa-india/apps/web/tests/voice-helpers.test.ts) for:

- punctuation and whitespace normalization
- English emergency phrase matches
- multilingual script phrase matches
- romanized regional phrase matches
- non-emergency transcripts that should stay negative
- richer return shape with stable group ids

Add API route coverage in a new test file under `apps/web/tests` for:

- deterministic emergency detection forcing `emergency: true` even when the parsed AI payload says `false`
- normal non-emergency responses staying `false`
- missing message text returning `400`

## Acceptance Criteria Mapping

- Emergency phrase coverage is expanded significantly.
    - done through grouped phrase catalog with multilingual and romanized variants
- Multilingual or regional emergency phrases are supported.
    - done through script phrases and Hinglish-style variants
- Transcript normalization is improved before matching.
    - done through shared normalization helper
- Urgent symptom detection is more reliable than the current implementation.
    - done through one shared matcher in both client and server
- Tests are added or updated for emergency detection cases.
    - done through helper and API route test coverage

## Risks And Mitigations

- False positives from overly broad phrases.
    - keep exact normalized phrase matching and avoid fuzzy heuristics
- Drift between client and server logic.
    - remove feature-local matcher ownership and use one shared module
- Future phrase additions becoming hard to manage.
    - structure phrases by stable symptom group ids instead of one flat list

## Implementation Boundary

This issue should stay focused on emergency keyword detection quality and shared integration. It should not grow into a full ML classification redesign or a broader voice feature rewrite.
