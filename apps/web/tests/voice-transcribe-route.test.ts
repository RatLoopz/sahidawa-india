import { POST } from "../app/api/voice/transcribe/route";

describe("POST /api/voice/transcribe", () => {
    const originalFetch = global.fetch;
    const originalMlServiceUrl = process.env.ML_SERVICE_URL;

    beforeEach(() => {
        jest.resetAllMocks();
        process.env.ML_SERVICE_URL = "http://ml-service.test";
    });

    afterAll(() => {
        global.fetch = originalFetch;
        process.env.ML_SERVICE_URL = originalMlServiceUrl;
    });

    it("forwards audio to the ML transcription service and returns normalized JSON", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                transcription: "I have fever and cough",
                language: "en",
                language_probability: 0.84,
            }),
        }) as unknown as typeof fetch;

        const formData = new FormData();
        formData.append("file", new File(["audio"], "voice.webm", { type: "audio/webm" }));
        const request = new Request("http://localhost/api/voice/transcribe", {
            method: "POST",
            body: formData,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(global.fetch).toHaveBeenCalledWith("http://ml-service.test/asr/transcribe", {
            method: "POST",
            body: expect.any(FormData),
            signal: expect.any(AbortSignal),
        });
        expect(data).toEqual({
            transcript: "I have fever and cough",
            language: "en",
            languageConfidence: 0.84,
        });
    });

    it("forwards the selected language hint to the ML service", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                transcription: "எனக்கு காய்ச்சல் இருக்கு",
                language: "ta",
                language_probability: 0.91,
            }),
        }) as unknown as typeof fetch;

        const formData = new FormData();
        formData.append("file", new File(["audio"], "voice.webm", { type: "audio/webm" }));
        formData.append("language", "ta-IN");

        const request = new Request("http://localhost/api/voice/transcribe", {
            method: "POST",
            body: formData,
        });

        await POST(request);

        const forwardedBody = (global.fetch as jest.Mock).mock.calls[0][1].body as FormData;
        expect(forwardedBody.get("language")).toBe("ta-IN");
    });

    it("returns 400 when the request does not include audio", async () => {
        const request = new Request("http://localhost/api/voice/transcribe", {
            method: "POST",
            body: new FormData(),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Audio file is required.");
    });

    it("maps upstream ML failures into a retryable error", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 422,
            json: async () => ({ detail: "Could not process audio file." }),
        }) as unknown as typeof fetch;

        const formData = new FormData();
        formData.append("file", new File(["bad"], "voice.webm", { type: "audio/webm" }));

        const request = new Request("http://localhost/api/voice/transcribe", {
            method: "POST",
            body: formData,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.error).toBe("Could not process audio file.");
    });

    it("returns 502 when the ML service responds with invalid JSON", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => {
                throw new SyntaxError("Unexpected token <");
            },
        }) as unknown as typeof fetch;

        const formData = new FormData();
        formData.append("file", new File(["bad"], "voice.webm", { type: "audio/webm" }));

        const request = new Request("http://localhost/api/voice/transcribe", {
            method: "POST",
            body: formData,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(502);
        expect(data.error).toBe("Transcription service returned an invalid response.");
    });

    it("returns 504 when the ML service times out", async () => {
        const timeoutError = new Error("Timed out");
        timeoutError.name = "AbortError";
        global.fetch = jest.fn().mockRejectedValue(timeoutError) as unknown as typeof fetch;

        const formData = new FormData();
        formData.append("file", new File(["audio"], "voice.webm", { type: "audio/webm" }));

        const request = new Request("http://localhost/api/voice/transcribe", {
            method: "POST",
            body: formData,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(504);
        expect(data.error).toBe("Transcription service timed out.");
    });
});
