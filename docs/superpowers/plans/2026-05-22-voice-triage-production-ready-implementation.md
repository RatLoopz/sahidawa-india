# Voice Triage Production-Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser speech recognition as the primary voice-triage input with recorded audio forwarded to ML transcription, while preserving the current triage UI and adding clear error handling plus tests.

**Architecture:** The web voice page will keep ownership of the user-facing state machine, but recording and transcription details will move into focused helpers. A new `apps/web/app/api/voice/transcribe/route.ts` proxy will forward browser-recorded audio to the ML service, and the resulting transcript will flow into the existing `voice-triage` chat route.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Jest with `ts-jest`, FastAPI ML service, browser `MediaRecorder`, existing voice helper modules

---

## File Structure

- Modify: `apps/web/app/[locale]/voice/page.tsx`
    - Switch primary capture flow from speech-recognition-first to recording-first.
- Create: `apps/web/app/[locale]/voice/lib/recording.ts`
    - Isolated browser recording capability and MIME-type helpers.
- Create: `apps/web/app/[locale]/voice/lib/transcription.ts`
    - Client-side upload helper and response normalization.
- Create: `apps/web/app/api/voice/transcribe/route.ts`
    - Thin server-side proxy to ML `/asr/transcribe`.
- Modify: `apps/web/app/[locale]/voice/types.ts`
    - Add any small response/error typing needed by the new flow.
- Modify: `apps/web/tests/voice-helpers.test.ts`
    - Add helper tests for recording/transcription helpers.
- Create: `apps/web/tests/voice-transcribe-route.test.ts`
    - Add route tests for proxy success and failure states.
- Modify: `docs/api-reference.md`
    - Update the voice transcription docs to reflect the real route behavior.

### Task 1: Add the web transcription proxy

**Files:**

- Create: `apps/web/app/api/voice/transcribe/route.ts`
- Test: `apps/web/tests/voice-transcribe-route.test.ts`

- [ ] **Step 1: Write the failing test for a successful proxy response**

```ts
import { POST } from "../app/api/voice/transcribe/route";

describe("POST /api/voice/transcribe", () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it("forwards audio to the ML transcription service and returns normalized JSON", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                transcription: "I have fever and cough",
                language: "en",
                language_probability: 0.84,
            }),
        }) as unknown as typeof fetch;

        const formData = new FormData();
        formData.append("file", new File(["audio"], "voice.webm", { type: "audio/webm" }));
        const request = new Request("http://localhost/api/voice/transcribe", {
            method: "POST",
            body: formData,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
            transcript: "I have fever and cough",
            language: "en",
            confidence: 0.84,
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w web -- voice-transcribe-route.test.ts --runInBand`
Expected: FAIL because `apps/web/app/api/voice/transcribe/route.ts` does not exist yet.

- [ ] **Step 3: Write the minimal route implementation**

```ts
import { NextResponse } from "next/server";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
        return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
    }

    const upstreamBody = new FormData();
    upstreamBody.append("file", file);

    const upstreamResponse = await fetch(`${ML_SERVICE_URL}/asr/transcribe`, {
        method: "POST",
        body: upstreamBody,
    });

    const upstreamData = await upstreamResponse.json();

    if (!upstreamResponse.ok) {
        return NextResponse.json(
            { error: upstreamData.detail ?? "Transcription failed." },
            { status: upstreamResponse.status }
        );
    }

    return NextResponse.json({
        transcript: String(upstreamData.transcription ?? "").trim(),
        language: upstreamData.language ?? null,
        confidence:
            typeof upstreamData.language_probability === "number"
                ? upstreamData.language_probability
                : null,
    });
}
```

- [ ] **Step 4: Expand the test file with missing-file and upstream-error cases**

