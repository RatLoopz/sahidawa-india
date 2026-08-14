import { dbConfig } from "../src/db/client";
import {
    isSupabaseConnectionError,
    markOfflineOnConnectionError,
    withDbFallback,
} from "../src/utils/withDbFallback";

describe("withDbFallback helpers", () => {
    beforeEach(() => {
        dbConfig.isSupabaseOffline = false;
        dbConfig.offlineSince = null;
    });

    it("detects connection-style error messages", () => {
        expect(isSupabaseConnectionError("fetch failed")).toBe(true);
        expect(isSupabaseConnectionError("connection refused")).toBe(true);
        expect(isSupabaseConnectionError("request timeout")).toBe(true);
        expect(isSupabaseConnectionError("could not connect")).toBe(true);
        expect(isSupabaseConnectionError("row not found")).toBe(false);
    });

    it("marks supabase offline on connection errors", () => {
        expect(markOfflineOnConnectionError({ message: "fetch failed" })).toBe(true);
        expect(dbConfig.isSupabaseOffline).toBe(true);
    });

    it("uses fallback when already offline", async () => {
        dbConfig.isSupabaseOffline = true;
        const primary = jest.fn(async () => "primary");
        const result = await withDbFallback(primary, () => "fallback");

        expect(result).toBe("fallback");
        expect(primary).not.toHaveBeenCalled();
    });

    it("returns primary result when healthy", async () => {
        const result = await withDbFallback(async () => "primary", () => "fallback");
        expect(result).toBe("primary");
    });

    it("falls back and marks offline on connection failures", async () => {
        const result = await withDbFallback(
            async () => {
                throw new Error("fetch failed");
            },
            () => "fallback"
        );

        expect(result).toBe("fallback");
        expect(dbConfig.isSupabaseOffline).toBe(true);
    });
});
