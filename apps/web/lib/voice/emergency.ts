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
            "છાતીમાં દુખાવો",
            "છાતીમાં ભારેપણું",
            "છાતીમાં તીવ્ર દુખાવો",
            "ଛାତିରେ ବେଦନା",
            "ଛାତିରେ ଭୟଙ୍କର ବେଦନା",
            "ଛାତି ଭାରି ଲାଗୁଛି",
            "ਛਾਤੀ ਵਿੱਚ ਦਰਦ",
            "ਛਾਤੀ ਵਿੱਚ ਭਾਰੀਪਨ",
            "ਛਾਤੀ ਵਿੱਚ ਤੇਜ਼ ਦਰਦ",
            "നെഞ്ചുവേദന",
            "കടുത്ത നെഞ്ചുവേദന",
            "നെഞ്ചിൽ ഭാരമുള്ളതായി തോന്നുന്നു",
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
            "શ્વાસ લેવામાં તકલીફ",
            "શ્વાસ નથી આવી રહ્યો",
            "શ્વાસ લેવામાં મુશ્કેલી",
            "ଶ୍ୱାସ ନେବାରେ ଅସୁବିଧା",
            "ଶ୍ୱାସ ନେଇ ପାରୁନାହିଁ",
            "ଶ୍ୱାସକଷ୍ଟ",
            "ਸਾਹ ਲੈਣ ਵਿੱਚ ਦਿੱਕਤ",
            "ਸਾਹ ਨਹੀਂ ਆ ਰਿਹਾ",
            "ਸਾਹ ਚੜ੍ਹ ਰਿਹਾ ਹੈ",
            "ശ്വാസം എടുക്കാൻ ബുദ്ധിമുട്ട്",
            "ശ്വാസം കിട്ടുന്നില്ല",
            "ശ്വാസതടസം",
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
            "બેહોશ",
            "હોશમાં નથી",
            "બેભાન",
            "ଅଚେତ",
            "ହୋସ ନାହିଁ",
            "ବେହୋସ",
            "ਬੇਹੋਸ਼",
            "ਹੋਸ਼ ਨਹੀਂ ਹੈ",
            "ਬੇਸੁੱਧ",
            "ബോധമില്ല",
            "ബോധരഹിതൻ",
            "ബോധം നഷ്ടപ്പെട്ടു",
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
            "ખીંચાવો આવી રહ્યા છે",
            "દૌરો આવ્યો",
            "આંચકા આવી રહ્યા છે",
            "ଖିଁଚୁଣି",
            "ଦୌରା",
            "ଶରୀର କମ୍ପୁଛି",
            "ਦੌਰਾ ਪਿਆ",
            "ਝਟਕੇ ਲੱਗ ਰਹੇ ਹਨ",
            "ਖਿੱਚਾਂ ਪੈ ਰਹੀਆਂ ਹਨ",
            "അപസ്മാരം",
            "വലിവ്",
            "ശരീരം വിറയ്ക്കുന്നു",
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
            "ચહેરો વાંકો થઈ ગયો",
            "બોલવામાં તકલીફ",
            "શરીરના એક ભાગમાં નબળાઈ",
            "ମୁହଁ ବାଙ୍କିଯାଇଛି",
            "କଥା କହିବାରେ ଅସୁବିଧା",
            "ଶରୀରର ଗୋଟିଏ ପାର୍ଶ୍ୱ ଦୁର୍ବଳ",
            "ਚਿਹਰਾ ਟੇਢਾ ਹੋ ਗਿਆ",
            "ਬੋਲਣ ਵਿੱਚ ਦਿੱਕਤ",
            "ਸਰੀਰ ਦੇ ਇੱਕ ਪਾਸੇ ਕਮਜ਼ੋਰੀ",
            "മുഖം വളഞ്ഞിരിക്കുന്നു",
            "സംസാരിക്കാൻ ബുദ്ധിമുട്ട്",
            "ശരീരത്തിന്റെ ഒരു വശം ദുർബലം",
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
            "ઘણું લોહી વહી રહ્યું છે",
            "રક્તસ્રાવ બંધ થતો નથી",
            "ભારે રક્તસ્રાવ",
            "ଅଧିକ ରକ୍ତସ୍ରାବ",
            "ରକ୍ତ ବନ୍ଦ ହେଉନାହିଁ",
            "ବହୁତ ରକ୍ତ ବହୁଛି",
            "ਬਹੁਤ ਖੂਨ ਵਹਿ ਰਿਹਾ ਹੈ",
            "ਖੂਨ ਨਹੀਂ ਰੁਕ ਰਿਹਾ",
            "ਜ਼ਿਆਦਾ ਖੂਨ ਵਹਿ ਰਿਹਾ ਹੈ",
            "അമിത രക്തസ്രാവം",
            "രക്തസ്രാവം നിൽക്കുന്നില്ല",
            "വളരെ രക്തം ഒഴുകുന്നു",
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
