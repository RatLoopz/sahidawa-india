const PREFERRED_RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"] as const;

type MediaRecorderConstructorLike = {
    isTypeSupported?: (mimeType: string) => boolean;
};

export function supportsAudioRecording(targetWindow: Window): boolean {
    return (
        "MediaRecorder" in targetWindow &&
        typeof (targetWindow as Window & { MediaRecorder?: unknown }).MediaRecorder === "function"
    );
}

export function getPreferredRecordingMimeType(
    recorderConstructor: MediaRecorderConstructorLike | null
): string {
    if (!recorderConstructor?.isTypeSupported) {
        return "";
    }

    return (
        PREFERRED_RECORDING_TYPES.find((mimeType) =>
            recorderConstructor.isTypeSupported?.(mimeType)
        ) ?? ""
    );
}
