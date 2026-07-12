import { handleApiError } from "@/lib/apiErrorHandler";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioStore } from "@/stores/useAudioStore";

export interface UseCloudTTSOptions {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: Error) => void;
}

export interface TTSError extends Error {
    code?: "TTS_UNAVAILABLE" | "TTS_FAILED" | "TIMEOUT" | "INVALID_LANGUAGE" | "UNKNOWN";
}

let trackIdCounter = 0;
function generateTrackId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    trackIdCounter += 1;
    return `tts-track-${trackIdCounter}`;
}

/**
 * Hook for playing cloud-generated TTS audio.
 * Falls back to native SpeechSynthesis if cloud TTS fails.
 *
 * Playback is coordinated through a global Zustand store (useAudioStore) so
 * only one audio track can ever play across the whole app — starting a new
 * track automatically pauses and revokes whatever was playing before.
 */
export function useCloudTTS() {
    // Stable per-instance id so this hook can tell whether IT is the
    // currently-playing track in the global store.
    const trackIdRef = useRef<string>(generateTrackId());
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const isPlaying = useAudioStore((state) => state.currentTrackId === trackIdRef.current);
    const play = useAudioStore((state) => state.play);

    useEffect(() => {
        const trackId = trackIdRef.current;
        return () => {
            // If this instance's track is still the globally active one,
            // fully tear it down (pause + revoke blob + clear store).
            useAudioStore.getState().stopIfCurrent(trackId);

            // Always detach local listeners defensively, even if another
            // track already superseded this one.
            if (audioRef.current) {
                audioRef.current.onplay = null;
                audioRef.current.onended = null;
                audioRef.current.onerror = null;
                audioRef.current.pause();
                audioRef.current.src = "";
            }
        };
    }, []);

    const playTTS = useCallback(
        async (text: string, languageCode: string, options?: UseCloudTTSOptions): Promise<void> => {
            if (typeof window === "undefined") {
                throw new Error("Cloud TTS can only be used in browser");
            }

            const trackId = trackIdRef.current;
            let createdAudioUrl: string | null = null;

            try {
                setIsLoading(true);

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

                const binaryString = atob(data.audio_base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const audioBlob = new Blob([bytes], { type: "audio/mp3" });
                const audioUrl = URL.createObjectURL(audioBlob);
                createdAudioUrl = audioUrl;

                // Fresh Audio element per playback (rather than reusing one
                // long-lived ref) so a previous call's event listeners can
                // never fire against a track that's since been replaced.
                const audio = new Audio();
                audioRef.current = audio;
                audio.src = audioUrl;

                const handlePlay = () => {
                    setIsLoading(false);
                    options?.onStart?.();
                };

                const handleEnded = () => {
                    setIsLoading(false);
                    options?.onEnd?.();
                    useAudioStore.getState().stopIfCurrent(trackId);
                };

                const handleError = async (event: Event | string) => {
                    const audioError = new Error("Audio playback error");

                    setIsLoading(false);
                    options?.onEnd?.();
                    options?.onError?.(audioError);

                    useAudioStore.getState().stopIfCurrent(trackId);
                    await handleApiError(audioError, "Failed to play audio");

                    console.error("Audio playback error:", event);
                };

                audio.onplay = handlePlay;
                audio.onended = handleEnded;
                audio.onerror = handleError;

                if (data.cached) {
                    console.debug(
                        `[TTS] Served from cache: ${languageCode}, ${data.character_count} chars`
                    );
                }

                // Hand off to the global store BEFORE playing, so whatever
                // was previously playing (in this or any other component)
                // gets paused and its blob URL revoked first.
                play(audio, trackId, audioUrl);

                await audio.play();
            } catch (error) {
                setIsLoading(false);

                if (createdAudioUrl) {
                    // By this point play() has already handed the URL to the
                    // store (it's called before audio.play()), so let the
                    // store do the teardown rather than revoking twice.
                    useAudioStore.getState().stopIfCurrent(trackId);
                }

                const err = error instanceof Error ? error : new Error(String(error));
                options?.onEnd?.();
                options?.onError?.(err);

                throw err;
            }
        },
        [play]
    );

    const stopTTS = useCallback(() => {
        useAudioStore.getState().stopIfCurrent(trackIdRef.current);
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
        }
        setIsLoading(false);
    }, []);

    return {
        playTTS,
        stopTTS,
        isLoading,
        isPlaying,
    };
}
