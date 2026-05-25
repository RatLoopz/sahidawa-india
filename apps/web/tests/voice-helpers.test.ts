import { getConfidenceMeta } from "../app/[locale]/voice/lib/confidence";
import { resolveSpeechSynthesisVoice } from "../app/[locale]/voice/lib/browser";
import { detectEmergencyKeywords } from "../app/[locale]/voice/lib/emergency";
import {
    getVoiceStepAnnouncement,
    shouldHandleVoiceEscape,
    shouldAutoFocusVoicePanel,
} from "../app/[locale]/voice/lib/accessibility";
import {
    DEFAULT_VOICE_LANGUAGE,
    VOICE_LANGUAGE_OPTIONS,
    getVoiceLanguageOption,
    resolveVoiceWorkflowLanguage,
} from "../app/[locale]/voice/lib/languages";
import {
    getPreferredRecordingMimeType,
    supportsAudioRecording,
} from "../app/[locale]/voice/lib/recording";
import { formatVoiceShareReport } from "../app/[locale]/voice/lib/report";
import {
    normalizeVoiceTranscriptionResponse,
    shouldReviewTranscription,
    transcribeRecordedAudio,
} from "../app/[locale]/voice/lib/transcription";

describe("detectEmergencyKeywords", () => {
    it("re-exports the shared emergency detector through the app-local module", () => {
        const result = detectEmergencyKeywords("My father has chest pain right now");

        expect(result).toMatchObject({
            isEmergency: true,
            matchedGroups: ["chest_pain"],
        });
        expect(result.matches).toEqual(["chest pain"]);
    });

    it("keeps non-emergency transcripts safe through the re-export shim", () => {
        expect(detectEmergencyKeywords("I have a mild cough and fever since yesterday")).toEqual({
            isEmergency: false,
            matchedGroups: [],
            matches: [],
        });
    });
});

describe("getConfidenceMeta", () => {
    it("maps confidence values into labeled buckets", () => {
        expect(getConfidenceMeta(0.92)).toMatchObject({ label: "High", tone: "positive" });
        expect(getConfidenceMeta(0.72)).toMatchObject({ label: "Medium", tone: "caution" });
        expect(getConfidenceMeta(0.4)).toMatchObject({ label: "Low", tone: "critical" });
    });

    it("marks missing confidence as unavailable", () => {
        expect(getConfidenceMeta(undefined)).toMatchObject({
            label: "Unavailable",
            tone: "neutral",
            shouldReview: false,
        });
    });
});

describe("voice language config", () => {
    it("exposes the supported voice languages and a stable default", () => {
        expect(DEFAULT_VOICE_LANGUAGE).toBe("en-IN");
        expect(VOICE_LANGUAGE_OPTIONS.map((option) => option.value)).toEqual([
            "en-IN",
            "hi-IN",
            "ta-IN",
            "bn-IN",
            "mr-IN",
            "te-IN",
        ]);
    });

    it("looks up a language option by code", () => {
        expect(getVoiceLanguageOption("ta-IN")).toMatchObject({
            value: "ta-IN",
            responseLanguage: "Tamil",
        });
    });

    it("keeps the active workflow language stable after capture starts", () => {
        expect(resolveVoiceWorkflowLanguage(null, "bn-IN", "te-IN")).toBe("bn-IN");
        expect(resolveVoiceWorkflowLanguage(null, null, "te-IN")).toBe("te-IN");
    });

    it("prefers the session snapshot over stale state on retry", () => {
        expect(resolveVoiceWorkflowLanguage("te-IN", "bn-IN", "te-IN")).toBe("te-IN");
    });
});

describe("voice recording helpers", () => {
    it("detects when MediaRecorder support exists", () => {
        expect(supportsAudioRecording({ MediaRecorder: class {} } as Window)).toBe(true);
        expect(supportsAudioRecording({} as Window)).toBe(false);
    });

    it("picks a supported recording mime type when available", () => {
        const mediaRecorderMock = {
            isTypeSupported: (value: string) => value === "audio/webm;codecs=opus",
        };

        expect(getPreferredRecordingMimeType(mediaRecorderMock)).toBe("audio/webm;codecs=opus");
    });

    it("falls back to an empty mime type when none of the preferred formats are supported", () => {
        const mediaRecorderMock = {
            isTypeSupported: () => false,
        };

        expect(getPreferredRecordingMimeType(mediaRecorderMock)).toBe("");
    });
});

