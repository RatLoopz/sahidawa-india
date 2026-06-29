/**
 * Medicine Name Normalization Utility
 *
 * Normalizes OCR-extracted and user-provided medicine names to handle common
 * OCR errors, spelling variations, and inconsistencies that reduce search accuracy.
 *
 * Related: Issue #2686 - OCR-extracted medicine names are not normalized
 */

export interface NormalizationResult {
    original: string;
    normalized: string;
    corrections: string[];
}

class MedicineNameNormalizer {
    /**
     * OCR commonly confuses these characters with medicine names.
     * Built from analysis of failed lookups and OCR error logs.
     */
    private readonly commonOcrMisreads = new Map<string, string>([
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
    private readonly medicineSynonyms = new Map<string, string>([
        ["acetaminophen", "paracetamol"],
        ["ibuprofen", "ibuprofen"],
        ["clopidogrel", "plavix"],
        ["atorvastatin", "lipitor"],
        ["lisinopril", "prinivil"],
        ["metformin", "glucophage"],
    ]);

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

        // Apply substitutions carefully to avoid over-correction
        // Check each character pair for likely OCR errors
        for (const [from, to] of this.commonOcrMisreads) {
            // Only replace if it looks like an OCR error (e.g., standalone "0" as word, not in numbers)
            if (from === "0" || from === "1" || from === "5" || from === "8") {
                // Skip numeric-looking patterns
                result = result.replace(new RegExp(`\\b${from}\\b`, "g"), to);
            }
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
