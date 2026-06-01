import { Router, Request, Response } from "express";
import multer from "multer";
import logger from "../utils/logger";
import { supabase } from "../db/client";
import { getMlServiceUrl, MISSING_ML_SERVICE_URL_MESSAGE } from "../config/mlService";

/**
 * Escape ILIKE wildcard characters in a string derived from untrusted input
 * (e.g. OCR text). In PostgreSQL ILIKE patterns, % matches any sequence of
 * characters and _ matches any single character. Leaving them unescaped in
 * OCR-derived text causes overly broad matches that return far more rows than
 * intended and may expose unrelated medicine records.
 */
function escapeIlike(word: string): string {
    return word.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

const router = Router();

// ── Allowed image MIME types ─────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
]);

// Security: reject non-image uploads before they reach the ML container
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter(_req, file, cb) {
        if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
            cb(null, true);
        } else {
            // Pass error — multer will forward it to our error handler below
            cb(
                Object.assign(
                    new Error(
                        `Invalid file type "${file.mimetype}". Only JPEG, PNG, WEBP, GIF, and BMP images are accepted.`
                    ),
                    { code: "INVALID_MIME" }
                )
            );
        }
    },
});

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

    // Split candidate by standard delimiters
    const candidateParts = normalizedCandidate
        .split(/[\s,+/&.-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 2 && !FILLER_WORDS.has(t));

    if (candidateParts.length === 0) return 0;

    let matchedParts = 0;
    for (const part of candidateParts) {
        if (normalizedOcr.includes(part)) {
            matchedParts++;
        }
    }

    const coverage = matchedParts / candidateParts.length;
    if (coverage === 1) {
        return 100;
    } else if (coverage >= 0.5) {
        return Math.round(coverage * 85);
    }

    return 0;
}

/**
 * @openapi
 * /api/v1/scan/extract:
 *   post:
 *     tags:
 *       - Medicine Scanner
 *     summary: Extract medicine text from a packaging photo via OCR
 *     description: >
 *       Accepts a medicine packaging image (JPEG, PNG, WEBP, GIF, BMP — max 10MB),
 *       proxies it to the FastAPI ML OCR microservice, performs fuzzy brand/generic
 *       name matching against the CDSCO medicines database, and returns parsed fields
 *       (batch number, expiry date, brand name) alongside the full medicine record if matched.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Medicine packaging image (JPEG/PNG/WEBP/GIF/BMP, max 10MB)
 *     responses:
 *       200:
 *         description: OCR extraction successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 text:
 *                   type: string
 *                   example: "Dolo 650 Batch No. BN2024001 Exp 12/2026"
 *                 confidence:
 *                   type: number
 *                   example: 0.94
 *                 filename:
 *                   type: string
 *                   example: "medicine.jpg"
 *                 parsed:
 *                   type: object
 *                   properties:
 *                     batch:
 *                       type: string
 *                       example: "BN2024001"
 *                     expiry:
 *                       type: string
 *                       example: "2026-12-01"
 *                     brandName:
 *                       type: string
 *                       example: "Dolo 650"
 *                 medicine:
 *                   $ref: '#/components/schemas/Medicine'
 *                 matched:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid or missing image file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: ML OCR service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "OCR service is currently unavailable. Please verify manually."
 *                 details:
 *                   type: string
 */
