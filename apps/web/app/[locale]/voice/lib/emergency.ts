const EMERGENCY_PHRASES = [
    // English phrases
    "chest pain",
    "breathing difficulty",
    "difficulty breathing",
    "trouble breathing",
    "shortness of breath",
    "unconscious",
    "seizure",
    "stroke symptoms",
    "severe bleeding",
    "heart attack",
    "suffocating",
    "cannot breathe",
    "severe headache",
    "loss of consciousness",
    "heavy bleeding",
    "choking",

    // Hindi phrases
    "behosh",
    "saans lene mein dikkat",
    "saans nahi aa raha",
    "chest mein dard",
    "chati mein dard",
    "dil mein dard",
    "heart attack",
    "nadi ka aata hona",
    "seize",
    "convulsion",
    "tez bukhar",
    "bahar se khoon",
    "khun bahar ana",
    "sakht khun bahar ana",
    "choking ho gaya",
    "sutli gaya",
    "gira hua",
    "gir gaya",
    "dil tez chal raha",
    "zyada bleeding",
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
