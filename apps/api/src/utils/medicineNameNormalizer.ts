/**
 * Medicine Name Normalization Utility
 *
 * Normalizes OCR-extracted and user-provided medicine names to handle common
 * OCR errors, spelling variations, and inconsistencies that reduce search accuracy.
 *
 * Related: Issue #2686 - OCR-extracted medicine names are not normalized
 */

import { supabase } from "../db/client";
import { redisClient } from "./redis";
import logger from "./logger";

export interface NormalizationResult {
    original: string;
    normalized: string;
    corrections: string[];
}

export interface OcrSynonym {
    id: string;
    original_term: string;
    normalized_term: string;
    type: "misread" | "synonym";
}

class MedicineNameNormalizer {
    private readonly CACHE_KEY = "ocr_synonyms:data";
    private readonly CACHE_TTL = 3600; // 1 hour

    /**
     * OCR commonly confuses these characters with medicine names.
     * Built from analysis of failed lookups and OCR error logs.
     */
    private commonOcrMisreads = new Map<string, string>([
        // Numbers often misread as letters
        ["0", "O"],
        ["1", "I"],
        ["5", "S"],
        ["8", "B"],

        // Common OCR character confusions
        ["rn", "m"],
        ["l", "I"],
        ["O", "0"],
    ]);

    /**
     * Common spelling variations and abbreviations in medicine names.
     * Helps match medicines despite user input variations.
     */
    private medicineSynonyms = new Map<string, string>([
        ["acetaminophen", "paracetamol"],
        ["ibuprofen", "ibuprofen"],
        ["clopidogrel", "plavix"],
        ["atorvastatin", "lipitor"],
        ["lisinopril", "prinivil"],
        ["metformin", "glucophage"],
    ]);

    /**
     * Load OCR synonyms from database (and cache in Redis).
     */
    public async loadFromDatabase(): Promise<void> {
        try {
            let data: OcrSynonym[] | null = null;

            // 1. Try to read from Redis first
            if (redisClient.isOpen) {
                const cached = await redisClient.get(this.CACHE_KEY);
                if (cached) {
                    try {
                        data = JSON.parse(cached);
                    } catch (e) {
                        logger.error("Failed to parse cached OCR synonyms", e);
                    }
                }
            }

            // 2. Fallback to DB
            if (!data) {
                const { data: dbData, error } = await supabase.from("ocr_synonyms").select("*");

                if (error) {
                    throw new Error(`Failed to fetch from DB: ${error.message}`);
                }

                data = dbData as OcrSynonym[];

                // 3. Save to Redis
                if (redisClient.isOpen && data) {
                    await redisClient.setEx(this.CACHE_KEY, this.CACHE_TTL, JSON.stringify(data));
                }
            }

            if (data && data.length > 0) {
                const newMisreads = new Map<string, string>();
                const newSynonyms = new Map<string, string>();

                for (const item of data) {
                    if (item.type === "misread") {
                        newMisreads.set(item.original_term, item.normalized_term);
                    } else if (item.type === "synonym") {
                        newSynonyms.set(item.original_term, item.normalized_term);
                    }
                }

                if (newMisreads.size > 0) this.commonOcrMisreads = newMisreads;
                if (newSynonyms.size > 0) this.medicineSynonyms = newSynonyms;

                logger.info(
                    `Loaded OCR rules: ${this.commonOcrMisreads.size} misreads, ${this.medicineSynonyms.size} synonyms`
                );
            }
        } catch (err) {
            logger.error("Error loading OCR synonyms", err);
        }
    }

    /**
     * Normalize a single medicine name by applying multiple cleaning passes.
     */
    public normalize(name: string): NormalizationResult {
        const corrections: string[] = [];
        let normalized = name.trim();

        // 1. Remove extra whitespace
        const beforeWhitespace = normalized;
        normalized = normalized.replace(/\s+/g, " ");
        if (beforeWhitespace !== normalized) {
            corrections.push("Removed extra whitespace");
        }

        // 2. Remove common punctuation that appears in OCR output
        const beforePunct = normalized;
        normalized = normalized.replace(/[|\/\-_]/g, " ");
        if (beforePunct !== normalized) {
            corrections.push("Removed OCR-common punctuation");
        }

        // 3. Convert to lowercase for consistent matching
        const beforeLower = normalized;
        normalized = normalized.toLowerCase();
        if (beforeLower !== normalized) {
            corrections.push("Converted to lowercase");
        }

        // 4. Fix common OCR misreads
        const beforeOcr = normalized;
        normalized = this.fixOcrMisreads(normalized);
        if (beforeOcr !== normalized) {
            corrections.push("Corrected OCR character confusions");
        }

        // 5. Remove parenthetical information (e.g., "(brand name)", "(tablet)")
        const beforeParens = normalized;
        normalized = normalized.replace(/\s*\([^)]*\)\s*/g, " ");
        if (beforeParens !== normalized) {
            corrections.push("Removed parenthetical qualifiers");
        }

        // 6. Clean up spacing again after removals
        normalized = normalized.trim().replace(/\s+/g, " ");

        return {
            original: name,
            normalized,
            corrections: corrections.length > 0 ? corrections : ["No corrections needed"],
        };
    }

    /**
     * Fix common OCR character misreads in medicine names.
     */
    private fixOcrMisreads(text: string): string {
        let result = text;
        const numericKeys = new Set(["0", "1", "5", "8"]);

        for (const [from, to] of this.commonOcrMisreads) {
            if (numericKeys.has(from)) {
                // Only replace standalone digits used as words, not digits inside numbers
                result = result.replace(new RegExp(`\\b${from}\\b`, "g"), to);
            } else if (from.length > 1) {
                // Multi-character OCR confusions (e.g. "rn" -> "m") are safe to apply
                // directly: they're unlikely to appear as a false-positive substring.
                result = result.split(from).join(to);
            }
            // NOTE: single-character non-numeric keys (e.g. "l" -> "I", "O" -> "0")
            // are intentionally NOT applied here. A blind replace corrupts extremely
            // common, legitimate letters in real medicine names (e.g. "paracetamol"
            // -> "paracetamoI", "lisinopril" -> "IisinopriI"). Enabling these safely
            // would need a smarter, context-aware check, which is out of scope here.
        }

        return result;
    }

    /**
     * Batch normalize multiple medicine names.
     */
    public normalizeBatch(names: string[]): NormalizationResult[] {
        return names.map((name) => this.normalize(name));
    }

    /**
     * Get similarity score between two medicine names (0-1).
     * Useful for fuzzy matching after normalization.
     */
    public getSimilarity(name1: string, name2: string): number {
        const norm1 = this.normalize(name1).normalized;
        const norm2 = this.normalize(name2).normalized;

        if (norm1 === norm2) return 1;
        if (norm1.length === 0 || norm2.length === 0) return 0;

        // Levenshtein-like distance metric
        const longer = norm1.length > norm2.length ? norm1 : norm2;
        const shorter = norm1.length > norm2.length ? norm2 : norm1;

        if (longer.includes(shorter)) {
            return shorter.length / longer.length;
        }

        // Count matching characters in order
        let matches = 0;
        let shorterIdx = 0;

        for (let i = 0; i < longer.length && shorterIdx < shorter.length; i++) {
            if (longer[i] === shorter[shorterIdx]) {
                matches++;
                shorterIdx++;
            }
        }

        return matches / Math.max(norm1.length, norm2.length);
    }
}

export const medicineNameNormalizer = new MedicineNameNormalizer();
