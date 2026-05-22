import { getConfidenceMeta } from "../app/[locale]/voice/lib/confidence";
import { detectEmergencyKeywords } from "../app/[locale]/voice/lib/emergency";
import {
    DEFAULT_VOICE_LANGUAGE,
    VOICE_LANGUAGE_OPTIONS,
    getVoiceLanguageOption,
} from "../app/[locale]/voice/lib/languages";
import { formatVoiceShareReport } from "../app/[locale]/voice/lib/report";

describe("detectEmergencyKeywords", () => {
    it("finds emergency phrases in normalized speech transcripts", () => {
        const result = detectEmergencyKeywords(
            "My father has chest pain and trouble breathing right now"
        );

        expect(result.isEmergency).toBe(true);
        expect(result.matches).toEqual(expect.arrayContaining(["chest pain", "trouble breathing"]));
    });

    it("returns a safe result when no emergency terms are present", () => {
        expect(detectEmergencyKeywords("I have a mild cough and fever since yesterday")).toEqual({
            isEmergency: false,
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
