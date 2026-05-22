type EmergencyPhraseGroup = {
    id: string;
    phrases: readonly string[];
};

const EMERGENCY_PHRASE_GROUPS: readonly EmergencyPhraseGroup[] = [
    {
        id: "chest_pain",
        phrases: [
            "chest pain",
            "chest tightness",
            "pressure in chest",
            "severe chest pain",
            "सीने में दर्द",
            "छाती में दर्द",
            "বুকে ব্যথা",
            "মার্বে ব্যথা",
            "மார்பு வலி",
            "ఛాతి నొప్పి",
            "छातीत दुखत आहे",
            "seene mein dard",
            "chaati mein dard",
        ],
    },
    {
        id: "breathing_distress",
        phrases: [
            "breathing difficulty",
            "difficulty breathing",
            "trouble breathing",
            "shortness of breath",
            "cannot breathe",
            "hard to breathe",
            "saans lene mein dikkat",
            "saans nahi aa rahi",
            " सांस लेने में दिक्कत",
            "सांस लेने में दिक्कत",
            "শ্বাস নিতে কষ্ট",
            "மூச்சு விட கஷ்டம்",
            "மூச்சு திணறல்",
            "శ్వాస తీసుకోవడంలో ఇబ్బంది",
            "श्वास घ्यायला त्रास",
        ],
    },
    {
        id: "unconsciousness",
        phrases: [
            "unconscious",
            "passed out",
            "not waking up",
            "behosh",
            "बेहोश",
            "অজ্ঞান",
            "மயக்கம் ஆகிவிட்டார்",
            "స్పృహ లేదు",
            "बेशुद्ध",
        ],
    },
    {
        id: "seizure",
        phrases: [
            "seizure",
            "convulsions",
            " दौरा",
            "दौरा",
            "খিঁচুনি",
            "வலிப்பு",
            "పట్టు వచ్చింది",
            "झटके येत आहेत",
        ],
    },
    {
        id: "stroke_symptoms",
        phrases: [
            "stroke symptoms",
            "face drooping",
            "slurred speech",
            "one side weakness",
            "चेहरा टेढ़ा",
            "মুখ বেঁকে গেছে",
            "முகம் சாய்வு",
            "మాట తడబడటం",
            "चेहरा वाकडा",
        ],
    },
    {
        id: "severe_bleeding",
        phrases: [
            "severe bleeding",
            "bleeding heavily",
            "won't stop bleeding",
            "बहुत खून बह रहा है",
            "রক্তপাত হচ্ছে",
            "அதிக ரத்தப்போக்கு",
            "రక్తస్రావం ఎక్కువగా ఉంది",
            "खूप रक्तस्राव होत आहे",
        ],
    },
] as const;

type NormalizedEmergencyPhraseGroup = {
    id: string;
    phrases: readonly string[];
};

export type EmergencyDetectionResult = {
    isEmergency: boolean;
    matchedGroups: string[];
    matches: string[];
};

function normalizeSearchText(value: string) {
    return value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[\u200B-\u200D\uFEFF]/g, " ")
        .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsNormalizedPhrase(normalizedTranscript: string, normalizedPhrase: string) {
    return new RegExp(`(?:^|\\s)${escapeRegex(normalizedPhrase)}(?:$|\\s)`, "u").test(
        normalizedTranscript
    );
}

const NORMALIZED_EMERGENCY_PHRASE_GROUPS: readonly NormalizedEmergencyPhraseGroup[] =
    EMERGENCY_PHRASE_GROUPS.map((group) => ({
        id: group.id,
        phrases: group.phrases.map((phrase) => normalizeSearchText(phrase)),
    }));

export function normalizeTranscript(transcript: string) {
    return normalizeSearchText(transcript);
}

export function detectEmergencyKeywords(transcript: string): EmergencyDetectionResult {
    const normalizedTranscript = normalizeTranscript(transcript);
    const matchedGroups: string[] = [];
    const matches: string[] = [];

    for (const group of NORMALIZED_EMERGENCY_PHRASE_GROUPS) {
        const matchedPhrases = group.phrases.filter((phrase) =>
            containsNormalizedPhrase(normalizedTranscript, phrase)
        );

        if (matchedPhrases.length === 0) {
            continue;
        }

        matchedGroups.push(group.id);
        matches.push(...matchedPhrases);
    }

    return {
        isEmergency: matchedGroups.length > 0,
        matchedGroups,
        matches: [...new Set(matches)],
    };
}
