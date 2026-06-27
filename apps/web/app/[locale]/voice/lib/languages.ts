export type VoiceLanguageOption = {
    value: string;
    label: string;
    speechRecognition: string;
    responseLanguage: string;
    speechSynthesisLang: string;
};

export const DEFAULT_VOICE_LANGUAGE = "en-IN";

const LOCALE_TO_VOICE_LANGUAGE: Record<string, string> = {
    en: "en-IN",
    hi: "hi-IN",
    ta: "ta-IN",
    bn: "bn-IN",
    mr: "mr-IN",
    te: "te-IN",
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
