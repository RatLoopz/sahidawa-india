"use client";

import { useState, useRef, useCallback } from "react";

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
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    setResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Visualize audio level
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const draw = () => {
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
        stream.getTracks().forEach((t) => t.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setAudioLevel(0);

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await sendAudioToApi(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      setError("Microphone access denied. Please allow microphone access and try again.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const sendAudioToApi = async (blob: Blob) => {
    setIsLoading(true);
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");

      const res = await fetch("/api/medicine/verify-voice", {
        method: "POST",
        body: form,
      });

      const data: ApiResponse = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Verification failed. Please try again.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  const statusConfig = result ? STATUS_CONFIG[result.verification.status] : null;

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <div className="text-center space-y-1">
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
            className={`
              relative w-24 h-24 rounded-full flex items-center justify-center text-white text-4xl
              transition-all duration-200 shadow-lg focus:outline-none focus:ring-4
              ${isRecording
                ? "bg-red-500 hover:bg-red-600 focus:ring-red-300 scale-110"
                : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-300"
              }
              ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
            style={
              isRecording
                ? { boxShadow: `0 0 0 ${8 + audioLevel * 20}px rgba(239,68,68,0.3)` }
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

          <p className="text-sm text-gray-500 text-center">
            {isLoading
              ? "Verifying medicine..."
              : isRecording
              ? "Recording... tap to stop"
              : "Tap to speak the medicine name"}
          </p>

          {/* Supported languages hint */}
          <p className="text-xs text-gray-400 text-center">
            Supports: Hindi • Tamil • Telugu • Kannada • Bengali • Malayalam + more
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded-xl p-4 text-sm">
          {error}
          <button onClick={reset} className="mt-2 underline block text-xs">
            Try again
          </button>
        </div>
      )}

      {/* Result Card */}
      {result && statusConfig && (
        <div className={`rounded-2xl border-2 ${statusConfig.border} ${statusConfig.bg} p-5 space-y-4`}>
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className={`text-lg font-bold ${statusConfig.text}`}>{statusConfig.label}</span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusConfig.badge}`}>
              CDSCO {result.verification.cdsco_registered ? "Registered" : "Unverified"}
            </span>
          </div>

          {/* Medicine name in regional script */}
          <div className="space-y-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Medicine ({result.script} script)</p>
            <p className="text-2xl font-semibold text-gray-800">
              {result.verification.medicine_name_regional || result.verification.medicine_name_english}
            </p>
            {result.verification.medicine_name_regional !== result.verification.medicine_name_english && (
              <p className="text-sm text-gray-500">{result.verification.medicine_name_english}</p>
            )}
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Manufacturer</p>
              <p className="font-medium text-gray-700">{result.verification.manufacturer}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Category</p>
              <p className="font-medium text-gray-700">{result.verification.category}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Language Detected</p>
              <p className="font-medium text-gray-700 uppercase">{result.detected_language}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">You said</p>
              <p className="font-medium text-gray-700 italic">"{result.transcribed}"</p>
            </div>
          </div>

          {/* Warnings */}
          {result.verification.warnings.length > 0 && (
            <div className="bg-white/60 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase">Warnings</p>
              {result.verification.warnings.map((w, i) => (
                <p key={i} className="text-sm text-orange-700">⚠ {w}</p>
              ))}
            </div>
          )}

          {/* Try again */}
          <button
            onClick={reset}
            className="w-full py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition"
          >
            🎙 Check another medicine
          </button>
        </div>
      )}

      {/* Fallback text input */}
      {!result && !isRecording && (
        <div className="text-center">
          <p className="text-xs text-gray-400">
            No microphone?{" "}
            <a href="/verify?mode=text" className="underline text-blue-500">
              Use text input instead
            </a>
          </p>
        </div>
      )}
    </div>
  );
}