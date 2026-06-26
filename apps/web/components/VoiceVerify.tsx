"use client";

import { useVoiceVerification } from "../src/hooks/useVoiceVerification";

const STATUS_CONFIG = {
    verified: {
        label: "✅ Verified",
        bg: "bg-green-50",
        border: "border-green-400",
        text: "text-green-800",
        badge: "bg-green-100 text-green-800",
    },
    suspicious: {
        label: "⚠️ Suspicious",
        bg: "bg-yellow-50",
        border: "border-yellow-400",
        text: "text-yellow-800",
        badge: "bg-yellow-100 text-yellow-800",
    },
    not_found: {
        label: "❌ Not Found",
        bg: "bg-red-50",
        border: "border-red-400",
        text: "text-red-800",
        badge: "bg-red-100 text-red-800",
    },
};

export default function VoiceVerify() {
    const {
        isRecording,
        isLoading,
        audioLevel,
        result,
        error,
        startRecording,
        stopRecording,
        reset,
    } = useVoiceVerification();

    const statusConfig = result ? STATUS_CONFIG[result.verification.status] : null;

    return (
        <div className="mx-auto max-w-md space-y-6 p-4">
            <div className="space-y-1 text-center">
                <h2 className="text-2xl font-bold text-gray-900">🩺 Voice Medicine Check</h2>
                <p className="text-sm text-gray-500">Speak the medicine name in your language</p>
            </div>

            {/* Mic Button */}
            {!result && (
                <div className="flex flex-col items-center gap-4">
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isLoading}
                        aria-label={isRecording ? "Stop recording" : "Start recording"}
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
                            ? "Verifying medicine..."
                            : isRecording
                              ? "Recording... tap to stop"
                              : "Tap to speak the medicine name"}
                    </p>

                    <p className="text-center text-xs text-gray-400">
                        Supports: Hindi • Tamil • Telugu • Kannada • Bengali • Malayalam + more
                    </p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                    <button onClick={reset} className="mt-2 block text-xs underline">
                        Try again
                    </button>
                </div>
            )}

            {/* Result Card */}
            {result && statusConfig && (
                <div
                    className={`rounded-2xl border-2 ${statusConfig.border} ${statusConfig.bg} space-y-4 p-5`}
                >
                    <div className="flex items-center justify-between">
                        <span className={`text-lg font-bold ${statusConfig.text}`}>
                            {statusConfig.label}
                        </span>
                        <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${statusConfig.badge}`}
                        >
                            CDSCO{" "}
                            {result.verification.cdsco_registered ? "Registered" : "Unverified"}
                        </span>
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs tracking-wide text-gray-400 uppercase">
                            Medicine ({result.script} script)
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

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-xs text-gray-400">Manufacturer</p>
                            <p className="font-medium text-gray-700">
                                {result.verification.manufacturer}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Category</p>
                            <p className="font-medium text-gray-700">
                                {result.verification.category}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Language Detected</p>
                            <p className="font-medium text-gray-700 uppercase">
                                {result.detected_language}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">You said</p>
                            <p className="font-medium text-gray-700 italic">
                                "{result.transcribed}"
                            </p>
                        </div>
                    </div>

                    {result.verification.warnings.length > 0 && (
                        <div className="space-y-1 rounded-lg bg-white/60 p-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                                Warnings
                            </p>
                            {result.verification.warnings.map((w, i) => (
                                <p key={i} className="text-sm text-orange-700">
                                    ⚠ {w}
                                </p>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={reset}
                        className="w-full rounded-xl bg-gray-100 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
                    >
                        🎙 Check another medicine
                    </button>
                </div>
            )}

            {!result && !isRecording && (
                <div className="text-center">
                    <p className="text-xs text-gray-400">
                        No microphone?{" "}
                        <a href="/verify?mode=text" className="text-blue-500 underline">
                            Use text input instead
                        </a>
                    </p>
                </div>
            )}
        </div>
    );
}
