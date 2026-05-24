export type SpeechRecognitionLike = {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    maxAlternatives: number;
    onstart: (() => void) | null;
    onresult: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
};

export type SpeechSynthesisVoiceMatch = {
    voice?: SpeechSynthesisVoice;
    supportLevel: "exact" | "language" | "fallback" | "unknown";
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type WindowWithSpeechRecognition = Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function getSpeechRecognitionConstructor(
    targetWindow: Window
): SpeechRecognitionConstructor | null {
    const speechWindow = targetWindow as WindowWithSpeechRecognition;

    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function supportsSpeechSynthesis(targetWindow: Window) {
    return "speechSynthesis" in targetWindow && "SpeechSynthesisUtterance" in targetWindow;
}

export function stopSpeaking(targetWindow: Window) {
    if (supportsSpeechSynthesis(targetWindow)) {
        targetWindow.speechSynthesis.cancel();
    }
}

export function resolveSpeechSynthesisVoice(
    targetWindow: Window,
    preferredLanguage: string
): SpeechSynthesisVoiceMatch {
    const voices = targetWindow.speechSynthesis.getVoices();
    if (!voices.length) {
        return { voice: undefined, supportLevel: "unknown" };
    }

    const exactMatch = voices.find((voice) => voice.lang === preferredLanguage);
    if (exactMatch) {
        return { voice: exactMatch, supportLevel: "exact" };
    }

    const primaryLanguage =
        preferredLanguage.split("-")[0]?.toLowerCase() ?? preferredLanguage.toLowerCase();
    const languageMatch = voices.find((voice) =>
        voice.lang.toLowerCase().startsWith(primaryLanguage)
    );
    if (languageMatch) {
        return { voice: languageMatch, supportLevel: "language" };
    }

    return { voice: voices[0], supportLevel: "fallback" };
}

export function findBestVoice(
    targetWindow: Window,
    preferredLanguage: string
): SpeechSynthesisVoice | undefined {
    return resolveSpeechSynthesisVoice(targetWindow, preferredLanguage).voice;
}
