import { NextResponse } from "next/server";

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
    const formData = await req.formData();
    const file = formData.get("file");
    const language = formData.get("language");

    if (!(file instanceof File)) {
        return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
    }

    const upstreamBody = new FormData();
    upstreamBody.append("file", file);
    if (typeof language === "string" && language.trim()) {
        upstreamBody.append("language", language.trim());
    }

    try {
        const upstreamResponse = await fetch(`${getMlServiceUrl()}/asr/transcribe`, {
            method: "POST",
            body: upstreamBody,
        });

        const upstreamData = await readJsonSafely(upstreamResponse);

        if (!upstreamData || typeof upstreamData !== "object") {
            return NextResponse.json(
                { error: "Transcription service returned an invalid response." },
                { status: 502 }
            );
        }

        if (!upstreamResponse.ok) {
            return NextResponse.json(
                {
                    error:
                        typeof upstreamData.detail === "string" && upstreamData.detail.trim()
                            ? upstreamData.detail
                            : "Transcription failed.",
                },
                { status: upstreamResponse.status }
            );
        }

        return NextResponse.json({
            transcript: String(upstreamData.transcription ?? "").trim(),
            language: typeof upstreamData.language === "string" ? upstreamData.language : null,
            languageConfidence:
                typeof upstreamData.language_probability === "number"
                    ? upstreamData.language_probability
                    : null,
        });
    } catch {
        return NextResponse.json(
            { error: "Could not reach the transcription service." },
            { status: 503 }
        );
    }
}
