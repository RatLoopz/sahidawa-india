import { handleApiError } from "@/lib/apiErrorHandler";
import { useRef, useCallback, useState } from "react";

export interface UseCloudTTSOptions {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: Error) => void;
}

export interface TTSError extends Error {
    code?: "TTS_UNAVAILABLE" | "TTS_FAILED" | "TIMEOUT" | "INVALID_LANGUAGE" | "UNKNOWN";
}

/**
 * Hook for playing cloud-generated TTS audio
 * Falls back to native SpeechSynthesis if cloud TTS fails
 */
export function useCloudTTS() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const playTTS = useCallback(
        async (text: string, languageCode: string, options?: UseCloudTTSOptions): Promise<void> => {
            if (typeof window === "undefined") {
                throw new Error("Cloud TTS can only be used in browser");
            }

            try {
                setIsLoading(true);

                // Request TTS audio from backend
                const response = await fetch("/api/voice/tts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text,
                        languageCode,
                        gender: "FEMALE",
                    }),
                });

                if (!response.ok) {
                    const errorData = (await response.json().catch(() => ({}))) as Record<
                        string,
                        unknown
                    >;
                    const code = (errorData.code as string) || "UNKNOWN";

                    if (response.status === 503) {
                        const error = new Error("TTS service unavailable") as TTSError;
                        error.code = "TTS_UNAVAILABLE";
                        throw error;
                    }

                    if (response.status === 400) {
                        const error = new Error(
                            (errorData.error as string) || "Invalid TTS request"
                        ) as TTSError;
                        error.code = "INVALID_LANGUAGE";
                        throw error;
                    }

                    if (response.status === 504) {
                        const error = new Error("TTS request timed out") as TTSError;
                        error.code = "TIMEOUT";
                        throw error;
                    }

                    const error = new Error("TTS generation failed") as TTSError;
                    error.code = (code as TTSError["code"]) || "TTS_FAILED";
                    throw error;
                }

                const data = (await response.json()) as {
                    audio_base64: string;
                    language_code: string;
                    provider: string;
                    cached: boolean;
                    character_count: number;
                };

                // Decode base64 MP3 payload into a browser-native byte array
                const binaryString = atob(data.audio_base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const audioBlob = new Blob([bytes], { type: "audio/mp3" });
                const audioUrl = URL.createObjectURL(audioBlob);

                // Create or reuse audio element
                if (!audioRef.current) {
                    audioRef.current = new Audio();
                }

                const audio = audioRef.current;
                audio.src = audioUrl;

                // Set up event listeners
                const handlePlay = () => {
                    setIsLoading(false);
                    options?.onStart?.();
                };

                const handleEnded = () => {
                    setIsLoading(false);
                    options?.onEnd?.();
                    // Clean up object URL
                    URL.revokeObjectURL(audioUrl);
                };

                const handleError = async (event: Event | string) => {
                    const audioError = new Error("Audio playback error");

                    setIsLoading(false);
                    options?.onEnd?.();
                    options?.onError?.(audioError);

                    await handleApiError(audioError, "Failed to play audio");

                    console.error("Audio playback error:", event);
                };

                audio.onplay = handlePlay;
                audio.onended = handleEnded;
                audio.onerror = handleError;

                // Log cache hit for analytics
                if (data.cached) {
                    console.debug(
                        `[TTS] Served from cache: ${languageCode}, ${data.character_count} chars`
                    );
                }

                await audio.play();
            } catch (error) {
                setIsLoading(false);

                const err = error instanceof Error ? error : new Error(String(error));
                options?.onEnd?.();
                options?.onError?.(err);

                // Re-throw for caller to handle fallback logic
                throw err;
            }
        },
        []
    );

    const stopTTS = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsLoading(false);
    }, []);

    return {
        playTTS,
        stopTTS,
        isLoading,
    };
}
