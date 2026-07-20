/**
 * llm.service.ts
 *
 * Dual-LLM safety profile generator.
 *
 * Strategy:
 *   1. Gemini 2.0 Flash (primary)  — native response_schema, generous free tier.
 *   2. Groq LLaMA 3.1 (fallback)   — fires instantly on Gemini 429 rate-limit,
 *                                    no user-visible delay or error.
 *
 * Both providers are free and require no payment to get started.
 */

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Schema } from "@google/generative-ai";
import Groq from "groq-sdk";
import logger from "../utils/logger";

// ── Local type mirror (matches apps/web/components/medicine/MedicineSafetyData.ts) ──
export interface MedicineSafetyProfile {
    activeIngredient: string;
    genericName: string;
    brandAliases?: string[];
    sideEffects: Array<{
        name: string;
        severity: "common" | "severe";
        frequency: "common" | "uncommon" | "rare";
    }>;
    ageBasedDosage: Array<{
        group: "children" | "adults" | "elderly";
        label: string;
        ageRange: string;
        dose: string;
        frequency: string;
        notes: string[];
        warnings: string[];
    }>;
    dietaryCues: Array<{
        icon: string;
        label: string;
        instruction: string;
        type: "required" | "avoid" | "optional";
    }>;
    storageNote: string;
    pregnancyCategory?: string;
}

// ── JSON schema we demand from both providers ─────────────────────────────────

const PROFILE_SCHEMA_DESCRIPTION = `
{
  "activeIngredient": "string — INN generic name (e.g. 'telmisartan')",
  "genericName": "string — human display name (e.g. 'Telmisartan')",
  "brandAliases": ["array of common brand names, all lowercase"],
  "sideEffects": [
    {
      "name": "string",
      "severity": "'common' | 'severe'",
      "frequency": "'common' | 'uncommon' | 'rare'"
    }
  ],
  "ageBasedDosage": [
    {
      "group": "'children' | 'adults' | 'elderly'",
      "label": "string — human label e.g. 'Adults'",
      "ageRange": "string e.g. '18-60 years'",
      "dose": "string e.g. '500 mg'",
      "frequency": "string e.g. 'Every 4-6 hours'",
      "notes": ["string array"],
      "warnings": ["string array"]
    }
  ],
  "dietaryCues": [
    {
      "icon": "'UtensilsCrossed' | 'Droplets' | 'Coffee' | 'Wine' | 'Salad' | 'Fish' | 'Milk'",
      "label": "string",
      "instruction": "string",
      "type": "'required' | 'avoid' | 'optional'"
    }
  ],
  "storageNote": "string — storage instructions",
  "pregnancyCategory": "string — e.g. 'Category B — Generally safe'"
}`;

const SYSTEM_PROMPT = `You are a senior clinical pharmacologist with expertise in Indian and global pharmacopoeia.
Generate a comprehensive medicine safety profile as a single valid JSON object.
Output ONLY the JSON — no markdown fences, no explanation, no preamble.
The JSON MUST follow this exact schema:
${PROFILE_SCHEMA_DESCRIPTION}

Rules:
- sideEffects: include 4-8 entries covering common and rare effects.
- ageBasedDosage: always include all three groups (children, adults, elderly). For children, if the medicine is contraindicated, set dose to "Not recommended" and add a warning.
- dietaryCues: include 2-4 relevant entries.
- pregnancyCategory: use the standard A/B/C/D/X format with a brief explanation.
- If you use reference text provided below, prioritise it over training knowledge but keep output concise.
- All text in English; medical terminology should be followed by a layperson explanation in parentheses.`;

// ── Gemini helpers ────────────────────────────────────────────────────────────

const geminiResponseSchema: Schema = {
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

async function generateWithGemini(
    drugName: string,
    ragContext: string
): Promise<MedicineSafetyProfile> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: geminiResponseSchema,
        },
        systemInstruction: SYSTEM_PROMPT,
    });

    const userPrompt = ragContext
        ? `Drug name: "${drugName}"\n\nReference text from FDA label:\n${ragContext}`
        : `Drug name: "${drugName}"`;

    const result = await model.generateContent(userPrompt);
    const text = result.response.text();
    return JSON.parse(text) as MedicineSafetyProfile;
}

// ── Groq helpers ──────────────────────────────────────────────────────────────

async function generateWithGroq(
    drugName: string,
    ragContext: string
): Promise<MedicineSafetyProfile> {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) throw new Error("GROQ_API_KEY not configured");

    const groq = new Groq({ apiKey });

    const userPrompt = ragContext
        ? `Drug name: "${drugName}"\n\nReference text from FDA label:\n${ragContext}`
        : `Drug name: "${drugName}"`;

    const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2, // Low temp for consistent structured output
        max_tokens: 2048,
    });

    const text = completion.choices[0]?.message?.content ?? "";
    return JSON.parse(text) as MedicineSafetyProfile;
}

// ── Rate limit detection ──────────────────────────────────────────────────────

function isRateLimitError(err: unknown): boolean {
    if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        // Gemini throws "429" in message; SDK may also expose a status property
        if (msg.includes("429") || msg.includes("rate limit") || msg.includes("quota")) return true;
    }
    // Some SDK errors expose a numeric status field
    if (typeof err === "object" && err !== null && "status" in err) {
        return (err as { status: number }).status === 429;
    }
    return false;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates a structured medicine safety profile using dual-LLM fallback:
 *   1. Gemini 2.0 Flash  — tried first (native JSON schema, accurate)
 *   2. Groq LLaMA 3.1   — silent fallback on Gemini 429 / unavailability
 *
 * @param drugName   Generic/brand name searched by the user.
 * @param ragContext Optional RAG grounding text from OpenFDA.
 */
export async function generateSafetyProfile(
    drugName: string,
    ragContext: string = ""
): Promise<MedicineSafetyProfile> {
    // ── Try Gemini first ──────────────────────────────────────────────────────
    try {
        logger.info(`[LLM] Generating profile for "${drugName}" via Gemini 2.0 Flash`);
        const profile = await generateWithGemini(drugName, ragContext);
        logger.info(`[LLM] Gemini succeeded for "${drugName}"`);
        return profile;
    } catch (geminiErr) {
        const isRateLimit = isRateLimitError(geminiErr);
        const reason = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);

        if (isRateLimit) {
            logger.warn(`[LLM] Gemini rate-limited — falling back to Groq for "${drugName}"`);
        } else {
            logger.warn(
                `[LLM] Gemini failed ("${reason}") — falling back to Groq for "${drugName}"`
            );
        }
    }

    // ── Groq fallback ─────────────────────────────────────────────────────────
    logger.info(`[LLM] Generating profile for "${drugName}" via Groq LLaMA 3.1`);
    const profile = await generateWithGroq(drugName, ragContext);
    logger.info(`[LLM] Groq succeeded for "${drugName}"`);
    return profile;
}