```ts
it("returns 400 when the request does not include audio", async () => {
    const request = new Request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: new FormData(),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Audio file is required.");
});

it("maps upstream ML failures into a retryable error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ detail: "Could not process audio file." }),
    }) as unknown as typeof fetch;

    const formData = new FormData();
    formData.append("file", new File(["bad"], "voice.webm", { type: "audio/webm" }));

    const request = new Request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe("Could not process audio file.");
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -w web -- voice-transcribe-route.test.ts --runInBand`
Expected: PASS with 3 passing tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/voice/transcribe/route.ts apps/web/tests/voice-transcribe-route.test.ts
git commit -m "feat(web): add voice transcription proxy route"
```

### Task 2: Add recording and transcription helpers

**Files:**

- Create: `apps/web/app/[locale]/voice/lib/recording.ts`
- Create: `apps/web/app/[locale]/voice/lib/transcription.ts`
- Modify: `apps/web/app/[locale]/voice/types.ts`
- Modify: `apps/web/tests/voice-helpers.test.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
import {
    getPreferredRecordingMimeType,
    supportsAudioRecording,
} from "../app/[locale]/voice/lib/recording";
import { normalizeVoiceTranscriptionResponse } from "../app/[locale]/voice/lib/transcription";

describe("voice recording helpers", () => {
    it("detects when MediaRecorder support exists", () => {
        expect(supportsAudioRecording({ MediaRecorder: class {} } as Window)).toBe(true);
        expect(supportsAudioRecording({} as Window)).toBe(false);
    });

    it("picks a supported recording mime type when available", () => {
        const MediaRecorderMock = {
            isTypeSupported: (value: string) => value === "audio/webm;codecs=opus",
        };

        expect(getPreferredRecordingMimeType(MediaRecorderMock)).toBe("audio/webm;codecs=opus");
    });
});

