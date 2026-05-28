const generateContentMock = jest.fn();

jest.mock("@google/genai", () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: {
            generateContent: generateContentMock,
        },
    })),
}));

import { POST } from "../app/api/chat/route";

describe("POST /api/chat", () => {
    beforeEach(() => {
        generateContentMock.mockReset();
    });

    it("forces emergency true when deterministic detection matches", async () => {
        generateContentMock.mockResolvedValue({
            text: JSON.stringify({
                text: "Monitor closely.",
                summary: "Monitor closely.",
                recommendations: ["Stay with the patient."],
                disclaimer: "Seek care if symptoms worsen.",
                emergency: false,
            }),
        });

        const response = await POST(
            new Request("http://localhost/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "voice-triage",
                    responseLanguage: "English",
                    messages: [{ text: "My mother is unconscious and has chest pain" }],
                }),
            })
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            emergency: true,
        });
    });

    it("keeps non-emergency responses false when neither detector signals danger", async () => {
        generateContentMock.mockResolvedValue({
            text: JSON.stringify({
                text: "This sounds mild.",
                summary: "This sounds mild.",
                recommendations: ["Rest", "Drink water"],
                disclaimer: "See a doctor if symptoms persist.",
                emergency: false,
            }),
        });

        const response = await POST(
            new Request("http://localhost/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "voice-triage",
                    responseLanguage: "English",
                    messages: [{ text: "I have a mild cough since yesterday" }],
                }),
            })
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            emergency: false,
        });
    });

    it("returns 400 when message text is missing", async () => {
        const response = await POST(
            new Request("http://localhost/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "voice-triage",
                    responseLanguage: "English",
                    messages: [],
                }),
            })
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: "Message text is required",
        });
    });

    it("correctly formats and forwards chat history to standard chat", async () => {
        generateContentMock.mockResolvedValue({
            text: "Hello! I can help you with that.",
        });

        const response = await POST(
            new Request("http://localhost/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [
                        { role: "user", content: "Hello" },
                        { role: "assistant", content: "Hi! How can I help you today?" },
                        { role: "user", content: "What is paracetamol?" },
                    ],
                }),
            })
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            text: "Hello! I can help you with that.",
        });

        expect(generateContentMock).toHaveBeenCalledWith({
            model: "gemini-2.5-flash",
            contents: [
                { role: "user", parts: [{ text: "Hello" }] },
                { role: "model", parts: [{ text: "Hi! How can I help you today?" }] },
                { role: "user", parts: [{ text: "What is paracetamol?" }] },
            ],
            config: expect.any(Object),
        });
    });

    it("uses Punjabi in the standard chat system prompt when locale is pa", async () => {
        generateContentMock.mockResolvedValue({
            text: "ਮੈਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ।",
        });

        const response = await POST(
            new Request("http://localhost/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    locale: "pa",
                    messages: [{ role: "user", content: "What is paracetamol?" }],
                }),
            })
        );

        expect(response.status).toBe(200);
        expect(generateContentMock).toHaveBeenCalledWith(
            expect.objectContaining({
                config: expect.objectContaining({
                    systemInstruction: expect.stringContaining("Punjabi"),
                }),
            })
        );
    });
});
