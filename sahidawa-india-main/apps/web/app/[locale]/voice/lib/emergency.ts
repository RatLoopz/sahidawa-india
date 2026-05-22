const EMERGENCY_PHRASES = [
    "chest pain",
    "breathing difficulty",
    "difficulty breathing",
    "trouble breathing",
    "shortness of breath",
    "unconscious",
    "seizure",
    "stroke symptoms",
    "severe bleeding",
    "behosh",
    "saans lene mein dikkat",
] as const;

export type EmergencyDetectionResult = {
    isEmergency: boolean;
    matches: string[];
};

function normalizeTranscript(transcript: string) {
    return transcript
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function detectEmergencyKeywords(transcript: string): EmergencyDetectionResult {
    const normalizedTranscript = normalizeTranscript(transcript);
    const matches = EMERGENCY_PHRASES.filter((phrase) => normalizedTranscript.includes(phrase));

    return {
        isEmergency: matches.length > 0,
        matches: [...matches],
    };
}
