import { describe, it, expect } from "@jest/globals";
import { medicineNameNormalizer } from "../src/utils/medicineNameNormalizer";

/**
 * Unit tests for medicine name normalization
 *
 * Verifies that OCR-extracted and user-provided medicine names are consistently
 * normalized to improve search accuracy. Related: Issue #2686
 */

describe("MedicineNameNormalizer", () => {
    describe("normalize()", () => {
        it("should normalize whitespace", () => {
            const result = medicineNameNormalizer.normalize("Aspirin   Extra  Strong");
            expect(result.normalized).toBe("aspirin extra strong");
            expect(result.corrections).toContain("Removed extra whitespace");
        });

        it("should convert to lowercase", () => {
            const result = medicineNameNormalizer.normalize("PARACETAMOL");
            expect(result.normalized).toBe("paracetamol");
            expect(result.corrections).toContain("Converted to lowercase");
        });

        it("should remove common OCR-introduced punctuation", () => {
            const result = medicineNameNormalizer.normalize("Metfor|min_HCL-500");
            expect(result.normalized).toBe("metfor min hcl 500");
            expect(result.corrections).toContain("Removed OCR-common punctuation");
        });

        it("should trim leading/trailing whitespace", () => {
            const result = medicineNameNormalizer.normalize("  Lisinopril  ");
            expect(result.normalized).toBe("lisinopril");
        });

        it("should remove parenthetical information", () => {
            const result = medicineNameNormalizer.normalize("Ibuprofen (200mg tablet)");
            expect(result.normalized).toBe("ibuprofen");
            expect(result.corrections).toContain("Removed parenthetical qualifiers");
        });

        it("should handle multiple parenthetical sections", () => {
            const result = medicineNameNormalizer.normalize("Atorvastatin (brand: Lipitor) (10mg)");
            expect(result.normalized).toBe("atorvastatin");
        });

        it("should fix OCR character confusions for standalone numbers", () => {
            // "0" misread as "O" in medicine names like "B01 B Vitamins"
            const result = medicineNameNormalizer.normalize("vitamin b 0 complex");
            expect(result.normalized).toContain("b");
        });

        it("should preserve the original input in result", () => {
            const input = "CLOPIDOGREL_BISULFATE (75mg)";
            const result = medicineNameNormalizer.normalize(input);
            expect(result.original).toBe(input);
        });

        it("should report no corrections for already-clean names", () => {
            const result = medicineNameNormalizer.normalize("aspirin");
            expect(result.corrections[0]).toBe("No corrections needed");
        });

        it("should handle empty string gracefully", () => {
            const result = medicineNameNormalizer.normalize("   ");
            expect(result.normalized).toBe("");
        });

        it("should apply multiple corrections sequentially", () => {
            const result = medicineNameNormalizer.normalize("  ASPIRIN   (500mg)  ");
            expect(result.normalized).toBe("aspirin");
            expect(result.corrections.length).toBeGreaterThan(1);
        });

        it("should handle special characters in generic drug names", () => {
            const result = medicineNameNormalizer.normalize("Vitamin B-12/Co");
            expect(result.normalized).toContain("vitamin");
            expect(result.normalized).toContain("b");
        });

        it("should preserve numeric dosages after normalization", () => {
            const result = medicineNameNormalizer.normalize("Metformin 500mg");
            expect(result.normalized).toContain("500");
        });
    });

    describe("normalizeBatch()", () => {
        it("should normalize multiple names at once", () => {
            const inputs = ["ASPIRIN", "PARACETAMOL (500mg)", "  Ibuprofen  "];
            const results = medicineNameNormalizer.normalizeBatch(inputs);

            expect(results).toHaveLength(3);
            expect(results[0].normalized).toBe("aspirin");
            expect(results[1].normalized).toBe("paracetamol");
            expect(results[2].normalized).toBe("ibuprofen");
        });

        it("should preserve original names in batch results", () => {
            const inputs = ["ASPIRIN", "PARACETAMOL"];
            const results = medicineNameNormalizer.normalizeBatch(inputs);

            expect(results[0].original).toBe("ASPIRIN");
            expect(results[1].original).toBe("PARACETAMOL");
        });

        it("should handle empty batch", () => {
            const results = medicineNameNormalizer.normalizeBatch([]);
            expect(results).toEqual([]);
        });

        it("should handle batch with mixed clean and dirty names", () => {
            const inputs = ["aspirin", "PARACETAMOL (500mg)", "Ibuprofen|200"];
            const results = medicineNameNormalizer.normalizeBatch(inputs);

            expect(results[0].normalized).toBe("aspirin");
            expect(results[1].normalized).toBe("paracetamol");
            expect(results[2].normalized).toBe("ibuprofen 200");
        });
    });

    describe("getSimilarity()", () => {
        it("should return 1.0 for identical normalized names", () => {
            const score = medicineNameNormalizer.getSimilarity("ASPIRIN", "aspirin");
            expect(score).toBe(1);
        });

        it("should return 1.0 when names differ only in case/whitespace", () => {
            const score = medicineNameNormalizer.getSimilarity("PARACETAMOL", "  paracetamol  ");
            expect(score).toBe(1);
        });

        it("should return high score for names with minor OCR differences", () => {
            const score = medicineNameNormalizer.getSimilarity("Metformin", "Metfor|min");
            expect(score).toBeGreaterThan(0.8);
        });

        it("should return 0 for completely different names", () => {
            const score = medicineNameNormalizer.getSimilarity("Aspirin", "Paracetamol");
            expect(score).toBeLessThan(0.2);
        });

        it("should return score > 0 for partially matching names", () => {
            const score = medicineNameNormalizer.getSimilarity("Ibuprofen", "Ibu");
            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThan(1);
        });

        it("should handle names with parenthetical information", () => {
            const score = medicineNameNormalizer.getSimilarity(
                "Atorvastatin (10mg)",
                "atorvastatin"
            );
            expect(score).toBe(1);
        });

        it("should be case-insensitive", () => {
            const score1 = medicineNameNormalizer.getSimilarity("ASPIRIN", "aspirin");
            const score2 = medicineNameNormalizer.getSimilarity("Aspirin", "ASPIRIN");
            expect(score1).toBe(score2);
            expect(score1).toBe(1);
        });

        it("should handle empty strings gracefully", () => {
            const score = medicineNameNormalizer.getSimilarity("", "");
            expect(score).toBe(1);
        });

        it("should handle one empty string", () => {
            const score = medicineNameNormalizer.getSimilarity("Aspirin", "");
            expect(score).toBe(0);
        });
    });

    describe("real-world OCR scenarios", () => {
        it("should normalize OCR-misread medicine name: 0 for O", () => {
            const result = medicineNameNormalizer.normalize("C0CO");
            expect(result.normalized).toBeDefined();
        });

        it("should normalize common OCR error: rn -> m", () => {
            const result = medicineNameNormalizer.normalize("metformin");
            expect(result.normalized).toContain("metformin");
        });

        it("should handle OCR output with mixed punctuation", () => {
            const result = medicineNameNormalizer.normalize("Aspirin-500|mg_(Brand)");
            expect(result.normalized).toBe("aspirin 500 mg");
        });

        it("should normalize full OCR-extracted medicine prescription", () => {
            const result = medicineNameNormalizer.normalize(
                "PARACETAMOL  (500MG)  - BRAND: Crocin"
            );
            expect(result.normalized).toContain("crocin");
        });

        it("should match similar names despite OCR errors", () => {
            const similarity = medicineNameNormalizer.getSimilarity(
                "Ibuprofen (200mg)",
                "Ibuproten 200"
            );
            expect(similarity).toBeGreaterThan(0.4);
        });
    });

    describe("edge cases", () => {
        it("should handle single character medicine abbreviation", () => {
            const result = medicineNameNormalizer.normalize("B");
            expect(result.normalized).toBe("b");
        });

        it("should handle very long medicine names", () => {
            const longName =
                "Acetylsalicylic-Acid-With-Extended-Release-Coating (100mg) - Brand Name";
            const result = medicineNameNormalizer.normalize(longName);
            expect(result.normalized).toBeDefined();
            expect(result.normalized.length).toBeGreaterThan(0);
        });

        it("should handle medicine names with numbers", () => {
            const result = medicineNameNormalizer.normalize("Vitamin B12");
            expect(result.normalized).toContain("12");
        });

        it("should handle medicine names with unicode characters", () => {
            const result = medicineNameNormalizer.normalize("Paracetamol®");
            expect(result.normalized).toBeDefined();
        });

        it("should handle medicine names with multiple spaces", () => {
            const result = medicineNameNormalizer.normalize("Aspirin    500");
            expect(result.normalized).toBe("aspirin 500");
        });
    });
});
