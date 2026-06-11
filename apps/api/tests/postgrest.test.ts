import { escapePostgrest } from "../src/utils/postgrest";

describe("escapePostgrest", () => {
    it("wraps values in double quotes and preserves wildcard patterns", () => {
        expect(escapePostgrest("%aspirin%")).toBe('"%aspirin%"');
    });

    it("escapes embedded quotes and backslashes", () => {
        expect(escapePostgrest('a"b\\c')).toBe('"a\\"b\\\\c"');
    });
});
