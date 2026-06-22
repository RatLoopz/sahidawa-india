"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";

type VerificationResult = {
    medicine_name_original: string;
    medicine_name_english: string;
    medicine_name_regional: string;
    status: "verified" | "suspicious" | "not_found";
    manufacturer: string;
    category: string;
    cdsco_registered: boolean;
    warnings: string[];
    detected_language: string;
    script: string;
};

type ApiResponse = {
    success: boolean;
    transcribed: string;
    detected_language: string;
    script: string;
    verification: VerificationResult;
    error?: string;
};

export default function VoiceVerify() {
    const t = useTranslations("voiceVerify");

    const STATUS_CONFIG = {
        verified: {
            label: `✅ ${t("statusVerified")}`,
            bg: "bg-green-50",
            border: "border-green-400",
            text: "text-green-800",
            badge: "bg-green-100 text-green-800",
        },
        suspicious: {
            label: `⚠️ ${t("statusSuspicious")}`,
            bg: "bg-yellow-50",
            border: "border-yellow-400",
            text: "text-yellow-800",
            badge: "bg-yellow-100 text-yellow-800",
        },
        not_found: {
            label: `❌ ${t("statusNotFound")}`,
            bg: "bg-red-50",
            border: "border-red-400",
            text: "text-red-800",
            badge: "bg-red-100 text-red-800",
        },
    };

    const [isRecording, setIsRecording] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<ApiResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [audioLevel, setAudioLevel] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const animFrameRef = useRef<number | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const isMountedRef = useRef(true);

    const cleanupRecording = useCallback(() => {
        // Stop animation frame
        if (animFrameRef.current !== null) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }

        // Close AudioContext
        if (audioContextRef.current) {
            if (audioContextRef.current.state !== "closed") {
                audioContextRef.current.close().catch((err) => {
                    console.error("Failed to close AudioContext:", err);
                });
            }
            audioContextRef.current = null;
        }

        // Stop stream tracks
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => {
                if (track.readyState === "live") {
                    track.stop();
                }
            });
            streamRef.current = null;
        }

        // Reset level
        setAudioLevel(0);
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            cleanupRecording();
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop();
            }
        };
    }, [cleanupRecording]);

    const startRecording = useCallback(async () => {
        setError(null);
        setResult(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Visualize audio level
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            const draw = () => {
                if (
                    !isMountedRef.current ||
                    !audioContextRef.current ||
                    audioContextRef.current.state === "closed"
                )
                    return;
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                const avg = data.reduce((a, b) => a + b, 0) / data.length;
                setAudioLevel(avg / 128); // normalize 0–1
                animFrameRef.current = requestAnimationFrame(draw);
            };
            draw();

            // Start MediaRecorder
            const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                cleanupRecording();
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                await sendAudioToApi(blob);
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
        } catch {
            setError(t("errorMicDenied"));
        }
    }, [cleanupRecording, t]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, [isRecording]);

    const sendAudioToApi = async (blob: Blob) => {
        if (!isMountedRef.current) return;
        setIsLoading(true);
        try {
            const form = new FormData();
            form.append("audio", blob, "recording.webm");

            const res = await fetch("/api/medicine/verify-voice", {
                method: "POST",
                body: form,
            });

            const data: ApiResponse = await res.json();

            if (!isMountedRef.current) return;

            if (!res.ok || !data.success) {
                setError(data.error || t("errorNetwork"));
            } else {
                setResult(data);
            }
        } catch {
            if (!isMountedRef.current) return;
            setError(t("errorNetwork"));
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    };

    const reset = () => {
        setResult(null);
        setError(null);
    };

    const statusConfig = result ? STATUS_CONFIG[result.verification.status] : null;

    return (
        <div className="mx-auto max-w-md space-y-6 p-4">
            <div className="space-y-1 text-center">
                <h2 className="text-2xl font-bold text-gray-900">🩺 {t("heading")}</h2>
                <p className="text-sm text-gray-500">{t("subtitle")}</p>
            </div>

            {/* Mic Button */}
            {!result && (
                <div className="flex flex-col items-center gap-4">
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isLoading}
                        aria-label={isRecording ? t("ariaStopRecording") : t("ariaStartRecording")}
                        className={`relative flex h-24 w-24 items-center justify-center rounded-full text-4xl text-white shadow-lg transition-all duration-200 focus:ring-4 focus:outline-none ${
                            isRecording
                                ? "scale-110 bg-red-500 hover:bg-red-600 focus:ring-red-300"
                                : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-300"
                        } ${isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"} `}
                        style={
                            isRecording
                                ? {
                                      boxShadow: `0 0 0 ${8 + audioLevel * 20}px rgba(239,68,68,0.3)`,
                                  }
                                : undefined
                        }
                    >
                        {isLoading ? (
                            <span className="animate-spin text-2xl">⏳</span>
                        ) : isRecording ? (
                            "⏹"
                        ) : (
                            "🎙"
                        )}
                    </button>

                    <p className="text-center text-sm text-gray-500">
                        {isLoading
                            ? t("statusVerifying")
                            : isRecording
                              ? t("statusRecording")
                              : t("statusIdle")}
                    </p>

                    {/* Supported languages hint */}
                    <p className="text-center text-xs text-gray-400">{t("supportedLanguages")}</p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                    <button onClick={reset} className="mt-2 block text-xs underline">
                        {t("tryAgain")}
                    </button>
                </div>
            )}

            {/* Result Card */}
            {result && statusConfig && (
                <div
                    className={`rounded-2xl border-2 ${statusConfig.border} ${statusConfig.bg} space-y-4 p-5`}
                >
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                        <span className={`text-lg font-bold ${statusConfig.text}`}>
                            {statusConfig.label}
                        </span>
                        <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${statusConfig.badge}`}
                        >
                            CDSCO{" "}
                            {result.verification.cdsco_registered
                                ? t("cdscoRegistered")
                                : t("cdscoUnverified")}
                        </span>
                    </div>

                    {/* Medicine name in regional script */}
                    <div className="space-y-1">
                        <p className="text-xs tracking-wide text-gray-400 uppercase">
                            {t("scriptLabel", { script: result.script })}
                        </p>
                        <p className="text-2xl font-semibold text-gray-800">
                            {result.verification.medicine_name_regional ||
                                result.verification.medicine_name_english}
                        </p>
                        {result.verification.medicine_name_regional !==
                            result.verification.medicine_name_english && (
                            <p className="text-sm text-gray-500">
                                {result.verification.medicine_name_english}
                            </p>
                        )}
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-xs text-gray-400">{t("manufacturerLabel")}</p>
                            <p className="font-medium text-gray-700">
                                {result.verification.manufacturer}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">{t("categoryLabel")}</p>
                            <p className="font-medium text-gray-700">
                                {result.verification.category}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">{t("languageDetectedLabel")}</p>
                            <p className="font-medium text-gray-700 uppercase">
                                {result.detected_language}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">{t("youSaidLabel")}</p>
                            <p className="font-medium text-gray-700 italic">
                                &quot;{result.transcribed}&quot;
                            </p>
                        </div>
                    </div>

                    {/* Warnings */}
                    {result.verification.warnings.length > 0 && (
                        <div className="space-y-1 rounded-lg bg-white/60 p-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                                {t("warningsLabel")}
                            </p>
                            {result.verification.warnings.map((w, i) => (
                                <p key={i} className="text-sm text-orange-700">
                                    ⚠ {w}
                                </p>
                            ))}
                        </div>
                    )}

                    {/* Try again */}
                    <button
                        onClick={reset}
                        className="w-full rounded-xl bg-gray-100 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
                    >
                        🎙 {t("checkAnother")}
                    </button>
                </div>
            )}

            {/* Fallback text input */}
            {!result && !isRecording && (
                <div className="text-center">
                    <p className="text-xs text-gray-400">
                        {t("fallbackText")}{" "}
                        <a href="/verify?mode=text" className="text-blue-500 underline">
                            {t("fallbackLinkText")}
                        </a>
                    </p>
                </div>
            )}
        </div>
    );
}
