"use client";

import { useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { useVoiceRecorder, type VoiceRecorderError } from "@/hooks/useVoiceRecorder";
import { transcribeRecordedAudio } from "@/app/[locale]/voice/lib/transcription";

export interface VoiceInputLabels {
    /** aria-label for the idle mic button. */
    button: string;
    /** Shown while recording (also the stop-button aria-label). */
    listening: string;
    /** Shown while transcribing + extracting. */
    processing: string;
    /** Browser lacks microphone recording support. */
    unsupported: string;
    /** Mic permission denied / unavailable. */
    permissionDenied: string;
    /** Generic transcription/extraction failure. */
    error: string;
    /** Audio understood but no medicine name found. */
    noMedicines: string;
}

interface VoiceInputButtonProps {
    /** Called with the medicine names extracted from speech. */
    onMedicinesExtracted: (medicines: string[]) => void;
    labels: VoiceInputLabels;
    /** Optional BCP-47 hint passed to the transcription service. */
    language?: string;
    disabled?: boolean;
    className?: string;
}

function extensionForType(type: string): string {
    if (type.includes("mp4")) return "mp4";
    if (type.includes("ogg")) return "ogg";
    if (type.includes("wav")) return "wav";
    return "webm";
}

/**
 * One-tap microphone button that captures speech, transcribes it, and extracts
 * medicine names — letting users add medicines without typing hard-to-spell
 * drug names. Reuses the existing recording + transcription plumbing and the
 * /api/voice/medicine-extract endpoint; the caller decides what to do with the
 * extracted names (e.g. populate a search/cart).
 */
export function VoiceInputButton({
    onMedicinesExtracted,
    labels,
    language,
    disabled = false,
    className = "",
}: VoiceInputButtonProps) {
    const {
        isSupported,
        isRecording,
        error: recorderError,
        start,
        stop,
        reset,
    } = useVoiceRecorder();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusError, setStatusError] = useState<string | null>(null);

    const recorderErrorMessage = (err: VoiceRecorderError | null): string | null => {
        switch (err) {
            case "unsupported":
                return labels.unsupported;
            case "permission":
                return labels.permissionDenied;
            case "too-large":
            case "empty":
                return labels.noMedicines;
            case "unknown":
                return labels.error;
            default:
                return null;
        }
    };

    const message = statusError ?? recorderErrorMessage(recorderError);

    const handleStart = async () => {
        setStatusError(null);
        reset();
        await start();
    };

    const handleStop = async () => {
        setIsProcessing(true);
        try {
            const blob = await stop();
            if (!blob) {
                // Hook already set an appropriate error (permission/empty/too-large).
                return;
            }

            const file = new File([blob], `voice-input.${extensionForType(blob.type)}`, {
                type: blob.type,
            });

            const { transcript } = await transcribeRecordedAudio(file, language);
            if (!transcript.trim()) {
                setStatusError(labels.noMedicines);
                return;
            }

            const response = await fetch("/api/voice/medicine-extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: transcript }),
            });
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                setStatusError(
                    data && typeof data.error === "string" && data.error.trim()
                        ? data.error
                        : labels.error
                );
                return;
            }

            const medicines: string[] = Array.isArray(data?.medicines)
                ? data.medicines.filter((name: unknown): name is string => typeof name === "string")
                : [];

            if (medicines.length === 0) {
                setStatusError(labels.noMedicines);
                return;
            }

            onMedicinesExtracted(medicines);
        } catch {
            setStatusError(labels.error);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isSupported) {
        // Nothing to render if the browser can't record — keeps the layout clean.
        return null;
    }

    const busy = isProcessing;
    const label = busy ? labels.processing : isRecording ? labels.listening : labels.button;

    return (
        <div className={`flex flex-col items-center ${className}`}>
            <button
                type="button"
                onClick={isRecording ? handleStop : handleStart}
                disabled={disabled || busy}
                aria-label={label}
                aria-pressed={isRecording}
                title={label}
                className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition disabled:opacity-50 ${
                    isRecording
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                } focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:outline-none`}
            >
                {isRecording && (
                    // Animated pulse ring communicates "listening" at a glance.
                    <span
                        aria-hidden="true"
                        className="absolute inset-0 animate-ping rounded-xl bg-red-500 opacity-60"
                    />
                )}
                <span className="relative flex items-center justify-center">
                    {busy ? (
                        <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                    ) : isRecording ? (
                        <Square size={18} aria-hidden="true" />
                    ) : (
                        <Mic size={20} aria-hidden="true" />
                    )}
                </span>
            </button>

            {(isRecording || busy || message) && (
                <span
                    role="status"
                    aria-live="polite"
                    className={`mt-1 max-w-[8rem] text-center text-xs font-semibold ${
                        message && !isRecording && !busy
                            ? "text-red-600 dark:text-red-400"
                            : "text-(--color-text-muted)"
                    }`}
                >
                    {message && !isRecording && !busy ? message : label}
                </span>
            )}
        </div>
    );
}
