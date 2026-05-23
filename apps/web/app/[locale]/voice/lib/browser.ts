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

export function findBestVoice(
    targetWindow: Window,
    preferredLanguage: string
): SpeechSynthesisVoice | undefined {
    const voices = targetWindow.speechSynthesis.getVoices();

    return (
        voices.find((voice) => voice.lang === preferredLanguage) ??
        voices.find((voice) => voice.lang.startsWith(preferredLanguage.split("-")[0])) ??
        voices[0]
    );
}
