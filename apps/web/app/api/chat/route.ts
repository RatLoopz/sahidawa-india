import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { detectEmergencyKeywords } from "@/lib/voice/emergency";

const DEFAULT_DISCLAIMER =
    "This guidance is for informational use only and is not a diagnosis. Consult a doctor or pharmacist, especially for severe or persistent symptoms.";

type ChatMessage = {
    text?: string;
    content?: string;
    role?: string;
};

type VoiceTriageResponse = {
    text: string;
    summary: string;
    recommendations: string[];
    disclaimer: string;
    emergency: boolean;
};

// ── Structured Logger ─────────────────────────────────────────────────────────

interface LogEntry {
    timestamp: string;
    log_level: "info" | "warn" | "error";
    route: string;
    latency_ms?: number;
    metrics?: {
        input_tokens: number | undefined;
        output_tokens: number | undefined;
    };
    error?: {
        message: string;
        code: number;
        stack: string | undefined;
    };
    meta?: Record<string, unknown>;
}

function structuredLog(entry: LogEntry): void {
    const line = JSON.stringify(entry);
    if (entry.log_level === "error") {
        console.error(line);
    } else if (entry.log_level === "warn") {
        console.warn(line);
    } else {
        console.log(line);
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLatestMessageText(messages: ChatMessage[] | undefined) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return "";
    }

    const lastMessage = messages[messages.length - 1];
    return lastMessage?.text?.trim() || lastMessage?.content?.trim() || "";
}

function mapMessagesToGeminiContents(messages: ChatMessage[]) {
    return messages.map((msg) => {
        const text = msg.text || msg.content || "";
        const role = msg.role === "assistant" ? "model" : "user";
        return {
            role,
            parts: [{ text }],
        };
    });
}

function extractJsonBlock(rawText: string) {
    const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch) {
        return fencedMatch[1].trim();
    }

    const startIndex = rawText.indexOf("{");
    const endIndex = rawText.lastIndexOf("}");

    if (startIndex >= 0 && endIndex > startIndex) {
        return rawText.slice(startIndex, endIndex + 1);
    }

    return rawText.trim();
}

function parseVoiceTriageResponse(rawText: string): VoiceTriageResponse {
    try {
        const parsed = JSON.parse(extractJsonBlock(rawText));
        const summary =
            typeof parsed.summary === "string" && parsed.summary.trim().length > 0
                ? parsed.summary.trim()
                : rawText.trim();
        const recommendations = Array.isArray(parsed.recommendations)
            ? parsed.recommendations
                  .filter((item: unknown): item is string => typeof item === "string")
                  .map((item: string) => item.trim())
                  .filter(Boolean)
                  .slice(0, 3)
            : [];
        const disclaimer =
            typeof parsed.disclaimer === "string" && parsed.disclaimer.trim().length > 0
                ? parsed.disclaimer.trim()
                : DEFAULT_DISCLAIMER;

        return {
            text:
                typeof parsed.text === "string" && parsed.text.trim().length > 0
                    ? parsed.text.trim()
                    : summary,
            summary,
            recommendations,
            disclaimer,
            emergency: Boolean(parsed.emergency),
        };
    } catch {
        return {
            text: rawText.trim(),
            summary: rawText.trim(),
            recommendations: [],
            disclaimer: DEFAULT_DISCLAIMER,
            emergency: false,
        };
    }
}

function buildVoiceTriagePrompt(transcript: string, responseLanguage: string) {
    return [
        `Citizen transcript: ${JSON.stringify(transcript)}`,
        `Respond in ${responseLanguage}.`,
        "Return strict JSON only.",
        'Use this shape: {"summary":"string","recommendations":["string"],"disclaimer":"string","emergency":boolean,"text":"string"}.',
        "Keep the summary to at most 2 short sentences.",
        "Return no more than 3 concise recommendation items.",
        "Set emergency to true only if the symptoms could indicate urgent medical attention.",
        "The disclaimer must remind the user to seek professional care for serious, persistent, or worsening symptoms.",
    ].join("\n");
}

function getAiClient() {
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    const ROUTE = "/api/chat";
    const startTime = Date.now();

    try {
        const ai = getAiClient();
        const { messages, mode, responseLanguage } = await req.json();
        const latestMessageText = getLatestMessageText(messages);

        if (!latestMessageText) {
            structuredLog({
                timestamp: new Date().toISOString(),
                log_level: "warn",
                route: ROUTE,
                meta: { reason: "empty_message_text", mode },
            });
            return NextResponse.json({ error: "Message text is required" }, { status: 400 });
        }

        if (mode === "voice-triage") {
            const deterministicEmergency = detectEmergencyKeywords(latestMessageText);

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: buildVoiceTriagePrompt(
                    latestMessageText,
                    typeof responseLanguage === "string" && responseLanguage.trim().length > 0
                        ? responseLanguage.trim()
                        : "English"
                ),
                config: {
                    systemInstruction:
                        "You are the SahiDawa voice triage assistant for India. Help users understand possible next steps based on symptoms, but never claim certainty or replace medical professionals. Be calm, concise, practical, and safety-first.",
                },
            });

            const latency_ms = Date.now() - startTime;

            structuredLog({
                timestamp: new Date().toISOString(),
                log_level: "info",
                route: ROUTE,
                latency_ms,
                metrics: {
                    input_tokens: response.usageMetadata?.promptTokenCount,
                    output_tokens: response.usageMetadata?.candidatesTokenCount,
                },
                meta: { mode: "voice-triage", responseLanguage },
            });

            const parsedResponse = parseVoiceTriageResponse(response.text ?? "");

            return NextResponse.json({
                ...parsedResponse,
                emergency: parsedResponse.emergency || deterministicEmergency.isEmergency,
            });
        }

        // ── General chat mode ─────────────────────────────────────────────────

        const formattedContents = mapMessagesToGeminiContents(messages || []);

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: formattedContents,
            config: {
                systemInstruction:
                    "You are the SahiDawa AI Assistant. SahiDawa is India's First Open-Source Citizen Medicine Verifier & Rural Health Bridge. You help users verify medicine information, understand their prescriptions, and navigate the app. Be concise, empathetic, and highly accurate in your medical guidance, but always remind users to consult a doctor for serious concerns.",
            },
        });

        const latency_ms = Date.now() - startTime;

        structuredLog({
            timestamp: new Date().toISOString(),
            log_level: "info",
            route: ROUTE,
            latency_ms,
            metrics: {
                input_tokens: response.usageMetadata?.promptTokenCount,
                output_tokens: response.usageMetadata?.candidatesTokenCount,
            },
            meta: { mode: "chat", messageCount: (messages || []).length },
        });

        return NextResponse.json({ text: response.text });

    } catch (error: any) {
        const latency_ms = Date.now() - startTime;
        const statusCode: number = error?.status || 500;

        structuredLog({
            timestamp: new Date().toISOString(),
            log_level: "error",
            route: ROUTE,
            latency_ms,
            error: {
                message:
                    statusCode === 503
                        ? "Google AI service unavailable (overloaded)"
                        : statusCode === 429
                          ? "Google AI rate limit exceeded"
                          : "AI generation failed",
                code: statusCode,
                stack: error instanceof Error ? error.stack : undefined,
            },
        });

        const errorMessage =
            statusCode === 503
                ? "Google AI is currently experiencing high demand. Please try again in a few moments."
                : statusCode === 429
                  ? "Request limit reached. Please wait a moment before trying again."
                  : "Failed to generate AI response";

        return NextResponse.json({ error: errorMessage }, { status: statusCode });
    }
}