router.post("/extract", (req: Request, res: Response) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (upload.single("file") as any)(req, res, async (multerErr: unknown) => {
        if (multerErr) {
            const msg = multerErr instanceof Error ? multerErr.message : "File upload error";
            logger.warn(`File upload rejected: ${msg}`);
            res.status(400).json({ error: msg });
            return;
        }

        // After multer runs, req.file is populated by the @types/multer augmentation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const file: Express.Multer.File | undefined = (req as any).file;

        if (!file) {
            res.status(400).json({ error: "No image file provided." });
            return;
        }

        const mlServiceUrl = getMlServiceUrl();
        if (!mlServiceUrl) {
            logger.error(MISSING_ML_SERVICE_URL_MESSAGE, { route: "/api/v1/scan/extract" });
            res.status(500).json({
                error: "OCR service is not configured.",
                code: "ML_SERVICE_URL_MISSING",
            });
            return;
        }

        const targetUrl = `${mlServiceUrl}/ocr/extract`;

        logger.info(
            `Proxying image "${file.originalname}" (${file.size} bytes, ${file.mimetype}) → ${targetUrl}`
        );

        try {
            const formData = new FormData();
            const blob = new Blob([new Uint8Array(file.buffer)], {
                type: file.mimetype,
            });
            formData.append("file", blob, file.originalname);

            const response = await fetch(targetUrl, {
                method: "POST",
                body: formData,
                signal: AbortSignal.timeout(30_000), // 30 s hard timeout
            });

            if (!response.ok) {
                let errorDetail = `ML service returned HTTP ${response.status}`;
                try {
                    const body = (await response.json()) as { detail?: string };
                    if (body.detail) errorDetail = body.detail;
                } catch {
                    // Non-JSON body — keep generic message
                }
                logger.error(`ML OCR error: ${errorDetail}`);
                res.status(response.status).json({ error: errorDetail });
                return;
            }

            const data = (await response.json()) as {
                text?: string;
                confidence?: number;
                filename?: string;
            };
            logger.info(`OCR extraction successful for "${file.originalname}"`);

            const rawText = data.text || "";
            const confidence = data.confidence ?? 0;

            // 1. Regex Parsing
            // Batch parsing
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
            let parsedBatch: string | null = null;
            for (const pattern of batchPatterns) {
                const match = rawText.match(pattern);
                if (match?.[1]) {
                    const candidate = match[1].trim().toUpperCase();
                    if (!BLOCKLIST.has(candidate)) {
                        parsedBatch = candidate;
                        break;
                    }
                }
            }

            // Expiry parsing
            const expiryPatterns = [
                /(?:EXP\.?(?:\s*DATE)?|EXPIRY(?:\s*DATE)?)\s*[:\-\.\s]*([0-9]{2})\s*[\/\-]\s*([0-9]{4})/i,
                /(?:EXP\.?(?:\s*DATE)?|EXPIRY(?:\s*DATE)?)\s*[:\-\.\s]*([0-9]{2})\s*[\/\-]\s*([0-9]{2})\b/i,
                /\b([0-9]{2})\s*[\/\-]\s*([0-9]{4})\b/,
                /\b([0-9]{2})\s*[\/\-]\s*([0-9]{2})\b/,
            ];
            let parsedExpiry: string | null = null;
            for (const pattern of expiryPatterns) {
                const match = rawText.match(pattern);
                if (match) {
                    const month = match[1];
                    const monthVal = parseInt(month, 10);
                    if (monthVal < 1 || monthVal > 12) {
                        continue;
                    }
                    let year = match[2];
                    if (year.length === 2) {
                        year = "20" + year;
                    }
                    parsedExpiry = `${year}-${month}-01`;
                    break;
                }
            }

            // 2. Fetch candidate medicine names using OCR keyword search
            //    WHY: The old approach fetched ALL rows from medicines table
            //    on every single scan — dangerous at 10k+ records (OOM crash).
            //    New approach: extract meaningful words from OCR text and
            //    search only for medicines whose name contains those words.
            let brandNames: string[] = [];
            let genericNames: string[] = [];
            try {
                // Extract meaningful search words from OCR text (skip short/filler words)
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
                    .slice(0, 6); // limit to top 6 meaningful words

                if (searchWords.length > 0) {
                    // Build OR filter: brand_name ILIKE any word OR generic_name ILIKE any word
                    const orFilter = searchWords
                        .map((w) => {
                            const safe = escapeIlike(w);
                            return `brand_name.ilike.%${safe}%,generic_name.ilike.%${safe}%`;
                        })
                        .join(",");

                    const { data: dbMedicines, error: dbError } = await supabase
                        .from("medicines")
                        .select("brand_name, generic_name")
                        .or(orFilter)
                        .limit(80); // hard cap — never more than 80 candidates

                    if (dbError) {
                        logger.error(`Database error fetching medicines: ${dbError.message}`);
                    } else if (dbMedicines) {
                        brandNames = Array.from(
                            new Set(
                                dbMedicines.map((m) => m.brand_name).filter(Boolean) as string[]
                            )
                        );
                        genericNames = Array.from(
                            new Set(
                                dbMedicines.map((m) => m.generic_name).filter(Boolean) as string[]
                            )
                        );
                    }
                }
            } catch (dbErr) {
                logger.error(`Failed to fetch brand/generic names from DB: ${dbErr}`);
            }

            // No hardcoded fallback — if DB has no match, we return unmatched result.
            // The app should prompt the user to verify manually in that case.

            // Combine both brand names and generic names as matching candidates
            const candidates = Array.from(new Set([...brandNames, ...genericNames]));

            // 3. Fuzzy match the brand name or generic name
            let matchedName: string | null = null;
            let matchScore = 0;
            let matchSource: "advanced" | "ml_fuzzy" | "substring_fallback" | "none" = "none";

            if (rawText && candidates.length > 0) {
                // First try advanced matching (smart token coverage)
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
                    logger.info(
                        `Advanced token match successful: "${matchedName}" with score ${matchScore}`
                    );
                }

                // If advanced match did not find a strong candidate, try the FastAPI fuzzy match
                if (!matchedName) {
                    try {
                        const matchResponse = await fetch(`${mlServiceUrl}/ocr/match`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                query: rawText,
                                medicines: candidates,
                            }),
                            signal: AbortSignal.timeout(10_000),
                        });

                        if (matchResponse.ok) {
                            const matches = (await matchResponse.json()) as Array<{
                                name: string;
                                score: number;
                            }>;
                            if (matches && matches.length > 0) {
                                const topMatch = matches.reduce((prev, current) =>
                                    prev.score > current.score ? prev : current
                                );
                                if (topMatch.score >= 50) {
                                    matchedName = topMatch.name;
                                    matchScore = topMatch.score;
                                    matchSource = "ml_fuzzy";
                                    logger.info(
                                        `ML fuzzy match successful: "${matchedName}" with score ${matchScore}`
                                    );
                                }
                            }
                        }
                    } catch (matchErr) {
                        logger.error(`FastAPI /ocr/match failed: ${matchErr}`);
                    }
                }

                // Resilient local substring fallback matching if ML match fails/offline
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
                            logger.info(
                                `Substring fallback match: "${matchedName}" (capped score ${matchScore})`
                            );
                            break;
                        }
                    }
                }
            }

            // 4. Query medicine record for matched name — explicit field select (no SELECT *)
            let medicineData: any = null;
            if (matchedName) {
                try {
                    const { data: dbMed, error: lookupError } = await supabase
                        .from("medicines")
                        .select(
                            "id, brand_name, generic_name, manufacturer, batch_number, " +
                                "expiry_date, cdsco_approval_status, is_counterfeit_alert, " +
                                "composition, mrp, jan_aushadhi_price"
                        )
                        .or(`brand_name.ilike.%${escapeIlike(matchedName)}%,generic_name.ilike.%${escapeIlike(matchedName)}%`)
                        .limit(1)
                        .maybeSingle();

                    if (lookupError) {
                        logger.error(
                            `Database lookup error for match ${matchedName}: ${lookupError.message}`
                        );
                    } else {
                        medicineData = dbMed;
                    }

                    // Verify the returned record actually matches — not just a substring hit
                    if (medicineData && matchSource === "substring_fallback") {
                        const dbBrand = (medicineData.brand_name || "").toLowerCase();
                        const dbGeneric = (medicineData.generic_name || "").toLowerCase();
                        const needle = matchedName!.toLowerCase();
                        if (dbBrand !== needle && dbGeneric !== needle) {
                            logger.warn(
                                `Dropping weak fallback match: "${matchedName}" resolved to "${medicineData.brand_name}" — not an exact name match`
                            );
                            medicineData = null;
                        }
                    }
                } catch (lookupErr) {
                    logger.error(
                        `Failed to lookup matched name ${matchedName} in database: ${lookupErr}`
                    );
                }
            }

            // 5. Construct rich response combining database record and parsed OCR fields
            let medicineResponse = null;
            if (medicineData) {
                medicineResponse = {
                    brand_name: medicineData.brand_name,
                    generic_name: medicineData.generic_name,
                    manufacturer: medicineData.manufacturer,
                    composition: medicineData.composition ?? null,
                    batch_number: parsedBatch || medicineData.batch_number,
                    expiry_date: parsedExpiry || medicineData.expiry_date,
                    cdsco_approval_status: medicineData.cdsco_approval_status,
                    is_counterfeit_alert: medicineData.is_counterfeit_alert,
                    // Pricing — helps citizens compare branded vs Jan Aushadhi price
                    mrp: medicineData.mrp ?? null,
                    jan_aushadhi_price: medicineData.jan_aushadhi_price ?? null,
                };
            }

            res.status(200).json({
                text: rawText,
                confidence: confidence,
                filename: data.filename || file.originalname,
                parsed: {
                    batch: parsedBatch,
                    expiry: parsedExpiry,
                    brandName: medicineResponse?.brand_name || matchedName,
                },
                medicine: medicineResponse,
                matched: !!medicineResponse,
                matchScore: matchedName ? matchScore : null,
                matchSource: matchedName ? matchSource : null,
            });
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Unknown error";
            logger.error(`Could not reach ML OCR service: ${msg}`);
            res.status(503).json({
                error: "OCR service is currently unavailable. Please verify manually.",
                details: msg,
            });
        }
    });
});

export default router;
