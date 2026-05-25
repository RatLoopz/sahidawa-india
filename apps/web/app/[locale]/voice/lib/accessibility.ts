import type { VoiceErrorState, VoiceStep } from "../types";

export const VOICE_FOCUS_RING_CLASS =
    "focus-visible:outline-[3px] focus-visible:outline-emerald-600 focus-visible:outline-offset-2 focus-visible:ring-[3px] focus-visible:ring-emerald-600 focus-visible:ring-offset-2";

type VoiceAnnouncementCopy = {
    emergencyTitle: string;
    errorPrefix: string;
    listeningStatus: string;
    processingStarted: string;
    processingSubtitle: string;
    recordingStarted: string;
    resultHeading: string;
    resultSubheading: string;
    resultsReady: string;
    reviewMessage: string;
    reviewTitle: string;
};

export function shouldAutoFocusVoicePanel(step: VoiceStep) {
    return step !== "initial" && step !== "listening";
}

export function shouldHandleVoiceEscape({
    activeElementTagName,
    activeWithinVoiceRegion,
    isSpeaking,
    step,
}: {
    activeElementTagName?: string;
    activeWithinVoiceRegion: boolean;
    isSpeaking: boolean;
    step: VoiceStep;
}) {
    if (!activeWithinVoiceRegion) {
        return false;
    }

    const normalizedTagName = activeElementTagName?.toUpperCase();
    const isNativeInteractiveControl =
        normalizedTagName === "INPUT" ||
        normalizedTagName === "SELECT" ||
        normalizedTagName === "OPTION" ||
        normalizedTagName === "TEXTAREA";

    if (isNativeInteractiveControl) {
        return false;
    }

    if (isSpeaking) {
        return true;
    }

    return step === "listening" || step === "review" || step === "error" || step === "result";
}

export function getVoiceStepAnnouncement({
    copy,
    error,
    hasResult,
    isEmergency,
    step,
}: {
    copy: VoiceAnnouncementCopy;
    error: VoiceErrorState | null;
    hasResult: boolean;
    isEmergency: boolean;
    step: VoiceStep;
}) {
    switch (step) {
        case "initial":
            return "";
        case "listening":
            return `${copy.recordingStarted}. ${copy.listeningStatus}`;
        case "processing":
            return `${copy.processingStarted}. ${copy.processingSubtitle}`;
        case "review":
            return `${copy.reviewTitle}. ${copy.reviewMessage}`;
        case "result":
            if (!hasResult) {
                return "";
            }

            return isEmergency
                ? `${copy.resultsReady}. ${copy.resultHeading} - ${copy.emergencyTitle}. ${copy.resultSubheading}`
                : `${copy.resultsReady}. ${copy.resultHeading}. ${copy.resultSubheading}`;
        case "error":
            return error
                ? `${copy.errorPrefix} - ${error.title}. ${error.message}`
                : copy.errorPrefix;
    }
}
