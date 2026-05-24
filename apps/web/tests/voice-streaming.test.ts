import {
    createVoiceStreamingSession,
    getVoiceStreamingUrl,
} from "../app/[locale]/voice/lib/streaming";

describe("voice streaming helper", () => {
    const originalMlBaseUrl = process.env.NEXT_PUBLIC_ML_SERVICE_URL;

    afterEach(() => {
        process.env.NEXT_PUBLIC_ML_SERVICE_URL = originalMlBaseUrl;
        jest.resetAllMocks();
    });

    it("converts an HTTP ML base URL into a WebSocket ASR URL", () => {
        expect(getVoiceStreamingUrl("http://localhost:8000")).toBe(
            "ws://localhost:8000/asr/stream"
        );
        expect(getVoiceStreamingUrl("https://ml.sahidawa.in")).toBe(
            "wss://ml.sahidawa.in/asr/stream"
        );
    });

    it("signals fallback when the socket errors before a final transcript arrives", () => {
        const onFallback = jest.fn();
        const socket = {
            send: jest.fn(),
            close: jest.fn(),
            onopen: null,
            onmessage: null,
            onerror: null,
            onclose: null,
        } as unknown as WebSocket;

        createVoiceStreamingSession({
            language: "en-IN",
            mimeType: "audio/webm",
            onPartial: jest.fn(),
            onFinal: jest.fn(),
            onFallback,
            socketFactory: () => socket,
        });

        socket.onerror?.(new Event("error"));

        expect(onFallback).toHaveBeenCalledTimes(1);
    });

    it("signals fallback when the socket closes before a final transcript arrives", () => {
        const onFallback = jest.fn();
        const socket = {
            send: jest.fn(),
            close: jest.fn(),
            onopen: null,
            onmessage: null,
            onerror: null,
            onclose: null,
            readyState: WebSocket.CONNECTING,
        } as unknown as WebSocket;

        createVoiceStreamingSession({
            language: "en-IN",
            mimeType: "audio/webm",
            onPartial: jest.fn(),
            onFinal: jest.fn(),
            onFallback,
            socketFactory: () => socket,
        });

        socket.onclose?.(new CloseEvent("close"));

        expect(onFallback).toHaveBeenCalledTimes(1);
    });
});
