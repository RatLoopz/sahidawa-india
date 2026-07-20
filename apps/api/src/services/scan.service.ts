import { scanRepository } from "../repositories/scan.repository";
import { redisRepository } from "../repositories/redis.repository";
import logger from "../utils/logger";

function calculateAdvancedMatchScore(ocrText: string, candidate: string): number {
    const normalizedOcr = ocrText
        .toLowerCase()
        .replace(/amoxycillin/g, "amoxicillin")
        .replace(/clavulanic/g, "clavulanate");
    const normalizedCandidate = candidate
        .toLowerCase()
        .replace(/amoxycillin/g, "amoxicillin")
        .replace(/clavulanic/g, "clavulanate");

    const FILLER_WORDS = new Set([
        "acid",
        "tablets",
        "tablet",
        "capsule",
        "capsules",
        "mg",
        "mcg",
        "g",
        "ml",
        "ip",
        "bp",
        "usp",
        "diluted",
        "anhydrous",
        "trihydrate",
        "potassium",
        "sodium",
        "and",
        "plus",
    ]);

    const candidateParts = normalizedCandidate
        .split(/[\s,+/&.-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 2 && !FILLER_WORDS.has(t));
    if (candidateParts.length === 0) return 0;

    let matchedParts = 0;
    for (const part of candidateParts) {
        if (normalizedOcr.includes(part)) matchedParts++;
    }

    const coverage = matchedParts / candidateParts.length;
    if (coverage === 1) return 100;
    if (coverage >= 0.5) return Math.round(coverage * 85);
    return 0;
}

function parseBatch(rawText: string): string | null {
    const batchPatterns = [
        /(?:B\.?\s*No\.?|Batch\s*(?:No\.?)?|LOT\s*No\.?|Lot\s*No\.?)\s*[:\-\.\s]*([A-Z0-9][A-Z0-9\-\/]{2,14})/i,
        /\b([A-Z]{1,3}[0-9]{3,10}[A-Z0-9]*)\b/,
    ];
    const BLOCKLIST = new Set([
        "CDSCO",
        "APPROVED",
        "TABLET",
        "EXPIRY",
        "BATCH",
        "MANUFACTURING",
        "MRP",
        "RS",
        "INR",
        "MFG",
        "EXP",
    ]);
    for (const pattern of batchPatterns) {
        const match = rawText.match(pattern);
        if (match?.[1]) {
            const candidate = match[1].trim().toUpperCase();
            if (!BLOCKLIST.has(candidate)) return candidate;
        }
    }
    return null;
}

function parseExpiry(rawText: string): string | null {
    const expiryPatterns = [
        /(?:EXP\.?(?:\s*DATE)?|EXPIRY(?:\s*DATE)?)\s*[:\-\.\s]*(0[1-9]|1[0-2])\s*[\/\-]\s*([0-9]{4})/i,
        /(?:EXP\.?(?:\s*DATE)?|EXPIRY(?:\s*DATE)?)\s*[:\-\.\s]*(0[1-9]|1[0-2])\s*[\/\-]\s*([0-9]{2})\b/i,
        /\b(0[1-9]|1[0-2])\s*[\/\-]\s*([0-9]{4})\b/,
        /\b(0[1-9]|1[0-2])\s*[\/\-]\s*([0-9]{2})\b/,
    ];
    for (const pattern of expiryPatterns) {
        const match = rawText.match(pattern);
        if (match) {
            const month = match[1];
            const monthVal = parseInt(month, 10);
            if (monthVal < 1 || monthVal > 12) continue;
            let year = match[2];
            if (year.length === 2) year = "20" + year;
            return `${year}-${month}-01`;
        }
    }
    return null;
}

export const scanService = {
    // Used inside POST /extract route (after OCR text is obtained)
    async matchMedicineFromOcrText(rawText: string, mlServiceUrl: string) {
        const parsedBatch = parseBatch(rawText);
        const parsedExpiry = parseExpiry(rawText);

        // Fetch candidates via keyword search
        const FILLER = new Set([
            "the",
            "and",
            "for",
            "tab",
            "cap",
            "mg",
            "ml",
            "ip",
            "bp",
            "usp",
            "ltd",
            "pvt",
        ]);
        const searchWords = rawText
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .map((w) => w.trim())
            .filter((w) => w.length > 3 && !FILLER.has(w))
            .slice(0, 6);

        let brandNames: string[] = [];
        let genericNames: string[] = [];
        if (searchWords.length > 0) {
            const dbMedicines = await scanRepository.searchMedicinesByWords(searchWords);
            if (dbMedicines) {
                brandNames = Array.from(
                    new Set(dbMedicines.map((m) => m.brand_name).filter(Boolean) as string[])
                );
                genericNames = Array.from(
                    new Set(dbMedicines.map((m) => m.generic_name).filter(Boolean) as string[])
                );
            }
        }

        const candidates = Array.from(new Set([...brandNames, ...genericNames]));

        let matchedName: string | null = null;
        let matchScore = 0;
        let matchSource: "advanced" | "ml_fuzzy" | "substring_fallback" | "none" = "none";

        if (rawText && candidates.length > 0) {
            let bestAdvancedCandidate: string | null = null;
            let bestAdvancedScore = 0;
            for (const candidate of candidates) {
                const score = calculateAdvancedMatchScore(rawText, candidate);
                if (score > bestAdvancedScore) {
                    bestAdvancedScore = score;
                    bestAdvancedCandidate = candidate;
                }
            }
            if (bestAdvancedScore >= 80) {
                matchedName = bestAdvancedCandidate;
                matchScore = bestAdvancedScore;
                matchSource = "advanced";
            }

            if (!matchedName) {
                try {
                    const matchResponse = await fetch(`${mlServiceUrl}/ocr/match`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ query: rawText, medicines: candidates }),
                        signal: AbortSignal.timeout(10_000),
                    });
                    if (matchResponse.ok) {
                        const matches = (await matchResponse.json()) as Array<{
                            name: string;
                            score: number;
                        }>;
                        if (matches?.length > 0) {
                            const topMatch = matches.reduce((prev, cur) =>
                                prev.score > cur.score ? prev : cur
                            );
                            if (topMatch.score >= 50) {
                                matchedName = topMatch.name;
                                matchScore = topMatch.score;
                                matchSource = "ml_fuzzy";
                            }
                        }
                    }
                } catch (err) {
                    logger.error(`FastAPI /ocr/match failed: ${err}`);
                }
            }

            if (!matchedName) {
                const normalizedText = rawText.toLowerCase();
                for (const name of candidates) {
                    const lowerName = name.toLowerCase();
                    if (lowerName.length < 5) continue;
                    const escaped = lowerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    const boundary = new RegExp(`\\b${escaped}\\b`);
                    if (boundary.test(normalizedText)) {
                        matchedName = name;
                        matchScore = 60;
                        matchSource = "substring_fallback";
                        break;
                    }
                }
            }
        }

        type MedicineRecord = Awaited<ReturnType<typeof scanRepository.findMedicineByBrandName>>;

        let medicineData: MedicineRecord = null;
        if (matchedName) {
            medicineData = await scanRepository.findMedicineByBrandName(matchedName);
            if (medicineData && matchSource === "substring_fallback") {
                const dbBrand = (medicineData.brand_name || "").toLowerCase();
                const dbGeneric = (medicineData.generic_name || "").toLowerCase();
                const needle = matchedName.toLowerCase();
                if (dbBrand !== needle && dbGeneric !== needle) {
                    logger.warn(
                        `Dropping weak fallback match: "${matchedName}" resolved to "${medicineData.brand_name}"`
                    );
                    medicineData = null;
                }
            }
        }

        let medicineResponse = null;
        if (medicineData) {
            medicineResponse = {
                id: medicineData.id,
                brand_name: medicineData.brand_name,
                generic_name: medicineData.generic_name,
                manufacturer: medicineData.manufacturer,
                composition: medicineData.composition ?? null,
                batch_number: parsedBatch || medicineData.batch_number,
                expiry_date: parsedExpiry || medicineData.expiry_date,
                cdsco_approval_status: medicineData.cdsco_approval_status,
                is_counterfeit_alert: medicineData.is_counterfeit_alert,
                is_cdsco_verified: medicineData.is_cdsco_verified,
                cdsco_match_score: medicineData.cdsco_match_score,
                matched_cdsco_product: medicineData.matched_cdsco_product,
                matched_cdsco_manufacturer: medicineData.matched_cdsco_manufacturer,
                product_match_score: medicineData.product_match_score,
                manufacturer_match_score: medicineData.manufacturer_match_score,
                mrp: medicineData.mrp ?? null,
                jan_aushadhi_price: medicineData.jan_aushadhi_price ?? null,
            };
        }

        return {
            parsedBatch,
            parsedExpiry,
            matchedName,
            matchScore,
            matchSource,
            medicineResponse,
        };
    },

    // POST /match
    async fuzzyMatch(query: string) {
        const normalizedQuery = query.trim().toLowerCase();
        const cacheKey = `match_cache:${normalizedQuery}`;

        const cached = await redisRepository.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const { data, error } = await scanRepository.rpcSearchMedicinesText(query, 3);
        if (error) {
            throw Object.assign(new Error("Database query failed"), { status: 500 });
        }

        if (!data || data.length === 0) {
            const words = query
                .trim()
                .split(/\s+/)
                .filter((w: string) => w.length > 2);
            if (words.length > 1) {
                const fallback = await scanRepository.searchMedicinesFallback(words);
                if (fallback && fallback.length > 0) {
                    const fallbackResult = fallback.map((m) => ({
                        name: m.brand_name || m.generic_name,
                        score: 60,
                    }));
                    await redisRepository.set(cacheKey, JSON.stringify(fallbackResult), 3600);
                    return fallbackResult;
                }
            }
            await redisRepository.set(cacheKey, JSON.stringify([]), 3600);
            return [];
        }

        const matches = data.map((m: any) => ({
            name: m.brand_name || m.generic_name,
            score: Math.round((m.similarity ?? 0) * 100),
        }));
        await redisRepository.set(cacheKey, JSON.stringify(matches), 3600);
        return matches;
    },

    // POST /verify-brand
    async verifyBrand(brandName: string) {
        const normalizedBrand = brandName.trim().toLowerCase();
        const cacheKey = `brand_cache:${normalizedBrand}`;

        const cached = await redisRepository.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const data = await scanRepository.findMedicineByBrandName(brandName);
        if (!data) {
            throw Object.assign(new Error("Medicine not found"), { status: 404 });
        }

        const responseData = {
            verified: true,
            medicine: {
                id: data.id,
                brand_name: data.brand_name,
                generic_name: data.generic_name,
                manufacturer: data.manufacturer,
                batch_number: data.batch_number,
                expiry_date: data.expiry_date,
                cdsco_approval_status: data.cdsco_approval_status,
                is_counterfeit_alert: data.is_counterfeit_alert,
                is_cdsco_verified: data.is_cdsco_verified,
                cdsco_match_score: data.cdsco_match_score,
                matched_cdsco_product: data.matched_cdsco_product,
                matched_cdsco_manufacturer: data.matched_cdsco_manufacturer,
                product_match_score: data.product_match_score,
                manufacturer_match_score: data.manufacturer_match_score,
            },
        };

        await redisRepository.set(cacheKey, JSON.stringify(responseData), 86400);
        return responseData;
    },
};
