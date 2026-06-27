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

interface UseVoiceVerificationReturn {
    isRecording: boolean;
    isLoading: boolean;
    audioLevel: number;
    result: ApiResponse | null;
    error: string | null;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    reset: () => void;
}

export function useVoiceVerification(): UseVoiceVerificationReturn {
    // States
    const [isRecording, setIsRecording] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<ApiResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [audioLevel, setAudioLevel] = useState(0);

    // Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const animFrameRef = useRef<number | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);

    // Send audio to API
    const sendAudioToApi = useCallback(async (blob: Blob) => {
        setIsLoading(true);
        setError(null);
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
    }, []);

    // Start recording
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
                setAudioLevel(avg / 128);
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
        } catch {
            setError("Microphone access denied. Please allow microphone access and try again.");
        }
    }, [sendAudioToApi]);

    // Stop recording
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, [isRecording]);

    // Reset
    const reset = useCallback(() => {
        setResult(null);
        setError(null);
        setIsRecording(false);
        setIsLoading(false);
        setAudioLevel(0);
    }, []);

    return {
        isRecording,
        isLoading,
        audioLevel,
        result,
        error,
        startRecording,
        stopRecording,
        reset,
    };
}