describe("voice transcription response normalization", () => {
    it("normalizes transcript, language, and confidence", () => {
        expect(
            normalizeVoiceTranscriptionResponse({
                transcript: "  fever for two days  ",
                language: "en",
                confidence: 0.61,
            })
        ).toEqual({
            transcript: "fever for two days",
            language: "en",
            confidence: 0.61,
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w web -- voice-helpers.test.ts --runInBand`
Expected: FAIL because the new helper modules and exports do not exist yet.

- [ ] **Step 3: Write the minimal helper implementations**

```ts
const PREFERRED_RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

export function supportsAudioRecording(targetWindow: Window): boolean {
    return (
        typeof (targetWindow as Window & { MediaRecorder?: unknown }).MediaRecorder === "function"
    );
}

export function getPreferredRecordingMimeType(
    recorderCtor: Pick<typeof MediaRecorder, "isTypeSupported"> | null
): string {
    if (!recorderCtor) {
        return "";
    }

    return PREFERRED_RECORDING_TYPES.find((type) => recorderCtor.isTypeSupported(type)) ?? "";
}
```

```ts
export type VoiceTranscriptionPayload = {
    transcript: string;
    language: string | null;
    confidence: number | null;
};

export function normalizeVoiceTranscriptionResponse(
    payload: VoiceTranscriptionPayload
): VoiceTranscriptionPayload {
    return {
        transcript: payload.transcript.trim(),
        language: payload.language,
        confidence: payload.confidence,
    };
}
```

- [ ] **Step 4: Add the client upload helper and test it indirectly through normalization**

```ts
export async function transcribeRecordedAudio(file: File): Promise<VoiceTranscriptionPayload> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            typeof data.error === "string" && data.error.trim()
                ? data.error
                : "Transcription failed."
        );
    }

    return normalizeVoiceTranscriptionResponse({
        transcript: String(data.transcript ?? ""),
        language: typeof data.language === "string" ? data.language : null,
        confidence: typeof data.confidence === "number" ? data.confidence : null,
    });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -w web -- voice-helpers.test.ts --runInBand`
Expected: PASS with the new helper coverage included.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/[locale]/voice/lib/recording.ts apps/web/app/[locale]/voice/lib/transcription.ts apps/web/app/[locale]/voice/types.ts apps/web/tests/voice-helpers.test.ts
git commit -m "feat(voice): add recording and transcription helpers"
```

### Task 3: Switch the voice page to recording-first flow

**Files:**

- Modify: `apps/web/app/[locale]/voice/page.tsx`
- Test: `apps/web/tests/voice-helpers.test.ts`

- [ ] **Step 1: Write the failing behavior-focused test for error mapping or helper boundary you can verify without a browser**

```ts
import { getConfidenceMeta } from "../app/[locale]/voice/lib/confidence";

test("ASR language probability maps into the existing review threshold", () => {
    expect(getConfidenceMeta(0.4).shouldReview).toBe(true);
    expect(getConfidenceMeta(0.92).shouldReview).toBe(false);
});
```

- [ ] **Step 2: Run the focused tests to verify the red state is meaningful**

Run: `npm test -w web -- voice-helpers.test.ts voice-transcribe-route.test.ts --runInBand`
Expected: PASS for existing tests and any new assertion failures should reflect missing recording-first wiring work, not setup errors.

- [ ] **Step 3: Replace the capture flow in `page.tsx` with recording-first logic**

```ts
const recordingChunksRef = useRef<Blob[]>([]);
const mediaRecorderRef = useRef<MediaRecorder | null>(null);

async function startListening() {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia || !supportsAudioRecording(window)) {
        return startSpeechRecognitionFallback();
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getPreferredRecordingMimeType(window.MediaRecorder);
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recordingChunksRef.current = [];
    recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
        const audioBlob = new Blob(recordingChunksRef.current, {
            type: recorder.mimeType || mimeType || "audio/webm",
        });

        if (audioBlob.size === 0) {
            setError({
                title: t("errors.microphone_title"),
                message: t("errors.no_speech_message"),
            });
            setStep("error");
            return;
        }

        setStep("processing");
        const file = new File([audioBlob], "voice-triage.webm", { type: audioBlob.type });
        const transcription = await transcribeRecordedAudio(file);
        const confidenceMeta = getConfidenceMeta(transcription.confidence ?? undefined);
        const emergencyResult = detectEmergencyKeywords(transcription.transcript);

        if (confidenceMeta.shouldReview) {
            setTranscript(transcription.transcript);
            setConfidence(confidenceMeta);
            setEmergencyMatches(emergencyResult.matches);
            setStep("review");
            return;
        }

        await analyseTranscript(transcription.transcript, confidenceMeta, emergencyResult.matches);
    };

    mediaRecorderRef.current = recorder;
    setActiveAudioStream(stream);
    setStep("listening");
    recorder.start();
}
```

- [ ] **Step 4: Preserve an explicit speech-recognition fallback and add stage-specific errors**

```ts
function startSpeechRecognitionFallback() {
    const SpeechRecognition = getSpeechRecognitionConstructor(window);
    if (!SpeechRecognition) {
        setError(getRecognitionErrorState("unsupported", t));
        setStep("error");
        return;
    }

    // Existing recognition flow stays here, but is only reached when recording is unavailable.
}
```

- [ ] **Step 5: Run web tests after the refactor**

Run: `npm test -w web -- voice-helpers.test.ts voice-audio-visualizer.test.ts voice-transcribe-route.test.ts --runInBand`
Expected: PASS for the targeted voice coverage.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/[locale]/voice/page.tsx
git commit -m "feat(voice): make recorded audio the primary triage flow"
```

### Task 4: Update docs

**Files:**

- Modify: `docs/api-reference.md`

- [ ] **Step 1: Write the doc change describing the actual route chain**

```md
## POST /api/voice/transcribe

Server-side proxy used by the Voice Triage page. Accepts recorded browser audio as multipart form data and forwards it to the ML service `/asr/transcribe`.

Returns:

- `transcript`
- `language`
- `confidence`
```

- [ ] **Step 2: Verify the docs now match the implementation**

Run: `rg -n "voice/transcribe|asr/transcribe|Voice Triage" docs/api-reference.md apps/web/app/api/voice/transcribe/route.ts apps/web/app/[locale]/voice/page.tsx`
Expected: matching route names and current flow description.

- [ ] **Step 3: Commit**

```bash
git add docs/api-reference.md
git commit -m "docs: update voice transcription flow reference"
```
