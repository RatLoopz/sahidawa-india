"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    MAX_RECORDING_DURATION_MS,
    getPreferredRecordingMimeType,
    isRecordingBlobTooLarge,
    supportsAudioRecording,
} from "@/app/[locale]/voice/lib/recording";

export type VoiceRecorderError = "unsupported" | "permission" | "too-large" | "empty" | "unknown";

export interface UseVoiceRecorder {
    /** True only after mount, once we know the browser supports MediaRecorder. */
    isSupported: boolean;
    isRecording: boolean;
    error: VoiceRecorderError | null;
    /** Request the mic and begin recording. Sets `error` and stays idle on failure. */
    start: () => Promise<void>;
    /** Stop recording and resolve the captured audio (or null if nothing usable). */
    stop: () => Promise<Blob | null>;
    /** Clear any error state. */
    reset: () => void;
}

/**
 * Reusable microphone-capture hook.
 *
 * A thin wrapper around the existing voice recording primitives
 * (`app/[locale]/voice/lib/recording.ts`) so mic handling can be embedded
 * outside the large /voice page flow — e.g. a one-tap button on a search bar.
 * It deliberately owns only capture; transcription/extraction live in the caller.
 */
export function useVoiceRecorder(): UseVoiceRecorder {
    const [isSupported, setIsSupported] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<VoiceRecorderError | null>(null);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // MediaRecorder / getUserMedia are only available in the browser, so resolve
    // support after mount to avoid an SSR/client hydration mismatch.
    useEffect(() => {
        setIsSupported(
            typeof window !== "undefined" &&
                supportsAudioRecording(window) &&
                Boolean(navigator.mediaDevices?.getUserMedia)
        );
    }, []);

    const cleanup = useCallback(() => {
        if (autoStopRef.current) {
            clearTimeout(autoStopRef.current);
            autoStopRef.current = null;
        }
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
    }, []);

    // Stop the mic and release resources if the component unmounts mid-recording.
    useEffect(() => cleanup, [cleanup]);

    const reset = useCallback(() => setError(null), []);

    const start = useCallback(async () => {
        setError(null);

        if (recorderRef.current) {
            // Already recording — ignore duplicate starts.
            return;
        }

        if (typeof window === "undefined" || !supportsAudioRecording(window)) {
            setError("unsupported");
            return;
        }

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            setError("permission");
            return;
        }

        const mimeType = getPreferredRecordingMimeType(
            window.MediaRecorder as unknown as { isTypeSupported?: (t: string) => boolean }
        );

        let recorder: MediaRecorder;
        try {
            recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        } catch {
            stream.getTracks().forEach((track) => track.stop());
            setError("unknown");
            return;
        }

        chunksRef.current = [];
        recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                chunksRef.current.push(event.data);
            }
        };

        streamRef.current = stream;
        recorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);

        // Hard cap the recording length, matching the /voice page limit.
        autoStopRef.current = setTimeout(() => {
            if (recorderRef.current?.state === "recording") {
                recorderRef.current.stop();
            }
        }, MAX_RECORDING_DURATION_MS);
    }, []);

    const stop = useCallback((): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const recorder = recorderRef.current;

            if (!recorder || recorder.state === "inactive") {
                cleanup();
                setIsRecording(false);
                resolve(null);
                return;
            }

            recorder.onstop = () => {
                const type = recorder.mimeType || chunksRef.current[0]?.type || "audio/webm";
                const blob = new Blob(chunksRef.current, { type });
                chunksRef.current = [];
                cleanup();
                setIsRecording(false);

                if (blob.size === 0) {
                    setError("empty");
                    resolve(null);
                    return;
                }
                if (isRecordingBlobTooLarge(blob)) {
                    setError("too-large");
                    resolve(null);
                    return;
                }
                resolve(blob);
            };

            recorder.stop();
        });
    }, [cleanup]);

    return { isSupported, isRecording, error, start, stop, reset };
}
