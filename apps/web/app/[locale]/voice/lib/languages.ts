export type VoiceLanguageOption = {
    value: string;
    label: string;
    speechRecognition: string;
    responseLanguage: string;
    speechSynthesisLang: string;
};

// Shape returned by GET /api/medicine/languages (proxied from the ML
// service's /voice/languages endpoint). Keys are 2-letter ISO codes
// (e.g. "hi", "ta"), values are the script name — the script isn't
// used here, we only care which codes are present.
export type SupportedVoiceLanguagesResponse = {
    supported_languages: Record<string, string>;
};

export const DEFAULT_VOICE_LANGUAGE = "en-IN";

const LOCALE_TO_VOICE_LANGUAGE: Record<string, string> = {
    en: "en-IN",
    hi: "hi-IN",
    ta: "ta-IN",
    bn: "bn-IN",
    mr: "mr-IN",
    te: "te-IN",
    gu: "gu-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    or: "or-IN",
    pa: "pa-IN",
    as: "as-IN",
    ks: "ks-IN",
    kok: "kok-IN",
    mai: "mai-IN",
    mni: "mni-IN",
    sa: "sa-IN",
    sd: "sd-IN",
    ur: "ur-IN",
};

export const VOICE_LANGUAGE_OPTIONS: VoiceLanguageOption[] = [
    {
        value: "en-IN",
        label: "English",
        speechRecognition: "en-IN",
        responseLanguage: "English",
        speechSynthesisLang: "en-IN",
    },
    {
        value: "hi-IN",
        label: "हिन्दी (Hindi)",
        speechRecognition: "hi-IN",
        responseLanguage: "Hindi",
        speechSynthesisLang: "hi-IN",
    },
    {
        value: "ta-IN",
        label: "தமிழ் (Tamil)",
        speechRecognition: "ta-IN",
        responseLanguage: "Tamil",
        speechSynthesisLang: "ta-IN",
    },
    {
        value: "bn-IN",
        label: "বাংলা (Bengali)",
        speechRecognition: "bn-IN",
        responseLanguage: "Bengali",
        speechSynthesisLang: "bn-IN",
    },
    {
        value: "mr-IN",
        label: "मराठी (Marathi)",
        speechRecognition: "mr-IN",
        responseLanguage: "Marathi",
        speechSynthesisLang: "mr-IN",
    },
    {
        value: "te-IN",
        label: "తెలుగు (Telugu)",
        speechRecognition: "te-IN",
        responseLanguage: "Telugu",
        speechSynthesisLang: "te-IN",
    },
    {
        value: "gu-IN",
        label: "ગુજરાતી (Gujarati)",
        speechRecognition: "gu-IN",
        responseLanguage: "Gujarati",
        speechSynthesisLang: "gu-IN",
    },
    {
        value: "kn-IN",
        label: "ಕನ್ನಡ (Kannada)",
        speechRecognition: "kn-IN",
        responseLanguage: "Kannada",
        speechSynthesisLang: "kn-IN",
    },
    {
        value: "ml-IN",
        label: "മലയാളം (Malayalam)",
        speechRecognition: "ml-IN",
        responseLanguage: "Malayalam",
        speechSynthesisLang: "ml-IN",
    },
    {
        value: "or-IN",
        label: "ଓଡ଼ିଆ (Odia)",
        speechRecognition: "or-IN",
        responseLanguage: "Odia",
        speechSynthesisLang: "or-IN",
    },
    {
        value: "pa-IN",
        label: "ਪੰਜਾਬੀ (Punjabi)",
        speechRecognition: "pa-IN",
        responseLanguage: "Punjabi",
        speechSynthesisLang: "pa-IN",
    },
    {
        value: "as-IN",
        label: "অসমীয়া (Assamese)",
        speechRecognition: "as-IN",
        responseLanguage: "Assamese",
        speechSynthesisLang: "as-IN",
    },
    {
        value: "ks-IN",
        label: "کشمیری (Kashmiri)",
        speechRecognition: "ks-IN",
        responseLanguage: "Kashmiri",
        speechSynthesisLang: "ks-IN",
    },
    {
        value: "kok-IN",
        label: "कोंकणी (Konkani)",
        speechRecognition: "kok-IN",
        responseLanguage: "Konkani",
        speechSynthesisLang: "kok-IN",
    },
    {
        value: "mai-IN",
        label: "मैथिली (Maithili)",
        speechRecognition: "mai-IN",
        responseLanguage: "Maithili",
        speechSynthesisLang: "mai-IN",
    },
    {
        value: "mni-IN",
        label: "ꯃꯤꯇꯩꯔꯣꯟ (Manipuri)",
        speechRecognition: "mni-IN",
        responseLanguage: "Manipuri",
        speechSynthesisLang: "mni-IN",
    },
    {
        value: "sa-IN",
        label: "संस्कृतम् (Sanskrit)",
        speechRecognition: "sa-IN",
        responseLanguage: "Sanskrit",
        speechSynthesisLang: "sa-IN",
    },
    {
        value: "sd-IN",
        label: "سنڌي (Sindhi)",
        speechRecognition: "sd-IN",
        responseLanguage: "Sindhi",
        speechSynthesisLang: "sd-IN",
    },
    {
        value: "ur-IN",
        label: "اردو (Urdu)",
        speechRecognition: "ur-IN",
        responseLanguage: "Urdu",
        speechSynthesisLang: "ur-IN",
    },
];