describe("speech synthesis voice fallback", () => {
    it("returns an exact match when the browser supports the selected language", () => {
        const matchingVoice = { lang: "bn-IN", name: "Bengali voice" } as SpeechSynthesisVoice;
        const nonMatchingVoice = { lang: "en-US", name: "English voice" } as SpeechSynthesisVoice;

        expect(
            resolveSpeechSynthesisVoice(
                {
                    speechSynthesis: {
                        getVoices: () => [nonMatchingVoice, matchingVoice],
                    },
                } as Window,
                "bn-IN"
            )
        ).toMatchObject({
            voice: matchingVoice,
            supportLevel: "exact",
        });
    });

    it("surfaces a fallback when no matching TTS voice is available", () => {
        const fallbackVoice = { lang: "en-US", name: "English voice" } as SpeechSynthesisVoice;

        expect(
            resolveSpeechSynthesisVoice(
                {
                    speechSynthesis: {
                        getVoices: () => [fallbackVoice],
                    },
                } as Window,
                "te-IN"
            )
        ).toMatchObject({
            voice: fallbackVoice,
            supportLevel: "fallback",
        });
    });
});

describe("voice transcription response normalization", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.resetAllMocks();
    });

    it("normalizes transcript, language, and language confidence", () => {
        expect(
            normalizeVoiceTranscriptionResponse({
                transcript: "  fever for two days  ",
                language: "en",
                languageConfidence: 0.61,
            })
        ).toEqual({
            transcript: "fever for two days",
            language: "en",
            languageConfidence: 0.61,
        });
    });

    it("propagates the selected language hint when uploading audio", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                transcript: "kaaychal irukku",
                language: "ta",
                languageConfidence: 0.78,
            }),
        }) as unknown as typeof fetch;

        await transcribeRecordedAudio(
            new File(["audio"], "voice.webm", { type: "audio/webm" }),
            "ta-IN"
        );

        const requestBody = (global.fetch as jest.Mock).mock.calls[0][1].body as FormData;
        expect(requestBody.get("language")).toBe("ta-IN");
    });

    it("returns a friendly error when the proxy sends invalid JSON", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            json: async () => {
                throw new SyntaxError("Unexpected token <");
            },
        }) as unknown as typeof fetch;

        await expect(
            transcribeRecordedAudio(new File(["audio"], "voice.webm", { type: "audio/webm" }))
        ).rejects.toThrow("Transcription failed.");
    });

    it("requests manual review for very short transcripts when ASR word confidence is unavailable", () => {
        expect(shouldReviewTranscription("fever")).toBe(true);
        expect(shouldReviewTranscription("I have fever and cough")).toBe(false);
    });

    it("requests review when the detected language does not match the selected language", () => {
        expect(
            shouldReviewTranscription("எனக்கு காய்ச்சல் இருக்கு", {
                selectedLanguage: "ta-IN",
                detectedLanguage: "en",
            })
        ).toBe(true);
        expect(
            shouldReviewTranscription("எனக்கு காய்ச்சல் இருக்கு", {
                selectedLanguage: "ta-IN",
                detectedLanguage: "ta",
            })
        ).toBe(false);
    });
});

describe("formatVoiceShareReport", () => {
    it("includes the transcript, advice, emergency state, and disclaimer", () => {
        const report = formatVoiceShareReport({
            timestamp: "2026-05-19T10:00:00.000Z",
            selectedLanguageLabel: "Hindi",
            transcript: "Mujhe saans lene mein dikkat ho rahi hai",
            confidenceLabel: "Low",
            emergency: true,
            summary: "You may need urgent medical attention.",
            recommendations: ["Call 112 immediately", "Seek help from a nearby clinic"],
            disclaimer: "This is not a diagnosis. Consult a doctor.",
        });

        expect(report).toContain("Language: Hindi");
        expect(report).toContain("Transcript: Mujhe saans lene mein dikkat ho rahi hai");
        expect(report).toContain("Confidence: Low");
        expect(report).toContain("Emergency Alert: Yes");
        expect(report).toContain("1. Call 112 immediately");
        expect(report).toContain("Disclaimer: This is not a diagnosis. Consult a doctor.");
    });
});

