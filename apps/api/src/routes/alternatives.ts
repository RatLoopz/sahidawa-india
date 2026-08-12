import { Router, Request, Response } from "express";
import { supabase } from "../db/client";
import logger from "../utils/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { barcodeLimiter } from "../middleware/rateLimit";
import { cacheMiddleware } from "../middleware/cache";
import { redisClient } from "../utils/redis";

const router = Router();

function cleanGenericName(name: string | null | undefined): string {
    if (!name) return "";
    return name
        .replace(/\s*\(\s*\/\s*\)\s*/g, "") // removes " (/)"
        .replace(/\s*\(\s*\)\s*/g, "") // removes " ()"
        .replace(/\s*\(\s*NA\s*\)\s*/g, "") // removes " (NA)"
        .trim();
}

import Groq from "groq-sdk";

const AI_SCHEMA_DESCRIPTION = `
{
  "brand_name": "string (brand name provided)",
  "generic_name": "string (clean generic composition name, e.g. 'Paracetamol')",
  "brand_price": number (brand MRP provided),
  "jan_aushadhi_price": number (estimated Jan Aushadhi price in INR, e.g. 15.0),
  "savings_percentage": number (percentage savings as integer, e.g. 50),
  "generic_name_display": "string (display name of Jan Aushadhi alternative, e.g. 'Paracetamol 650mg (Generic)')",
  "usage": "string (1-2 sentence description of primary usage and how it works)"
}`;

const AI_SYSTEM_PROMPT = `You are a clinical pharmacist assistant for SahiDawa.
Generate a suitable Jan Aushadhi generic alternative medicine for the given brand medicine.
Provide the details as a single valid JSON object.
Output ONLY the JSON — no markdown fences, no explanation, no preamble.
The JSON MUST follow this exact schema:
${AI_SCHEMA_DESCRIPTION}`;

async function generateAlternativeWithGemini(
    brandName: string,
    genericName: string,
    mrp: number
): Promise<any> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
            responseMimeType: "application/json",
        },
        systemInstruction: AI_SYSTEM_PROMPT,
    });

    const userPrompt = `Brand Name: "${brandName}"\nGeneric Name: "${genericName}"\nBrand Price (MRP): ${mrp || 120}`;
    const result = await model.generateContent(userPrompt);
    const text = result.response.text().trim();
    return JSON.parse(text);
}

async function generateAlternativeWithGroq(
    brandName: string,
    genericName: string,
    mrp: number
): Promise<any> {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) throw new Error("GROQ_API_KEY not configured");

    const groq = new Groq({ apiKey });
    const userPrompt = `Brand Name: "${brandName}"\nGeneric Name: "${genericName}"\nBrand Price (MRP): ${mrp || 120}`;

    const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
            { role: "system", content: AI_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 1024,
    });

    const text = completion.choices[0]?.message?.content ?? "";
    return JSON.parse(text);
}

function isRateLimitError(err: unknown): boolean {
    if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes("429") || msg.includes("rate limit") || msg.includes("quota")) return true;
    }
    if (typeof err === "object" && err !== null && "status" in err) {
        return (err as { status: number }).status === 429;
    }
    return false;
}

async function generateAlternativeWithAI(
    brandName: string,
    genericName: string,
    mrp: number
): Promise<any> {
    // Try Gemini first
    try {
        logger.info(`[AI Alternatives] Generating for "${brandName}" via Gemini 2.0 Flash`);
        const result = await generateAlternativeWithGemini(brandName, genericName, mrp);
        logger.info(`[AI Alternatives] Gemini succeeded for "${brandName}"`);
        return result;
    } catch (geminiErr) {
        const isRateLimit = isRateLimitError(geminiErr);
        const reason = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);

        if (isRateLimit) {
            logger.warn(
                `[AI Alternatives] Gemini rate-limited — falling back to Groq for "${brandName}"`
            );
        } else {
            logger.warn(
                `[AI Alternatives] Gemini failed ("${reason}") — falling back to Groq for "${brandName}"`
            );
        }
    }

    // Groq fallback
    try {
        logger.info(`[AI Alternatives] Generating for "${brandName}" via Groq LLaMA 3.1`);
        const result = await generateAlternativeWithGroq(brandName, genericName, mrp);
        logger.info(`[AI Alternatives] Groq succeeded for "${brandName}"`);
        return result;
    } catch (groqErr) {
        logger.error(`[AI Alternatives] Groq failed for "${brandName}"`, { error: groqErr });
        return null;
    }
}

/**
 * @openapi
 * /api/v1/alternatives/{medicine_id}:
 *   get:
 *     tags:
 *       - Medicine Alternatives
 *     summary: Get Jan Aushadhi generic alternatives for a brand medicine
 *     description: Returns generic alternatives with price comparison and the nearest pharmacy store details.
 *     parameters:
 *       - in: path
 *         name: medicine_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The UUID, barcode, or brand name of the medicine
 *       - in: query
 *         name: lat
 *         required: false
 *         schema:
 *           type: number
 *         description: Latitude of user to find nearest store
 *       - in: query
 *         name: lng
 *         required: false
 *         schema:
 *           type: number
 *         description: Longitude of user to find nearest store
 *     responses:
 *       200:
 *         description: Alternatives found
 *       404:
 *         description: Medicine or alternative not found
 *       500:
 *         description: Server error
 */
