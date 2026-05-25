import {
    normalizeVoiceTranscriptionResponse,
    type VoiceTranscriptionPayload,
} from "./transcription";

type VoiceStreamingCallback = (payload: VoiceTranscriptionPayload) => void;

type CreateVoiceStreamingSessionOptions = {
    baseUrl?: string;
    language?: string;
    mimeType: string;
    onPartial: VoiceStreamingCallback;
    onFinal: VoiceStreamingCallback;
    onFallback: (error: Error) => void;
    socketFactory?: () => WebSocket;
};

export function getVoiceStreamingUrl(baseUrl?: string) {
    const rawBaseUrl =
        baseUrl?.trim() ||
        process.env.NEXT_PUBLIC_ML_SERVICE_URL?.trim() ||
        "http://localhost:8000";
    const url = new URL(rawBaseUrl);

    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/asr/stream";
    url.search = "";

    return url.toString();
}

function parseStreamingPayload(rawPayload: unknown): VoiceTranscriptionPayload | null {
    if (!rawPayload || typeof rawPayload !== "object") {
        return null;
    }

    const payload = rawPayload as Record<string, unknown>;

    return normalizeVoiceTranscriptionResponse({
        transcript: typeof payload.transcript === "string" ? payload.transcript : "",
        language: typeof payload.language === "string" ? payload.language : null,
        languageConfidence:
            typeof payload.languageConfidence === "number" ? payload.languageConfidence : null,
    });
}

export function createVoiceStreamingSession(options: CreateVoiceStreamingSessionOptions) {
    const socket =
        options.socketFactory?.() ?? new WebSocket(getVoiceStreamingUrl(options.baseUrl), []);
    let closed = false;
    let finalReceived = false;
    let isOpen = false;
    let fallbackTriggered = false;
    const queuedMessages: Array<string | ArrayBuffer> = [];

    function triggerFallback(error: Error) {
        if (fallbackTriggered || closed || finalReceived) {
            return;
        }

        fallbackTriggered = true;
        options.onFallback(error);
    }

    function sendOrQueue(message: string | ArrayBuffer) {
        if (closed) {
            return;
        }

        if (isOpen || socket.readyState === WebSocket.OPEN) {
            socket.send(message);
            return;
        }

        queuedMessages.push(message);
    }

    socket.onopen = () => {
        isOpen = true;
        socket.send(
            JSON.stringify({
                type: "start",
                language: options.language,
                mimeType: options.mimeType,
            })
        );
        while (queuedMessages.length > 0) {
            const nextMessage = queuedMessages.shift();
            if (typeof nextMessage !== "undefined") {
                socket.send(nextMessage);
            }
        }
    };

    socket.onmessage = (event) => {
        try {
            const payload = JSON.parse(String(event.data)) as Record<string, unknown>;

            if (payload.type === "partial") {
                const normalizedPayload = parseStreamingPayload(payload);
                if (normalizedPayload) {
                    options.onPartial(normalizedPayload);
                }
                return;
            }

            if (payload.type === "final") {
                const normalizedPayload = parseStreamingPayload(payload);
                if (normalizedPayload) {
                    finalReceived = true;
                    options.onFinal(normalizedPayload);
                }
                return;
            }

            if (payload.type === "error") {
                triggerFallback(
                    new Error(
                        typeof payload.error === "string" && payload.error.trim()
                            ? payload.error
                            : "Streaming transcription failed."
                    )
                );
            }
        } catch {
            triggerFallback(new Error("Streaming transcription failed."));
        }
    };

    socket.onerror = () => {
        triggerFallback(new Error("Streaming transcription failed."));
    };

    socket.onclose = () => {
        triggerFallback(new Error("Streaming transcription failed."));
    };

    return {
        async sendChunk(blob: Blob) {
            sendOrQueue(await blob.arrayBuffer());
        },
        finish() {
            sendOrQueue(JSON.stringify({ type: "stop" }));
        },
        close() {
            closed = true;
            queuedMessages.length = 0;
            socket.close();
        },
    };
}