describe("shouldAutoFocusVoicePanel", () => {
    it("keeps focus on the mic button while listening", () => {
        expect(shouldAutoFocusVoicePanel("listening")).toBe(false);
    });

    it("moves focus to the active panel for review, processing, result, and error states", () => {
        expect(shouldAutoFocusVoicePanel("review")).toBe(true);
        expect(shouldAutoFocusVoicePanel("processing")).toBe(true);
        expect(shouldAutoFocusVoicePanel("result")).toBe(true);
        expect(shouldAutoFocusVoicePanel("error")).toBe(true);
    });

    it("does not auto-focus the panel on the initial state", () => {
        expect(shouldAutoFocusVoicePanel("initial")).toBe(false);
    });
});

describe("getVoiceStepAnnouncement", () => {
    const copy = {
        emergencyTitle: "Seek immediate medical attention",
        errorPrefix: "Something went wrong",
        listeningStatus: "Listening for symptoms",
        processingStarted: "Processing your symptoms",
        processingSubtitle: "Checking your symptoms with SahiDawa AI…",
        recordingStarted: "Recording started",
        resultHeading: "AI Analysis",
        resultSubheading: "Medical Triage",
        resultsReady: "Results ready",
        reviewMessage: "Please review the transcript before continuing.",
        reviewTitle: "Review transcript",
    };

    it("announces the active voice flow state with explicit listening and result copy", () => {
        expect(
            getVoiceStepAnnouncement({
                copy,
                error: null,
                hasResult: false,
                isEmergency: false,
                step: "listening",
            })
        ).toBe("Recording started. Listening for symptoms");

        expect(
            getVoiceStepAnnouncement({
                copy,
                error: null,
                hasResult: true,
                isEmergency: false,
                step: "result",
            })
        ).toBe("Results ready. AI Analysis. Medical Triage");
    });

    it("includes emergency and error details when they are present", () => {
        expect(
            getVoiceStepAnnouncement({
                copy,
                error: null,
                hasResult: true,
                isEmergency: true,
                step: "result",
            })
        ).toBe("Results ready. AI Analysis - Seek immediate medical attention. Medical Triage");

        expect(
            getVoiceStepAnnouncement({
                copy,
                error: {
                    title: "Microphone blocked",
                    message: "Please allow microphone access and try again.",
                },
                hasResult: false,
                isEmergency: false,
                step: "error",
            })
        ).toBe(
            "Something went wrong - Microphone blocked. Please allow microphone access and try again."
        );
    });
});

describe("shouldHandleVoiceEscape", () => {
    it("only handles escape inside the voice region for supported voice states", () => {
        expect(
            shouldHandleVoiceEscape({
                activeElementTagName: "BUTTON",
                activeWithinVoiceRegion: true,
                isSpeaking: false,
                step: "review",
            })
        ).toBe(true);

        expect(
            shouldHandleVoiceEscape({
                activeElementTagName: "BUTTON",
                activeWithinVoiceRegion: false,
                isSpeaking: false,
                step: "review",
            })
        ).toBe(false);
    });

    it("does not hijack escape for native form controls inside the voice region", () => {
        expect(
            shouldHandleVoiceEscape({
                activeElementTagName: "SELECT",
                activeWithinVoiceRegion: true,
                isSpeaking: false,
                step: "review",
            })
        ).toBe(false);
    });

    it("allows escape to stop speaking when focus is still inside the voice region", () => {
        expect(
            shouldHandleVoiceEscape({
                activeElementTagName: "BUTTON",
                activeWithinVoiceRegion: true,
                isSpeaking: true,
                step: "result",
            })
        ).toBe(true);
    });
});
