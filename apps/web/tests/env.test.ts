import { getSupabaseAnonKey, getSupabaseUrl } from "../lib/env";

describe("env", () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    beforeEach(() => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    });

    afterAll(() => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
    });

    it("returns the Supabase URL when configured", () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";

        expect(getSupabaseUrl()).toBe("https://test.supabase.co");
    });

    it("returns a placeholder when the Supabase URL is missing", () => {
        expect(getSupabaseUrl()).toBe("https://placeholder.supabase.co");
    });

    it("returns a placeholder when the Supabase URL is invalid", () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = "invalid-url";

        expect(getSupabaseUrl()).toBe("https://placeholder.supabase.co");
    });

    it("returns the Supabase anon key when configured", () => {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

        expect(getSupabaseAnonKey()).toBe("test-anon-key");
    });

    it("returns a placeholder when the Supabase anon key is missing", () => {
        expect(getSupabaseAnonKey()).toBe("placeholder-key");
    });
});
