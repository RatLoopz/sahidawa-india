/**
 * apps/web/app/api/medicine/safety/route.ts
 *
 * Next.js App Router API route — GET /api/medicine/safety?q=<name>
 *
 * Runs entirely on Vercel (no Render dependency).
 * Pipeline:
 *   1. Check Supabase cache  →  return instantly if found
 *   2. Fetch OpenFDA context (free RAG grounding)
 *   3. Gemini 2.0 Flash (primary)  →  Groq LLaMA 3.1 (fallback on 429)
 *   4. Persist to Supabase cache   →  return result
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

// ── OpenFDA ───────────────────────────────────────────────────────────────────
async function fetchOpenFdaContext(genericName: string): Promise<string> {
    try {
        const url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(genericName.toLowerCase())}"&limit=1`;
        const res = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) return "";

        const body = await res.json();
        const result = body?.results?.[0];
        if (!result) return "";

        const pick = (arr: string[] | undefined) => arr?.[0]?.trim().slice(0, 600) ?? "";

        const parts: string[] = [];
        const w = pick(result.warnings ?? result.warnings_and_cautions);
        if (w) parts.push(`WARNINGS: ${w}`);
        const d = pick(result.dosage_and_administration);
        if (d) parts.push(`DOSAGE: ${d}`);
        const a = pick(result.adverse_reactions);
        if (a) parts.push(`ADVERSE REACTIONS: ${a}`);
        const i = pick(result.drug_interactions);
        if (i) parts.push(`DRUG INTERACTIONS: ${i}`);
        return parts.join("\n\n");
    } catch {
        return "";
    }
}

// ── Shared system prompt ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a senior clinical pharmacologist with expertise in Indian and global pharmacopoeia.
Generate a comprehensive medicine safety profile as a single valid JSON object.
Output ONLY the JSON — no markdown fences, no explanation, no preamble.

Rules:
- sideEffects: include 4-8 entries mixing common and severe effects.
- ageBasedDosage: always include all three groups (children, adults, elderly).
  For contraindicated groups, set dose to "Not recommended" and add a warning.
- dietaryCues: include 2-4 relevant dietary or storage cues.
- pregnancyCategory: use standard A/B/C/D/X format with a brief explanation.
- All text in English. Medical terms followed by layperson explanation in parentheses.
- If reference FDA text is provided, prioritise it but keep output concise.

Required JSON shape:
{
  "activeIngredient": "string — INN generic name",
  "genericName": "string — display name",
  "brandAliases": ["array of common brand names"],
  "sideEffects": [{"name":"string","severity":"common|severe","frequency":"common|uncommon|rare"}],
  "ageBasedDosage": [{"group":"children|adults|elderly","label":"string","ageRange":"string","dose":"string","frequency":"string","notes":["string"],"warnings":["string"]}],
  "dietaryCues": [{"icon":"UtensilsCrossed|Droplets|Coffee|Wine|Apple|Milk|Refrigerator","label":"string","instruction":"string","type":"required|avoid|optional"}],
  "storageNote": "string",
  "pregnancyCategory": "string"
}`;

// ── Gemini response schema ────────────────────────────────────────────────────
const GEMINI_SCHEMA: Schema = {
    type: SchemaType.OBJECT,
    properties: {
        activeIngredient: { type: SchemaType.STRING },
        genericName: { type: SchemaType.STRING },
        brandAliases: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        sideEffects: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    name: { type: SchemaType.STRING },
                    severity: { type: SchemaType.STRING },
                    frequency: { type: SchemaType.STRING },
                },
                required: ["name", "severity", "frequency"],
            },
        },
        ageBasedDosage: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    group: { type: SchemaType.STRING },
                    label: { type: SchemaType.STRING },
                    ageRange: { type: SchemaType.STRING },
                    dose: { type: SchemaType.STRING },
                    frequency: { type: SchemaType.STRING },
                    notes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    warnings: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                },
                required: ["group", "label", "ageRange", "dose", "frequency", "notes", "warnings"],
            },
        },
        dietaryCues: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    icon: { type: SchemaType.STRING },
                    label: { type: SchemaType.STRING },
                    instruction: { type: SchemaType.STRING },
                    type: { type: SchemaType.STRING },
                },
                required: ["icon", "label", "instruction", "type"],
            },
        },
        storageNote: { type: SchemaType.STRING },
        pregnancyCategory: { type: SchemaType.STRING },
    },
    required: [
        "activeIngredient",
        "genericName",
        "brandAliases",
        "sideEffects",
        "ageBasedDosage",
        "dietaryCues",
        "storageNote",
        "pregnancyCategory",
    ],
};

function isRateLimited(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return (
        msg.includes("429") ||
        msg.toLowerCase().includes("rate limit") ||
        msg.toLowerCase().includes("quota") ||
        (typeof err === "object" && err !== null && (err as { status?: number }).status === 429)
    );
}

async function generateWithGemini(drug: string, rag: string): Promise<object> {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)?.trim();
    if (!apiKey) throw new Error("API Key not set");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: { responseMimeType: "application/json", responseSchema: GEMINI_SCHEMA },
        systemInstruction: SYSTEM_PROMPT,
    });

    const prompt = rag
        ? `Drug name: "${drug}"\n\nReference FDA label text:\n${rag}`
        : `Drug name: "${drug}"`;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
}

async function generateWithGroq(drug: string, rag: string): Promise<object> {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) throw new Error("GROQ_API_KEY not set");

    const groq = new Groq({ apiKey });
    const prompt = rag
        ? `Drug name: "${drug}"\n\nReference FDA label text:\n${rag}`
        : `Drug name: "${drug}"`;

    const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 2048,
    });

    return JSON.parse(completion.choices[0]?.message?.content ?? "{}");
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
    // ── Supabase (server-side — uses service role key for cache writes) ────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json(
            { error: "Server misconfiguration: Supabase credentials missing." },
            { status: 500 }
        );
    }
    const db = createClient(supabaseUrl, supabaseKey);

    const q = new URL(request.url).searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
        return NextResponse.json(
            { error: "Query parameter 'q' is required (min 2 chars)." },
            { status: 400 }
        );
    }

    const genericName = q.toLowerCase();

    // ── 1. Supabase cache ─────────────────────────────────────────────────────
    try {
        const { data } = await db
            .from("medicine_safety_profiles")
            .select("profile_json")
            .eq("generic_name", genericName)
            .maybeSingle();

        if (data?.profile_json) {
            return NextResponse.json(data.profile_json, {
                headers: {
                    "X-Cache": "HIT",
                    "X-Cache-Source": "supabase",
                    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
                },
            });
        }
    } catch {
        // non-fatal — proceed to LLM
    }

    // ── 2. OpenFDA RAG context ────────────────────────────────────────────────
    const rag = await fetchOpenFdaContext(genericName);

    // ── 3. LLM generation: Gemini → Groq fallback ────────────────────────────
    let profile: object;

    try {
        profile = await generateWithGemini(q, rag);
    } catch (geminiErr) {
        const reason = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
        const isRL = isRateLimited(geminiErr);
        console.warn(
            `[medicine/safety] Gemini ${isRL ? "rate-limited" : `failed (${reason})`} — trying Groq`
        );

        try {
            profile = await generateWithGroq(q, rag);
        } catch (groqErr) {
            const groqReason = groqErr instanceof Error ? groqErr.message : String(groqErr);
            console.error(
                `[medicine/safety] Both LLMs failed. Gemini: ${reason} | Groq: ${groqReason}`
            );
            return NextResponse.json(
                {
                    error: "Medicine safety data is temporarily unavailable. Please try again shortly.",
                    code: "LLM_UNAVAILABLE",
                },
                { status: 503 }
            );
        }
    }

    // ── 4. Persist to Supabase (best-effort) ──────────────────────────────────
    try {
        await db.from("medicine_safety_profiles").upsert(
            {
                generic_name: genericName,
                profile_json: profile,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "generic_name" }
        );
    } catch {
        // non-fatal
    }

    return NextResponse.json(profile, {
        headers: {
            "X-Cache": "MISS",
            "X-Cache-Source": "llm-generated",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
    });
}
