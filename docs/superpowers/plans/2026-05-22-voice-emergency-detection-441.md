# Voice Emergency Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared multilingual emergency detector for Voice Triage and use it in both the client page and API route.

**Architecture:** Move deterministic emergency matching into `apps/web/lib/voice/emergency.ts`, expand normalization and phrase coverage there, and import that module from both the voice page and the chat API route. Prove behavior with helper-level and route-level Jest coverage before implementation.

**Tech Stack:** Next.js App Router, TypeScript, Jest, ts-jest

---

### Task 1: Shared matcher test-first migration

**Files:**

- Create: `apps/web/lib/voice/emergency.ts`
- Modify: `apps/web/tests/voice-helpers.test.ts`
- Modify: `apps/web/app/[locale]/voice/lib/emergency.ts`

- [x] **Step 1: Write the failing matcher tests**

```ts
describe("detectEmergencyKeywords", () => {
    it("matches English emergency phrases after normalization", () => {
        const result = detectEmergencyKeywords("My father has CHEST pain, and trouble breathing!");

        expect(result.isEmergency).toBe(true);
        expect(result.matchedGroups).toEqual(
            expect.arrayContaining(["chest_pain", "breathing_distress"])
        );
    });

    it("matches multilingual and romanized emergency phrases", () => {
        expect(detectEmergencyKeywords("மார்பு வலி மற்றும் மூச்சு விட கஷ்டம்").isEmergency).toBe(
            true
        );
        expect(
            detectEmergencyKeywords("mujhe saans lene mein dikkat ho rahi hai").isEmergency
        ).toBe(true);
    });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -w web -- voice-helpers.test.ts --runInBand`
Expected: FAIL because `matchedGroups` and the shared matcher behavior do not exist yet.

- [x] **Step 3: Write the minimal shared matcher**

```ts
export function detectEmergencyKeywords(transcript: string): EmergencyDetectionResult {
    const normalizedTranscript = normalizeTranscript(transcript);
    const matchedGroups = EMERGENCY_PHRASE_GROUPS.filter((group) =>
        group.phrases.some((phrase) => normalizedTranscript.includes(phrase))
    );

    return {
        isEmergency: matchedGroups.length > 0,
        matchedGroups: matchedGroups.map((group) => group.id),
        matches: matchedGroups.flatMap((group) =>
            group.phrases.filter((phrase) => normalizedTranscript.includes(phrase))
        ),
    };
}
```

- [x] **Step 4: Re-export the matcher from the old voice-local import path**

```ts
export { detectEmergencyKeywords } from "../../../../lib/voice/emergency";
export type { EmergencyDetectionResult } from "../../../../lib/voice/emergency";
```

- [x] **Step 5: Run test to verify it passes**

Run: `npm test -w web -- voice-helpers.test.ts --runInBand`
Expected: PASS

### Task 2: Server-side emergency enforcement

**Files:**

- Modify: `apps/web/app/api/chat/route.ts`
- Create: `apps/web/tests/chat-route.test.ts`

- [x] **Step 1: Write the failing route tests**

```ts
test("forces emergency true when deterministic detection matches", async () => {
    const request = new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            mode: "voice-triage",
            responseLanguage: "English",
            messages: [{ text: "My mother is unconscious and has chest pain" }],
        }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.emergency).toBe(true);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -w web -- chat-route.test.ts --runInBand`
Expected: FAIL because the route currently trusts only the parsed AI `emergency` field.

- [x] **Step 3: Add shared matcher usage in the route**

```ts
const deterministicEmergency = detectEmergencyKeywords(latestMessageText);

return NextResponse.json({
    ...parsedResponse,
    emergency: parsedResponse.emergency || deterministicEmergency.isEmergency,
});
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -w web -- chat-route.test.ts --runInBand`
Expected: PASS

### Task 3: Client integration cleanup and regression pass

**Files:**

- Modify: `apps/web/app/[locale]/voice/page.tsx`
- Modify: `apps/web/tests/voice-helpers.test.ts`

- [x] **Step 1: Update client imports to use the shared source**

```ts
import { detectEmergencyKeywords } from "@/lib/voice/emergency";
```

- [x] **Step 2: Keep the existing client UX behavior intact**

```ts
const emergencyResult = detectEmergencyKeywords(normalizedTranscript);

setEmergencyMatches(emergencyResult.matches);
void analyseTranscript(normalizedTranscript, confidenceMeta, emergencyResult.matches);
```

- [x] **Step 3: Run the focused web test suite**

Run: `npm test -w web -- voice-helpers.test.ts chat-route.test.ts --runInBand`
Expected: PASS

- [x] **Step 4: Run a type-aware production check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: PASS

- [x] **Step 5: Run the web build**

Run: `npm run build -w web`
Expected: PASS
