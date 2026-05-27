import { NextResponse } from "next/server";
import { structuredLog } from "@/lib/structuredLogger";

const ROUTE = "/api/voice/transcribe";
const ML_TRANSCRIBE_TIMEOUT_MS = 45_000;

function getMlServiceUrl() {
    return process.env.ML_SERVICE_URL ?? "http://localhost:8000";
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
    const formData = await req.formData();
    const file = formData.get("file");
    const language = formData.get("language");

    if (!(file instanceof File)) {
        structuredLog({
            log_level: "warn",
            route: ROUTE,
            meta: { reason: "missing_audio_file" },
        });
        return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
    }

    const upstreamBody = new FormData();
    upstreamBody.append("file", file);
    if (typeof language === "string" && language.trim()) {
        upstreamBody.append("language", language.trim());
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), ML_TRANSCRIBE_TIMEOUT_MS);

    try {
        const upstreamResponse = await fetch(`${getMlServiceUrl()}/asr/transcribe`, {
            method: "POST",
            body: upstreamBody,
            signal: abortController.signal,
        });

        const latency_ms = Date.now() - startTime;
        const upstreamData = await readJsonSafely(upstreamResponse);

        if (!upstreamData || typeof upstreamData !== "object") {
            structuredLog({
                log_level: "error",
                route: ROUTE,
                latency_ms,
                error: {
                    message: "Transcription service returned an invalid response",
                    code: 502,
                    stack: undefined,
                },
                meta: { language, fileSizeBytes: file.size, fileType: file.type },
            });
            return NextResponse.json(
                { error: "Transcription service returned an invalid response." },
                { status: 502 }
            );
        }

        if (!upstreamResponse.ok) {
            const statusCode = upstreamResponse.status;
            const errorDetail =
                typeof upstreamData.detail === "string" && upstreamData.detail.trim()
                    ? upstreamData.detail
                    : "Transcription failed.";

            structuredLog({
                log_level: statusCode === 503 || statusCode === 429 ? "error" : "warn",
                route: ROUTE,
                latency_ms,
                error: {
                    message: errorDetail,
                    code: statusCode,
                    stack: undefined,
                },
                meta: { language, fileSizeBytes: file.size, fileType: file.type },
            });
            return NextResponse.json({ error: errorDetail }, { status: statusCode });
        }

        structuredLog({
            log_level: "info",
            route: ROUTE,
            latency_ms,
            meta: {
                language: upstreamData.language ?? language,
                languageConfidence: upstreamData.language_probability ?? null,
                fileSizeBytes: file.size,
                fileType: file.type,
                transcriptLength:
                    typeof upstreamData.transcription === "string"
                        ? upstreamData.transcription.length
                        : 0,
            },
        });

        return NextResponse.json({
            transcript: String(upstreamData.transcription ?? "").trim(),
            language: typeof upstreamData.language === "string" ? upstreamData.language : null,
            languageConfidence:
                typeof upstreamData.language_probability === "number"
                    ? upstreamData.language_probability
                    : null,
        });

    } catch (error) {
        const latency_ms = Date.now() - startTime;

        if (error instanceof Error && error.name === "AbortError") {
            structuredLog({
                log_level: "error",
                route: ROUTE,
                latency_ms,
                error: {
                    message: "Transcription service timed out",
                    code: 504,
                    stack: error.stack,
                },
                meta: { timeoutMs: ML_TRANSCRIBE_TIMEOUT_MS, language },
            });
            return NextResponse.json(
                { error: "Transcription service timed out." },
                { status: 504 }
            );
        }

        structuredLog({
            log_level: "error",
            route: ROUTE,
            latency_ms,
            error: {
                message: "Could not reach the transcription service",
                code: 503,
                stack: error instanceof Error ? error.stack : undefined,
            },
            meta: { language },
        });
        return NextResponse.json(
            { error: "Could not reach the transcription service." },
            { status: 503 }
        );
    } finally {
        clearTimeout(timeoutId);
    }
}