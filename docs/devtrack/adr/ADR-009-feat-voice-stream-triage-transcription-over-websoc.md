# ADR — feat(voice): stream triage transcription over websocket

> **Date:** 2026-05-24 | **PR:** #490 | **Status:** Accepted

## Context

The existing voice triage system relied on a monolithic audio upload for transcription, requiring users to complete their entire utterance before processing could begin. This introduced significant latency, delayed feedback to the user, and resulted in a suboptimal experience, particularly in rural health scenarios where immediate interaction and efficiency are critical. The need arose for a more responsive and real-time transcription experience to improve user engagement and system efficiency.

## Decision

Real-time, incremental voice triage transcription was implemented using WebSockets. A new `WS /asr/stream` endpoint was added to the FastAPI ML service, enabling continuous audio chunk processing and streaming of partial transcription results. The `apps/web` frontend was updated to utilize `MediaRecorder` to capture and stream audio chunks over this WebSocket, providing immediate, incremental transcript updates to the user interface. The existing monolithic HTTP POST upload flow (`/api/voice/transcribe`) was preserved as a robust fallback mechanism in case WebSocket streaming encountered failures. The core ML transcription logic was reused for both streaming and batch processing paths.

## Alternatives Considered

| Alternative                                                  | Why Rejected                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Periodic HTTP POST for audio chunks with polling for results | This approach would incur significant HTTP overhead for each audio chunk sent, leading to higher latency and less efficient resource utilization compared to a persistent WebSocket connection. Polling for results would further introduce delays and complexity in synchronizing client and server states for real-time updates.                                                                                      |
| Client-side ASR (Automatic Speech Recognition)               | While eliminating server latency, client-side ASR models are generally larger, less accurate, and more computationally intensive than server-side counterparts, especially for specialized domains like Indian medicine and diverse regional languages. This would limit device compatibility, increase client-side resource consumption, and potentially compromise the critical accuracy required for medical triage. |

## Consequences

**Positive:**

- **Improved User Experience:** Real-time feedback with incremental transcription significantly reduces perceived latency, making the voice triage process feel more responsive and natural.
- **Increased Efficiency:** Audio processing begins while the user is still speaking, potentially reducing the total time from utterance start to full transcription availability.
- **Enhanced Accessibility:** Provides immediate visual confirmation of spoken words, aiding users with hearing impairments or those who wish to verify their input.
- **Robustness:** The fallback to the existing HTTP upload ensures the system remains functional even if WebSocket streaming is not supported or fails due to network conditions.

**Trade-offs:**

- **Increased Complexity:** Introduced a new WebSocket communication layer on both frontend and ML service, requiring careful state management, error handling, and connection lifecycle management.
- **Network Requirements:** Real-time streaming is more sensitive to network stability and latency compared to a single file upload.
- **Resource Usage:** Maintaining persistent WebSocket connections can consume more server resources (memory, open connections) than stateless HTTP requests, especially with many concurrent users.

## Related Issues & PRs

- PR #490: feat(voice): stream triage transcription over websocket
- Issue #480
