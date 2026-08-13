import { NextResponse } from "next/server";
import { structuredLog } from "@/lib/structuredLogger";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getClientIp";
import { getMlServiceUrl, getMlAuthHeaders } from "@/lib/mlService";

const ROUTE = "/api/voice/medicine-extract";
const ML_EXTRACT_TIMEOUT_MS = 30_000;
// Matches the ML service's MAX_TEXT_LENGTH — a spoken utterance is short.
const MAX_TEXT_LENGTH = 2000;

async function readJsonSafely(source: Request | Response) {
    try {
        return await source.json();
    } catch {
        return null;
    }
}

export async function POST(req: Request) {
    const startTime = Date.now();

    const ip = getClientIp(req);
    const { success } = await rateLimit.limit(ip);
    if (!success) {
        return NextResponse.json(
            { error: "Too many requests. Please try again in a few moments." },
            { status: 429 }
        );
    }

    const body = await readJsonSafely(req);
    const text = body && typeof body === "object" ? body.text : undefined;

    if (typeof text !== "string" || !text.trim()) {
        return NextResponse.json({ error: "Transcript text is required." }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH) {
        return NextResponse.json(
            { error: `Transcript too long. Maximum length is ${MAX_TEXT_LENGTH} characters.` },
            { status: 413 }
        );
    }

    const mlServiceUrl = getMlServiceUrl();
    if (!mlServiceUrl) {
        structuredLog({
            log_level: "error",
            route: ROUTE,
            error: {
                message: "ML_SERVICE_URL is not configured",
                code: 503,
                stack: undefined,
            },
            meta: { missingVars: ["ML_SERVICE_URL"] },
        });
        return NextResponse.json(
            {
                error: "Medicine extraction service is currently unavailable.",
                code: "ML_SERVICE_URL_MISSING",
            },
            { status: 503 }
        );
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), ML_EXTRACT_TIMEOUT_MS);

    try {
        const upstreamResponse = await fetch(`${mlServiceUrl}/medicine-extract`, {
            method: "POST",
            headers: {
                ...getMlAuthHeaders(),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: text.trim() }),
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
                    message: "Extraction service returned an invalid response",
                    code: 502,
                    stack: undefined,
                },
                meta: { textLength: text.length },
            });
            return NextResponse.json(
                { error: "Extraction service returned an invalid response." },
                { status: 502 }
            );
        }

        if (!upstreamResponse.ok) {
            const statusCode = upstreamResponse.status;
            const errorDetail =
                typeof upstreamData.detail === "string" && upstreamData.detail.trim()
                    ? upstreamData.detail
                    : "Medicine extraction failed.";

            structuredLog({
                log_level: statusCode === 503 || statusCode === 429 ? "error" : "warn",
                route: ROUTE,
                latency_ms,
                error: { message: errorDetail, code: statusCode, stack: undefined },
                meta: { textLength: text.length },
            });
            return NextResponse.json({ error: errorDetail }, { status: statusCode });
        }

        const medicines = Array.isArray(upstreamData.medicines)
            ? upstreamData.medicines.filter(
                  (name: unknown): name is string => typeof name === "string"
              )
            : [];

        structuredLog({
            log_level: "info",
            route: ROUTE,
            latency_ms,
            meta: { textLength: text.length, medicineCount: medicines.length },
        });

        return NextResponse.json({ medicines });
    } catch (error) {
        const latency_ms = Date.now() - startTime;

        if (error instanceof Error && error.name === "AbortError") {
            structuredLog({
                log_level: "error",
                route: ROUTE,
                latency_ms,
                error: {
                    message: "Extraction service timed out",
                    code: 504,
                    stack: error.stack,
                },
                meta: { timeoutMs: ML_EXTRACT_TIMEOUT_MS },
            });
            return NextResponse.json(
                { error: "Medicine extraction service timed out." },
                { status: 504 }
            );
        }

        structuredLog({
            log_level: "error",
            route: ROUTE,
            latency_ms,
            error: {
                message: "Could not reach the extraction service",
                code: 503,
                stack: error instanceof Error ? error.stack : undefined,
            },
            meta: {},
        });
        return NextResponse.json(
            { error: "Could not reach the medicine extraction service." },
            { status: 503 }
        );
    } finally {
        clearTimeout(timeoutId);
    }
}
