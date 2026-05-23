import { detectEmergencyKeywords } from "../lib/voice/emergency";

describe("detectEmergencyKeywords", () => {
    it("finds grouped emergency phrases in normalized speech transcripts", () => {
        const result = detectEmergencyKeywords(
            "My father has CHEST pain, and trouble breathing right now!"
        );

        expect(result.isEmergency).toBe(true);
        expect(result.matchedGroups).toEqual(
            expect.arrayContaining(["chest_pain", "breathing_distress"])
        );
        expect(result.matches).toEqual(expect.arrayContaining(["chest pain", "trouble breathing"]));
    });

    it("matches multilingual emergency phrases", () => {
        const result = detectEmergencyKeywords("அவருக்கு மார்பு வலி மற்றும் மூச்சு விட கஷ்டம்");

        expect(result.isEmergency).toBe(true);
        expect(result.matchedGroups).toEqual(
            expect.arrayContaining(["chest_pain", "breathing_distress"])
        );
    });

    it("matches romanized regional emergency phrases", () => {
        const result = detectEmergencyKeywords("mujhe saans lene mein dikkat ho rahi hai");

        expect(result).toMatchObject({
            isEmergency: true,
            matchedGroups: expect.arrayContaining(["breathing_distress"]),
        });
        expect(result.matches).toEqual(expect.arrayContaining(["saans lene mein dikkat"]));
    });

    it("returns a safe result when no emergency terms are present", () => {
        expect(detectEmergencyKeywords("I have a mild cough and fever since yesterday")).toEqual({
            isEmergency: false,
            matchedGroups: [],
            matches: [],
        });
    });

    it("does not match emergency substrings inside unrelated words", () => {
        expect(detectEmergencyKeywords("This treatment fits my daily benefits program.")).toEqual({
            isEmergency: false,
            matchedGroups: [],
            matches: [],
        });
    });
});
