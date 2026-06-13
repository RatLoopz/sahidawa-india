import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";
import { detectEmergencyKeywords } from "@/lib/voice/emergency";
import { rateLimit } from "@/lib/rateLimit";
import { BASE_PROMPT } from "@/lib/chatPrompts";
import { structuredLog } from "@/lib/structuredLogger";

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

type TextStreamChunk = {
    text?: string;
    usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
    };
};

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
        return { role, parts: [{ text }] };
    });
}

function extractJsonBlock(rawText: string) {
    const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch) return fencedMatch[1].trim();
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

// Structured-output schema so Gemini always returns valid, parseable JSON
// (no markdown fences, no trailing/mixed-language corruption).
const VOICE_TRIAGE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        summary: {
            type: Type.STRING,
            description:
                "One short sentence (max two) describing the likely situation and next step.",
        },
        recommendations: {
            type: Type.ARRAY,
            description: "The 3 most important actions, each a single short sentence.",
            items: { type: Type.STRING },
            minItems: "1",
            maxItems: "3",
        },
        disclaimer: {
            type: Type.STRING,
            description:
                "A brief reminder to seek professional care for serious, persistent, or worsening symptoms.",
        },
        emergency: {
            type: Type.BOOLEAN,
            description: "True only if the symptoms could indicate urgent medical attention.",
        },
    },
    required: ["summary", "recommendations", "disclaimer", "emergency"],
    propertyOrdering: ["summary", "recommendations", "disclaimer", "emergency"],
};

function buildVoiceTriagePrompt(transcript: string, responseLanguage: string) {
    return [
        `Citizen transcript: ${JSON.stringify(transcript)}`,
        `Write every field entirely in ${responseLanguage}. Do not mix languages or scripts within any field.`,
        "Be brief: the summary is at most 2 short sentences.",
        "Give only the 3 most important recommendations, each a single short sentence.",
        "Set emergency to true only if the symptoms could indicate urgent medical attention.",
        "The disclaimer must remind the user to seek professional care for serious, persistent, or worsening symptoms.",
    ].join("\n");
}

