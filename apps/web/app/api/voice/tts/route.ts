import { NextResponse } from "next/server";
import { structuredLog } from "@/lib/structuredLogger";
import { rateLimit } from "@/lib/rateLimit";

const ROUTE = "/api/voice/tts";
const ML_TTS_TIMEOUT_MS = 15_000;
const LANGUAGE_CODE_PATTERN = /^[a-z]{2}-[A-Z]{2}$/;
const MAX_TEXT_LENGTH = 5000;

function getMlServiceUrl() {
    const configuredUrl = process.env.ML_SERVICE_URL?.trim();
    return configuredUrl ? configuredUrl.replace(/\/+$/, "") : null;
}

async function readJsonSafely(response: Response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

export async function POST(req: Request) {
    const startTime = Date.now();

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

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const languageCode = typeof body?.languageCode === "string" ? body.languageCode : "";
    const gender = body?.gender === "MALE" || body?.gender === "NEUTRAL" ? body.gender : "FEMALE";

    if (!text || text.length > MAX_TEXT_LENGTH) {
        return NextResponse.json(
            { error: "Text is required and must be 5000 characters or less." },
            { status: 400 }
        );
    }

    if (!LANGUAGE_CODE_PATTERN.test(languageCode)) {
        return NextResponse.json(
            {
                error: "Language code must be in format xx-YY (e.g., en-IN, hi-IN).",
                code: "INVALID_LANGUAGE",
            },
            { status: 400 }
        );
    }

    const mlServiceUrl = getMlServiceUrl();
    if (!mlServiceUrl) {
        structuredLog({
            log_level: "error",
            route: ROUTE,
            error: {
                message: "ML_SERVICE_URL is not configured",
                code: 500,
                stack: undefined,
            },
            meta: { missingVars: ["ML_SERVICE_URL"] },
        });
        return NextResponse.json(
            {
                error: "Server configuration error: text-to-speech service URL is missing.",
                code: "ML_SERVICE_URL_MISSING",
            },
            { status: 500 }
        );
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), ML_TTS_TIMEOUT_MS);

    try {
        const upstreamResponse = await fetch(`${mlServiceUrl}/voice/tts/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text,
                language_code: languageCode,
                gender,
            }),
            signal: abortController.signal,
        });

        const latency_ms = Date.now() - startTime;
        const upstreamData = await readJsonSafely(upstreamResponse);

        if (!upstreamResponse.ok) {
            const statusCode = upstreamResponse.status;
            const errorDetail =
                upstreamData &&
                typeof upstreamData.detail === "string" &&
                upstreamData.detail.trim()
                    ? upstreamData.detail
                    : "Text-to-speech generation failed.";

            structuredLog({
                log_level: statusCode === 503 ? "error" : "warn",
                route: ROUTE,
                latency_ms,
                error: { message: errorDetail, code: statusCode, stack: undefined },
                meta: { languageCode, textLength: text.length },
            });

            return NextResponse.json({ error: errorDetail }, { status: statusCode });
        }

        if (!upstreamData || typeof upstreamData.audio_base64 !== "string") {
            structuredLog({
                log_level: "error",
                route: ROUTE,
                latency_ms,
                error: {
                    message: "TTS service returned an invalid response",
                    code: 502,
                    stack: undefined,
                },
                meta: { languageCode, textLength: text.length },
            });
            return NextResponse.json(
                { error: "Text-to-speech service returned an invalid response." },
                { status: 502 }
            );
        }

        structuredLog({
            log_level: "info",
            route: ROUTE,
            latency_ms,
            meta: {
                languageCode,
                provider: upstreamData.provider,
                cached: upstreamData.cached,
                characterCount: upstreamData.character_count,
            },
        });

        return NextResponse.json(upstreamData);
    } catch (error) {
        const latency_ms = Date.now() - startTime;

        if (error instanceof Error && error.name === "AbortError") {
            structuredLog({
                log_level: "error",
                route: ROUTE,
                latency_ms,
                error: {
                    message: "Text-to-speech service timed out",
                    code: 504,
                    stack: error.stack,
                },
                meta: { timeoutMs: ML_TTS_TIMEOUT_MS, languageCode },
            });
            return NextResponse.json(
                { error: "Text-to-speech service timed out.", code: "TTS_TIMEOUT" },
                { status: 504 }
            );
        }

        structuredLog({
            log_level: "error",
            route: ROUTE,
            latency_ms,
            error: {
                message: "Could not reach the text-to-speech service",
                code: 503,
                stack: error instanceof Error ? error.stack : undefined,
            },
            meta: { languageCode },
        });
        return NextResponse.json(
            {
                error: "Could not reach the text-to-speech service.",
                code: "TTS_SERVICE_UNAVAILABLE",
            },
            { status: 503 }
        );
    } finally {
        clearTimeout(timeoutId);
    }
}
