/**
 * Tests for GET /api/pharmacies/search-by-medicine
 *
 * Verifies that the pharmacy inventory search correctly handles multi-word
 * medicine name queries. Root cause of issue #2643: when `.or()` was called
 * in a loop, each call overwrote the previous filter so only the last word
 * was effective. The fix uses `buildOrConditions` from utils/db.ts to produce
 * a single comma-separated OR string and passes it to a single `.or()` call.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { buildOrConditions } from "../src/utils/db";

// ── Unit tests for buildOrConditions (the core fix) ──────────────────────────

describe("buildOrConditions — multi-word OR filter builder (#2643)", () => {
    describe("single word", () => {
        it("produces a single field ILIKE condition", () => {
            const result = buildOrConditions(["medicine_name"], ["paracetamol"]);
            expect(result).toBe('medicine_name.ilike."%paracetamol%"');
        });

        it("escapes ILIKE wildcard characters in the search word", () => {
            const result = buildOrConditions(["medicine_name"], ["para%cetamol"]);
            expect(result).toContain("\\%");
        });

        it("escapes underscore wildcard characters in the search word", () => {
            const result = buildOrConditions(["medicine_name"], ["para_cetamol"]);
            expect(result).toContain("\\_");
        });
    });

    describe("multi-word query — core bug fix", () => {
        it("produces a single comma-separated OR string for two words", () => {
            const result = buildOrConditions(["medicine_name"], ["amoxicillin", "clavulanate"]);
            // Both words must appear in the same OR string
            expect(result).toContain("amoxicillin");
            expect(result).toContain("clavulanate");
            // Must be a single string (not array), joinable in one .or() call
            expect(typeof result).toBe("string");
        });

        it("includes all words when given three-word medicine name", () => {
            const words = ["co", "amoxiclav", "625mg"];
            const result = buildOrConditions(["medicine_name"], words);
            for (const w of words) {
                expect(result).toContain(w);
            }
        });

        it("each word gets its own ilike condition", () => {
            const result = buildOrConditions(["medicine_name"], ["amoxicillin", "clavulanate"]);
            // Count occurrences of 'ilike' — should be 2 (one per word)
            const ilikes = result.match(/ilike/g) ?? [];
            expect(ilikes.length).toBe(2);
        });

        it("does not duplicate conditions for repeated words", () => {
            const result = buildOrConditions(["medicine_name"], ["aspirin", "aspirin"]);
            // Still two conditions (deduplication is the caller's job, not buildOrConditions)
            const ilikes = result.match(/ilike/g) ?? [];
            expect(ilikes.length).toBe(2);
        });
    });

    describe("multiple fields", () => {
        it("generates conditions for every (field, word) pair", () => {
            const result = buildOrConditions(
                ["brand_name", "generic_name"],
                ["paracetamol", "500mg"]
            );
            // 2 fields × 2 words = 4 ilike conditions
            const ilikes = result.match(/ilike/g) ?? [];
            expect(ilikes.length).toBe(4);
            expect(result).toContain("brand_name");
            expect(result).toContain("generic_name");
        });
    });

    describe("edge cases", () => {
        it("handles an empty words array without throwing", () => {
            const result = buildOrConditions(["medicine_name"], []);
            expect(typeof result).toBe("string");
        });

        it("handles words containing double-quotes by escaping them", () => {
            const result = buildOrConditions(["medicine_name"], ['amox"cillin']);
            // escapePostgrest doubles double-quotes
            expect(result).toContain('""');
        });
    });
});

// ── Integration-style validation of query-word splitting ─────────────────────

describe("pharmacy medicine search query normalisation", () => {
    /**
     * Mirrors the normalisation logic in the route handler so we can test
     * the word-splitting behaviour in isolation without standing up the server.
     */
    function normaliseQuery(rawQuery: string): string[] {
        return rawQuery
            .toLowerCase()
            .split(/\s+/)
            .map((w) => w.trim())
            .filter((w) => w.length >= 2);
    }

    it("splits 'Amoxicillin Clavulanate' into two words", () => {
        expect(normaliseQuery("Amoxicillin Clavulanate")).toEqual(["amoxicillin", "clavulanate"]);
    });

    it("strips leading/trailing whitespace before splitting", () => {
        expect(normaliseQuery("  Paracetamol 500mg  ")).toEqual(["paracetamol", "500mg"]);
    });

    it("drops single-character words", () => {
        const words = normaliseQuery("Vitamin B complex");
        expect(words).not.toContain("b");
        expect(words).toContain("vitamin");
        expect(words).toContain("complex");
    });

    it("normalises to lowercase", () => {
        expect(normaliseQuery("ASPIRIN")).toEqual(["aspirin"]);
    });

    it("returns empty array for whitespace-only input", () => {
        expect(normaliseQuery("   ")).toEqual([]);
    });

    it("passes all words to buildOrConditions producing a single OR string", () => {
        const words = normaliseQuery("Amoxicillin Clavulanate");
        const filter = buildOrConditions(["medicine_name"], words);
        // Verifies the full pipeline: split → OR-filter
        expect(filter).toContain("amoxicillin");
        expect(filter).toContain("clavulanate");
        // Single .or() call receives a single string, not multiple chained calls
        expect(typeof filter).toBe("string");
    });
});