router.get(
    "/:medicine_id",
    barcodeLimiter,
    cacheMiddleware(300, 600),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const medicine_id = req.params.medicine_id as string;
            const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
            const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
            const cacheKey =
                lat !== undefined && lng !== undefined
                    ? `alt_cache:${medicine_id.toLowerCase()}:${lat.toFixed(3)}:${lng.toFixed(3)}`
                    : `alt_cache:${medicine_id.toLowerCase()}`;

            if (lat !== undefined && lng !== undefined) {
                if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                    res.status(400).json({
                        error: "Invalid coordinates: lat must be [-90, 90] and lng must be [-180, 180]",
                    });
                    return;
                }
            }

            if (!medicine_id) {
                res.status(400).json({ error: "medicine_id is required" });
                return;
            }
            try {
                const cached = await redisClient.get(cacheKey);

                if (cached) {
                    logger.info(`Alternatives cache HIT: ${cacheKey}`);
                    res.status(200).json(JSON.parse(cached));
                    return;
                }
            } catch (err) {
                logger.warn("Redis cache read failed", { err });
            }

            interface MedicineRecord {
                id?: string;
                brand_name?: string;
                generic_name?: string;
                mrp?: number;
                brand_price?: number;
                jan_aushadhi_price?: number;
                composition?: string;
            }

            // 1. Look up medicine in medicines table by ID, barcode, or brand name
            let medicine: MedicineRecord | null = null;

            // Try UUID match
            const uuidRegex =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(medicine_id)) {
                const { data } = await supabase
                    .from("medicines")
                    .select("id, brand_name, generic_name, mrp, jan_aushadhi_price, composition")
                    .eq("id", medicine_id)
                    .maybeSingle();
                medicine = data;
            }

            // Try barcode match if not matched by UUID
            if (!medicine) {
                const { data } = await supabase
                    .from("medicines")
                    .select("id, brand_name, generic_name, mrp, jan_aushadhi_price, composition")
                    .eq("barcode_id", medicine_id)
                    .maybeSingle();
                medicine = data;
            }

            // Try brand name match if still not matched
            if (!medicine) {
                const { data } = await supabase
                    .from("medicines")
                    .select("id, brand_name, generic_name, mrp, jan_aushadhi_price, composition")
                    .ilike("brand_name", medicine_id)
                    .limit(1)
                    .maybeSingle();
                medicine = data;
            }

            interface GenericAlternative {
                brand_name?: string;
                generic_name?: string;
                brand_price?: number;
                brand_mrp?: number;
                jan_aushadhi_price?: number;
                savings_percentage?: number;
                generic_name_display?: string;
            }

            // 2. Fetch alternative from generic_alternatives
            let alternative: GenericAlternative | null = null;

            if (medicine) {
                let { data } = await supabase
                    .from("generic_alternatives")
                    .select("*")
                    .eq("brand_medicine_id", medicine.id)
                    .limit(1)
                    .maybeSingle();

                if (!data && medicine.brand_name) {
                    const result = await supabase
                        .from("generic_alternatives")
                        .select("*")
                        .ilike("brand_name", `%${medicine.brand_name}%`)
                        .limit(1)
                        .maybeSingle();
                    data = result.data;
                }

                alternative = data;
            } else {
                // Try lookup directly in generic_alternatives by brand name or generic name matching medicine_id
                let { data } = await supabase
                    .from("generic_alternatives")
                    .select("*")
                    .ilike("brand_name", `%${medicine_id}%`)
                    .limit(1)
                    .maybeSingle();

                if (!data) {
                    const result = await supabase
                        .from("generic_alternatives")
                        .select("*")
                        .ilike("generic_name", `%${medicine_id}%`)
                        .limit(1)
                        .maybeSingle();
                    data = result.data;
                }

                alternative = data;
            }

            // Fallback: If generic_alternatives table is missing or empty, construct from medicines table directly
            if (!alternative && medicine) {
                const cleanedGenName = cleanGenericName(medicine.generic_name);

                // Try to find a matching generic medicine from Jan Aushadhi
                const { data: genericMeds } = await supabase
                    .from("medicines")
                    .select("id, brand_name, generic_name, mrp, jan_aushadhi_price")
                    .ilike("generic_name", `%${cleanedGenName}%`)
                    .ilike("manufacturer", "%Jan Aushadhi%")
                    .limit(1);

                const genericMed = genericMeds && genericMeds.length > 0 ? genericMeds[0] : null;

                if (genericMed) {
                    alternative = {
                        brand_name: medicine.brand_name,
                        generic_name: medicine.generic_name,
                        brand_price: medicine.mrp,
                        jan_aushadhi_price: genericMed.mrp || medicine.jan_aushadhi_price || 15.0,
                        savings_percentage: medicine.mrp
                            ? Math.round(
                                  ((medicine.mrp -
                                      (genericMed.mrp || medicine.jan_aushadhi_price || 15.0)) /
                                      medicine.mrp) *
                                      100
                              )
                            : 0,
                        generic_name_display:
                            genericMed.brand_name || `${medicine.generic_name} (Generic)`,
                    };
                } else if (medicine.jan_aushadhi_price) {
                    // Create synthetic alternative using the prices stored directly on the commercial medicine row
                    alternative = {
                        brand_name: medicine.brand_name,
                        generic_name: medicine.generic_name,
                        brand_price: medicine.mrp,
                        jan_aushadhi_price: medicine.jan_aushadhi_price,
                        savings_percentage: medicine.mrp
                            ? Math.round(
                                  ((medicine.mrp - medicine.jan_aushadhi_price) / medicine.mrp) *
                                      100
                              )
                            : 0,
                        generic_name_display: `${medicine.generic_name} (Generic)`,
                    };
                }
            }

            if (!alternative) {
                const searchBrand = medicine?.brand_name || medicine_id;
                const searchGeneric = medicine?.generic_name || "";
                const searchMrp = medicine?.mrp || 0;

                logger.info(
                    `Alternatives DB lookup failed. Attempting AI generation for "${searchBrand}"`
                );
                const aiAlt = await generateAlternativeWithAI(
                    searchBrand,
                    searchGeneric,
                    searchMrp
                );
                if (aiAlt) {
                    alternative = {
                        brand_name: aiAlt.brand_name,
                        generic_name: aiAlt.generic_name,
                        brand_price: aiAlt.brand_price,
                        jan_aushadhi_price: aiAlt.jan_aushadhi_price,
                        savings_percentage: aiAlt.savings_percentage,
                        generic_name_display: aiAlt.generic_name_display,
                    };
                    if (medicine) {
                        medicine.composition = aiAlt.usage;
                    } else {
                        medicine = {
                            id: "ai-generated",
                            brand_name: searchBrand,
                            generic_name: searchGeneric,
                            mrp: searchMrp,
                            composition: aiAlt.usage,
                        } as any;
                    }
                }
            }

            if (!alternative) {
                res.status(404).json({
                    error: "No generic alternative found for this medicine",
                    suggestion: "Visit your nearest Jan Aushadhi store or ask your pharmacist.",
                });
                return;
            }

            // 3. Find nearest pharmacy
            let nearestStore = null;

            if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
                // Call get_nearest_pharmacies RPC
                const { data: rpcData, error: rpcError } = await supabase.rpc(
                    "get_nearest_pharmacies",
                    {
                        query_lat: lat,
                        query_lng: lng,
                        search_radius_km: 100,
                    }
                );

                if (rpcError) {
                    logger.warn("Nearest pharmacy lookup failed", { error: rpcError });
                } else if (rpcData && rpcData.length > 0) {
                    nearestStore = {
                        name: rpcData[0].name,
                        lat: Number(rpcData[0].lat),
                        lng: Number(rpcData[0].lng),
                        distance: `${Number(rpcData[0].distance).toFixed(1)} km`,
                    };
                }
            }

            const brandPrice = Number(
                alternative.brand_price || alternative.brand_mrp || medicine?.mrp || 120.0
            );
            const jaPrice = Number(
                alternative.jan_aushadhi_price || medicine?.jan_aushadhi_price || 15.0
            );
            const savingsPct =
                alternative.savings_percentage ??
                Math.round(((brandPrice - jaPrice) / brandPrice) * 100);

            const responseData = {
                brand_name: alternative.brand_name || medicine?.brand_name || medicine_id,
                generic_name: cleanGenericName(alternative.generic_name || medicine?.generic_name),
                brand_price: brandPrice,
                jan_aushadhi_price: jaPrice,
                savings_percentage: savingsPct,
                alternative_name: alternative.generic_name_display
                    ? alternative.generic_name_display.includes(" (Generic)")
                        ? `${cleanGenericName(alternative.generic_name_display.replace(" (Generic)", ""))} (Generic)`
                        : cleanGenericName(alternative.generic_name_display)
                    : alternative.generic_name
                      ? `${cleanGenericName(alternative.generic_name)} (Generic)`
                      : medicine?.generic_name
                        ? `${cleanGenericName(medicine.generic_name)} (Generic)`
                        : "Atorvastatin 10mg (Generic)",
                nearest_store: nearestStore,
                usage:
                    medicine?.composition ||
                    "Used for treatment as prescribed by your healthcare provider.",
            };

            try {
                await redisClient.set(cacheKey, JSON.stringify(responseData), {
                    EX: 86400,
                });

                logger.info(`Alternatives cache SET: ${cacheKey}`);
            } catch (err) {
                logger.warn("Redis cache write failed", { err });
            }

            res.status(200).json(responseData);
        } catch (error) {
            logger.error("Error in alternatives lookup", { error });
            res.status(500).json({ error: "Failed to fetch medicine alternatives" });
        }
    }
);

export default router;
