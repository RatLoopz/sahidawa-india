import { escapeIlike, escapePostgrest, buildOrConditions } from "../src/utils/dbUtils";

describe("escapeIlike", () => {
    it("escapes % to \\%", () => {
        expect(escapeIlike("50%")).toBe("50\\%");
    });

    it("escapes _ to \\_", () => {
        expect(escapeIlike("a_b")).toBe("a\\_b");
    });

    it("escapes \\ to \\\\", () => {
        expect(escapeIlike("a\\b")).toBe("a\\\\b");
    });

    it("escapes combinations like 50%_off\\", () => {
        expect(escapeIlike("50%_off\\")).toBe("50\\%\\_off\\\\");
    });

    it("leaves plain strings unchanged", () => {
        expect(escapeIlike("paracetamol")).toBe("paracetamol");
    });
});

describe("escapePostgrest", () => {
    it('escapes %, _, \\, and " characters', () => {
        expect(escapePostgrest('50%_off\\"')).toBe('50\\%\\_off\\\\""');
    });

    it("leaves plain strings unchanged", () => {
        expect(escapePostgrest("paracetamol")).toBe("paracetamol");
    });
});

describe("buildOrConditions", () => {
    it("builds an ilike OR filter string across fields and words", () => {
        const result = buildOrConditions(["brand_name", "generic_name"], ["para%cetamol"]);
        expect(result).toBe(
            'brand_name.ilike."%para\\%cetamol%",generic_name.ilike."%para\\%cetamol%"'
        );
    });
});
