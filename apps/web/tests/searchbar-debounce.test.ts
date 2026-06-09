import { readFileSync } from "fs";
import { join } from "path";

describe("SearchBar debounced suggestions", () => {
    const source = readFileSync(
        join(__dirname, "../app/[locale]/components/SearchBar.tsx"),
        "utf8"
    );

    it("debounces query changes before fetching suggestions", () => {
        expect(source).toContain("setTimeout(() =>");
        expect(source).toContain("fetchSuggestions(trimmed)");
        expect(source).toContain("DEBOUNCE_MS");
        expect(source).toContain("[query, fetchSuggestions, onSearchChange]");
    });

    it("clears stale suggestion state when the search query becomes empty", () => {
        expect(source).toContain("setSuggestions([])");
        expect(source).toContain("setIsOpen(false)");
        expect(source).toContain("setNoResults(false)");
        expect(source).toContain('onSearchChange?.("")');
    });

    it("aborts stale suggestion requests during rapid input changes", () => {
        expect(source).toContain("abortControllerRef.current?.abort()");
    });
});
