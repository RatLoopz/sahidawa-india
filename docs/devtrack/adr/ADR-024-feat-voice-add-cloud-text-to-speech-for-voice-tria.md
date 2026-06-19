# ADR — feat(voice): add cloud Text-to-Speech for Voice Triage results

> **Date:** 2026-06-04 | **PR:** #1242 | **Status:** Accepted

## Context

The existing Voice Triage feature relied on the browser's native `speechSynthesis` API to read out results. This approach suffered from inconsistent browser support, variable voice quality, and a lack of high-quality, regionally appropriate Indian language voices, leading to a fragmented and suboptimal user experience. Additionally, the Gemini model's output for triage results was occasionally malformed (e.g., markdown-fenced JSON, mixed languages), causing parsing failures and poor on-screen display. The ASR service also lacked graceful error handling when the `ffmpeg` dependency was missing.

## Decision

Google Cloud Text-to-Speech (TTS) was integrated to provide high-quality, consistent voice output for Voice Triage results. A new FastAPI router (`apps/ml/routers/tts.py`) was implemented to handle TTS synthesis via Google Cloud TTS, supporting a per-language voice map (Neural2 for `en-IN`/`hi-IN`, WaveNet for `ta-IN`/`bn-IN`/`mr-IN`, Standard for `te-IN`) and on-disk caching. A Next.js API handler (`apps/web/app/api/voice/tts/route.ts`) was created to proxy frontend requests to this ML service endpoint. The frontend (`apps/web/app/[locale]/voice/page.tsx`) was updated to utilize this cloud TTS service, with native `speechSynthesis` retained as a graceful fallback.

To address reliability issues, the Voice Triage flow was updated to use Gemini's structured output feature (`responseMimeType: "application/json" + responseSchema`) in `apps/web/app/api/chat/route.ts`, ensuring clean, parseable JSON responses and concise, single-language recommendations. Furthermore, the ASR service (`apps/ml/routers/asr.py`) was enhanced to return a clean 503 status code and log the root cause when `ffmpeg` is unavailable, improving error handling.

## Alternatives Considered

| Alternative                                                | Why Rejected                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rely solely on native `speechSynthesis` API                | Inconsistent browser support, variable voice quality, and limited availability of high-quality, regionally appropriate Indian language voices across devices. This was the core problem the decision aimed to solve.                                                  |
| Integrate Azure Cognitive Services Speech for TTS          | While a viable cloud alternative, Google Cloud TTS was selected due to its robust offering of Neural2 voices for critical Indian languages (en-IN, hi-IN), perceived ease of integration within the existing Google ecosystem (Gemini), and current team familiarity. |
| Self-host an open-source TTS model (e.g., Coqui TTS, VITS) | Higher operational overhead (model deployment, resource management, scaling), potentially lower quality or fewer regional voice options compared to managed cloud providers, and significant development effort to achieve comparable quality and language coverage.  |

## Consequences

**Positive:**

- Consistent, high-quality voice output for triage results across all browsers and devices.
- Improved user experience with natural-sounding regional Indian voices.
- Enhanced reliability of the Voice Triage flow due to structured Gemini output, preventing parsing errors.
- More robust ASR service with graceful error handling for `ffmpeg` dependency issues.
- Reduced frontend complexity by offloading TTS synthesis to a dedicated backend service.

**Trade-offs:**

- Introduced a dependency on a third-party cloud service (Google Cloud TTS), incurring potential costs and vendor lock-in.
- Increased complexity in the ML service with a new router, external API calls, and credential management (`GOOGLE_APPLICATION_CREDENTIALS`).
- Added network latency for TTS synthesis compared to purely client-side native TTS.

## Related Issues & PRs

- PR #1242: feat(voice): add cloud Text-to-Speech for Voice Triage results
- Issue #522