function getAiClient() {
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export async function POST(req: Request) {
    const ROUTE = "/api/chat";
    const startTime = Date.now();

    try {
        const forwardedFor = req.headers.get("x-forwarded-for");
        const realIp = req.headers.get("x-real-ip");
        const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "127.0.0.1";
        const { success } = await rateLimit.limit(ip);
        if (!success) {
            return NextResponse.json(
                { error: "Too many requests. Please try again in a few moments." },
                { status: 429 }
            );
        }

        const ai = getAiClient();
        const { messages, mode, responseLanguage, locale } = await req.json();
        const latestMessageText = getLatestMessageText(messages);

        if (!latestMessageText) {
            structuredLog({
                log_level: "warn",
                route: ROUTE,
                meta: { reason: "empty_message_text", mode },
            });
            return NextResponse.json({ error: "Message text is required" }, { status: 400 });
        }

        if (mode === "voice-triage") {
            const deterministicEmergency = detectEmergencyKeywords(latestMessageText);
            
            let parsedResponse;
            let emergencyFromML = false;
            
            try {
                const mlServiceUrl = process.env.ML_SERVICE_URL?.trim() || process.env.NEXT_PUBLIC_ML_SERVICE_URL?.trim() || "http://localhost:8000";
                const formattedMessages = (messages || []).map((m: any) => ({
                    role: m.role === "assistant" || m.role === "model" ? "assistant" : "user",
                    content: m.text || m.content || ""
                }));
                
                // If there's no history, initialize with the current message
                if (formattedMessages.length === 0) {
                    formattedMessages.push({ role: "user", content: latestMessageText });
                }

                const mlResponse = await fetch(`${mlServiceUrl}/triage/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: formattedMessages,
                        locale: locale || "en"
                    })
                });

                if (!mlResponse.ok) {
                    throw new Error(`ML service returned status ${mlResponse.status}`);
                }

                const mlData = await mlResponse.json();
                parsedResponse = {
                    text: mlData.response,
                    summary: mlData.summary || mlData.response,
                    recommendations: mlData.recommendations || [],
                    disclaimer: mlData.disclaimer || DEFAULT_DISCLAIMER,
                    emergency: Boolean(mlData.emergency)
                };
                emergencyFromML = Boolean(mlData.emergency);
                
                structuredLog({
                    log_level: "info",
                    route: ROUTE,
                    latency_ms: Date.now() - startTime,
                    meta: { mode: "voice-triage", source: "langgraph-ml-service", responseLanguage }
                });

            } catch (mlError: any) {
                structuredLog({
                    log_level: "warn",
                    route: ROUTE,
                    meta: { reason: "ml_service_triage_failed", error: mlError.message, fallback: "direct_gemini" }
                });

                // Fallback direct Gemini call
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
                        responseMimeType: "application/json",
                        responseSchema: VOICE_TRIAGE_SCHEMA,
                    },
                });

                parsedResponse = parseVoiceTriageResponse(response.text ?? "");
                emergencyFromML = parsedResponse.emergency;
            }

            return NextResponse.json({
                ...parsedResponse,
                emergency: emergencyFromML || deterministicEmergency.isEmergency,
            });
        }

        const formattedContents = mapMessagesToGeminiContents(messages || []);

        const supportedLocales = ["en", "gu", "bn", "te", "ta", "mr", "ur", "kn", "pa", "or", "hi"];
        const finalLocale = supportedLocales.includes(locale) ? locale : "en";
        const localeMap = {
            en: "English",
            hi: "Hindi",
            bn: "Bengali",
            gu: "Gujarati",
            kn: "Kannada",
            mr: "Marathi",
            pa: "Punjabi",
            ta: "Tamil",
            te: "Telugu",
            ur: "Urdu",
            or: "Odia",
        };
        const language = localeMap[finalLocale as keyof typeof localeMap] || "English";
        const systemPrompt = BASE_PROMPT.replace("{language}", language);

        const responseStream = (await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: formattedContents,
            config: {
                systemInstruction: systemPrompt,
            },
        })) as AsyncIterable<TextStreamChunk>;
        const responseIterator = responseStream[Symbol.asyncIterator]();
        const firstStreamResult = await responseIterator.next();

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                let usageMetadata: TextStreamChunk["usageMetadata"];

                try {
                    const enqueueChunk = (chunk: TextStreamChunk) => {
                        usageMetadata = chunk.usageMetadata ?? usageMetadata;

                        if (chunk.text) {
                            controller.enqueue(encoder.encode(chunk.text));
                        }
                    };

                    if (!firstStreamResult.done) {
                        enqueueChunk(firstStreamResult.value);
                    }

                    while (true) {
                        const chunkResult = await responseIterator.next();
                        if (chunkResult.done) {
                            break;
                        }
                        enqueueChunk(chunkResult.value);
                    }

                    const latency_ms = Date.now() - startTime;
                    structuredLog({
                        log_level: "info",
                        route: ROUTE,
                        latency_ms,
                        metrics: {
                            input_tokens: usageMetadata?.promptTokenCount,
                            output_tokens: usageMetadata?.candidatesTokenCount,
                        },
                        meta: { mode: "chat", messageCount: (messages || []).length },
                    });
                    controller.close();
                } catch (streamError) {
                    const latency_ms = Date.now() - startTime;
                    structuredLog({
                        log_level: "error",
                        route: ROUTE,
                        latency_ms,
                        error: {
                            message: "AI chat stream failed",
                            code: 500,
                            stack: streamError instanceof Error ? streamError.stack : undefined,
                        },
                        meta: { mode: "chat", messageCount: (messages || []).length },
                    });
                    controller.error(streamError);
                }
            },
            async cancel() {
                await responseIterator.return?.();
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
            },
        });
    } catch (error: any) {
        const latency_ms = Date.now() - startTime;
        const statusCode: number = error?.status || 500;
        structuredLog({
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
