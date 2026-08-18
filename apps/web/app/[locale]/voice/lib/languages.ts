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

type LanguageMeta = [code: string, label: string, responseLanguage: string];

const LANGUAGE_DEFINITIONS: readonly LanguageMeta[] = [
    ["en", "English", "English"],
    ["hi", "हिन्दी (Hindi)", "Hindi"],
    ["ta", "தமிழ் (Tamil)", "Tamil"],
    ["bn", "বাংলা (Bengali)", "Bengali"],
    ["mr", "मराठी (Marathi)", "Marathi"],
    ["te", "తెలుగు (Telugu)", "Telugu"],
    ["gu", "ગુજરાતી (Gujarati)", "Gujarati"],
    ["kn", "ಕನ್ನಡ (Kannada)", "Kannada"],
    ["ml", "മലയാളം (Malayalam)", "Malayalam"],
    ["or", "ଓଡ଼ିଆ (Odia)", "Odia"],
    ["pa", "ਪੰਜਾਬੀ (Punjabi)", "Punjabi"],
    ["as", "অসমীয়া (Assamese)", "Assamese"],
    ["ks", "کشمیری (Kashmiri)", "Kashmiri"],
    ["kok", "कोंकणी (Konkani)", "Konkani"],
    ["mai", "मैथिली (Maithili)", "Maithili"],
    ["mni", "ꯃꯤꯇꯩꯔꯣꯟ (Manipuri)", "Manipuri"],
    ["sa", "संस्कृतम् (Sanskrit)", "Sanskrit"],
    ["sd", "سنڌي (Sindhi)", "Sindhi"],
    ["ur", "اردو (Urdu)", "Urdu"],
];

const LOCALE_TO_VOICE_LANGUAGE: Record<string, string> = Object.fromEntries(
    LANGUAGE_DEFINITIONS.map(([code]) => [code, `${code}-IN`])
);

export const VOICE_LANGUAGE_OPTIONS: VoiceLanguageOption[] = LANGUAGE_DEFINITIONS.map(
    ([code, label, responseLanguage]) => {
        const langTag = `${code}-IN`;
        return {
            value: langTag,
            label,
            speechRecognition: langTag,
            responseLanguage,
            speechSynthesisLang: langTag,
        };
    }
);

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