export function getVoiceLanguageOption(value: string): VoiceLanguageOption {
    return (
        VOICE_LANGUAGE_OPTIONS.find((option) => option.value === value) ?? VOICE_LANGUAGE_OPTIONS[0]
    );
}

export function resolveVoiceWorkflowLanguage(
    sessionLanguage: string | null | undefined,
    activeLanguage: string | null | undefined,
    selectedLanguage: string
) {
    if (sessionLanguage?.trim()) {
        return sessionLanguage;
    }

    return activeLanguage?.trim() ? activeLanguage : selectedLanguage;
}

export function getVoiceLanguageForLocale(locale: string): string {
    const normalized = locale.toLowerCase();

    return (
        LOCALE_TO_VOICE_LANGUAGE[normalized] ??
        LOCALE_TO_VOICE_LANGUAGE[normalized.split("-")[0]] ??
        DEFAULT_VOICE_LANGUAGE
    );
}

/**
 * Filters VOICE_LANGUAGE_OPTIONS down to the languages the ML voice
 * pipeline currently supports, matching on the 2-letter language
 * prefix of each option's locale code (e.g. "hi-IN" -> "hi").
 *
 * VOICE_LANGUAGE_OPTIONS stays the source of display metadata
 * (labels, speech-recognition codes) — this only decides which of
 * those options are currently selectable.
 *
 * If filtering would remove every option (e.g. an unrecognised
 * response shape from the backend), the full hardcoded list is kept
 * instead of leaving the picker empty.
 */
export function filterSupportedVoiceLanguages(
    supportedCodes: Iterable<string>,
    options: VoiceLanguageOption[] = VOICE_LANGUAGE_OPTIONS
): VoiceLanguageOption[] {
    const normalizedSupported = new Set(
        Array.from(supportedCodes, (code) => code.trim().toLowerCase()).filter(Boolean)
    );

    if (normalizedSupported.size === 0) {
        return options;
    }

    const filtered = options.filter((option) =>
        normalizedSupported.has(option.value.split("-")[0].toLowerCase())
    );

    return filtered.length > 0 ? filtered : options;
}

/**
 * Fetches the list of Indian languages the ML voice pipeline currently
 * supports via GET /api/medicine/languages, and uses it to filter
 * VOICE_LANGUAGE_OPTIONS down to just the currently-selectable ones.
 *
 * Falls back to the full hardcoded VOICE_LANGUAGE_OPTIONS list if the
 * request fails, times out, or the service returns an unexpected
 * shape — the picker should always render something, never break.
 */
export async function fetchSupportedVoiceLanguages(
    apiBase: string,
    options: { signal?: AbortSignal } = {}
): Promise<VoiceLanguageOption[]> {
    try {
        const res = await fetch(`${apiBase}/api/medicine/languages`, {
            signal: options.signal,
        });

        if (!res.ok) {
            return VOICE_LANGUAGE_OPTIONS;
        }

        const data = (await res.json()) as Partial<SupportedVoiceLanguagesResponse>;
        const supportedCodes = data?.supported_languages;

        if (!supportedCodes || typeof supportedCodes !== "object") {
            return VOICE_LANGUAGE_OPTIONS;
        }

        return filterSupportedVoiceLanguages(Object.keys(supportedCodes));
    } catch {
        // Network failure, abort, timeout, or malformed JSON — degrade
        // gracefully to the full hardcoded list rather than breaking
        // the picker.
        return VOICE_LANGUAGE_OPTIONS;
    }
}
