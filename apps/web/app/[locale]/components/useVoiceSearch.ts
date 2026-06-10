"use client";

import { useCallback, useRef, useState } from "react";

const PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
const MAX_RECORDING_MS = 10_000;

function getSupportedMimeType(): string {
    if (typeof window === "undefined") return "";
    const MR = window.MediaRecorder;
    if (!MR) return "";
    return PREFERRED_MIME_TYPES.find((t) => MR.isTypeSupported(t)) ?? "";
}

function supportsRecording(): boolean {
    return typeof window !== "undefined" && "MediaRecorder" in window;
}

export type VoiceSearchState =
    | { status: "idle" }
    | { status: "requesting" }
    | { status: "recording" }
    | { status: "transcribing" }
    | { status: "error"; message: string };

export type VoiceSearchResult = {
    transcript: string;
};

export function useVoiceSearch() {
    const [state, setState] = useState<VoiceSearchState>({ status: "idle" });
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cleanup = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            try {
                mediaRecorderRef.current.stop();
            } catch { }
        }
        mediaRecorderRef.current = null;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        chunksRef.current = [];
    }, []);

    const startRecording = useCallback(
        (language?: string): Promise<VoiceSearchResult> => {
            return new Promise((resolve, reject) => {
                if (!supportsRecording()) {
                    setState({ status: "error", message: "Voice search is not supported in this browser." });
                    reject(new Error("MediaRecorder not supported"));
                    return;
                }

                setState({ status: "requesting" });

                navigator.mediaDevices
                    .getUserMedia({ audio: true })
                    .then((stream) => {
                        streamRef.current = stream;
                        const mimeType = getSupportedMimeType();
                        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
                        mediaRecorderRef.current = recorder;
                        chunksRef.current = [];

                        recorder.ondataavailable = (e) => {
                            if (e.data.size > 0) chunksRef.current.push(e.data);
                        };

                        recorder.onerror = () => {
                            cleanup();
                            setState({ status: "error", message: "Recording failed." });
                            reject(new Error("MediaRecorder error"));
                        };

                        recorder.onstop = () => {
                            const blob = new Blob(chunksRef.current, {
                                type: mimeType || "audio/webm",
                            });
                            if (blob.size === 0) {
                                cleanup();
                                setState({ status: "error", message: "No audio captured." });
                                reject(new Error("Empty recording"));
                                return;
                            }

                            setState({ status: "transcribing" });

                            const formData = new FormData();
                            formData.append("file", blob, "voice-search.webm");
                            if (language) formData.append("language", language);

                            fetch("/api/voice/transcribe", { method: "POST", body: formData })
                                .then(async (res) => {
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error || "Transcription failed.");
                                    const transcript = (data.transcript || "").trim();
                                    if (!transcript) {
                                        cleanup();
                                        setState({ status: "error", message: "No speech detected." });
                                        reject(new Error("Empty transcript"));
                                        return;
                                    }
                                    cleanup();
                                    setState({ status: "idle" });
                                    resolve({ transcript });
                                })
                                .catch((err) => {
                                    cleanup();
                                    setState({ status: "error", message: err.message });
                                    reject(err);
                                });
                        };

                        recorder.start();
                        setState({ status: "recording" });

                        timeoutRef.current = setTimeout(() => {
                            if (recorder.state !== "inactive") {
                                recorder.stop();
                            }
                        }, MAX_RECORDING_MS);
                    })
                    .catch((err: DOMException) => {
                        cleanup();
                        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                            setState({ status: "error", message: "Microphone permission denied." });
                        } else {
                            setState({ status: "error", message: "Could not access microphone." });
                        }
                        reject(err);
                    });
            });
        },
        [cleanup]
    );

    const cancelRecording = useCallback(() => {
        cleanup();
        setState({ status: "idle" });
    }, [cleanup]);

    return { state, startRecording, cancelRecording, supportsRecording: supportsRecording() };
}
