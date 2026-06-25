process.env.GEMINI_API_KEY = "test-api-key";
const generateContentMock = jest.fn();
const generateContentStreamMock = jest.fn();

jest.mock("@google/genai", () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: {
            generateContent: generateContentMock,
            generateContentStream: generateContentStreamMock,
        },
    })),
    Type: {
        OBJECT: "OBJECT",
        STRING: "STRING",
        ARRAY: "ARRAY",
        BOOLEAN: "BOOLEAN",
        INTEGER: "INTEGER",
        NUMBER: "NUMBER",
    },
}));

import { POST } from "../app/api/chat/route";
import { trimHistoryByTokens } from "@/lib/chatUtils";

function createTextStream(chunks: string[]) {
    return (async function* () {
        for (const chunk of chunks) {
            yield { text: chunk };
        }
    })();
}

function createFailingTextStream(error: unknown) {
    return (async function* () {
        throw error;
    })();
}

describe("POST /api/chat", () => {
    beforeEach(() => {
        generateContentMock.mockReset();
        generateContentStreamMock.mockReset();
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
        expect(generateContentStreamMock).not.toHaveBeenCalled();
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
        expect(generateContentStreamMock).not.toHaveBeenCalled();
    });

    it("returns 400 when message text is missing", async () => {
        const response = await POST(
            new Request("http://localhost/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "voice-triage",
                    responseLanguage: "English",
                    messages: [{ role: "user" }],
                }),
            })
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: "Message text is required",
        });
    });

    it("streams standard chat chunks as plain text", async () => {
        generateContentStreamMock.mockResolvedValue(createTextStream(["Hello! ", "I can help."]));

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
        expect(response.headers.get("content-type")).toContain("text/plain");
        await expect(response.text()).resolves.toBe("Hello! I can help.");

        expect(generateContentStreamMock).toHaveBeenCalledWith({
            model: "gemini-2.5-flash",
            contents: [
                { role: "user", parts: [{ text: "Hello" }] },
                { role: "model", parts: [{ text: "Hi! How can I help you today?" }] },
                { role: "user", parts: [{ text: "What is paracetamol?" }] },
            ],
            config: expect.any(Object),
        });
        expect(generateContentMock).not.toHaveBeenCalled();
    });

    it("returns the existing JSON error response when Gemini stream fails before first chunk", async () => {
        generateContentStreamMock.mockResolvedValue(createFailingTextStream({ status: 503 }));

        const response = await POST(
            new Request("http://localhost/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [{ role: "user", content: "What is paracetamol?" }],
                }),
            })
        );

        expect(response.status).toBe(503);
        expect(response.headers.get("content-type")).toContain("application/json");
        await expect(response.json()).resolves.toEqual({
            error: "Google AI is currently experiencing high demand. Please try again in a few moments.",
        });
    });

    it("uses Punjabi in the standard chat system prompt when locale is pa", async () => {
        generateContentStreamMock.mockResolvedValue(createTextStream(["ਮੈਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ।"]));

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
        await expect(response.text()).resolves.toBe("ਮੈਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ।");
        expect(generateContentStreamMock).toHaveBeenCalledWith(
            expect.objectContaining({
                config: expect.objectContaining({
                    systemInstruction: expect.stringContaining("Punjabi"),
                }),
            })
        );
    });
});

describe("trimHistoryByTokens", () => {
    it("retains all messages if total tokens are within the limit", () => {
        const messages = [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi there" },
        ];
        const trimmed = trimHistoryByTokens(messages, 100);
        expect(trimmed.trimmedMessages).toHaveLength(2);
        expect(trimmed.droppedMessages).toHaveLength(0);
    });

    it("truncates older messages when total tokens exceed the limit", () => {
        const messages = [
            {
                role: "user",
                content:
                    "This is a very old message that should be truncated because it pushes the limit.",
            },
            { role: "user", content: "Recent message 1" },
            { role: "assistant", content: "Recent message 2" },
        ];
        // "Recent message X" is roughly 3 tokens each + 4 overhead = 7 tokens per msg -> 14 total.
        // If maxTokens is 20, it should only keep the last two.
        const trimmed = trimHistoryByTokens(messages, 20);
        expect(trimmed.trimmedMessages).toHaveLength(2);
        expect(trimmed.trimmedMessages[0].content).toBe("Recent message 1");
        expect(trimmed.droppedMessages).toHaveLength(1);
        expect(trimmed.droppedMessages[0].content).toBe(
            "This is a very old message that should be truncated because it pushes the limit."
        );
    });

    it("always keeps at least the last message even if it exceeds the limit", () => {
        const messages = [
            { role: "user", content: "Short old message" },
            {
                role: "assistant",
                content: "Very long recent message that exceeds the limit on its own",
            },
        ];
        const trimmed = trimHistoryByTokens(messages, 5); // extremely small limit
        expect(trimmed.trimmedMessages).toHaveLength(1);
        expect(trimmed.trimmedMessages[0].content).toBe(
            "Very long recent message that exceeds the limit on its own"
        );
        expect(trimmed.droppedMessages).toHaveLength(1);
        expect(trimmed.droppedMessages[0].content).toBe("Short old message");
    });
});
