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

    it("throws when the Supabase URL is missing", () => {
        expect(() => getSupabaseUrl()).toThrow("NEXT_PUBLIC_SUPABASE_URL is not defined");
    });

    it("throws when the Supabase URL is invalid", () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = "invalid-url";

        expect(() => getSupabaseUrl()).toThrow("not a valid URL");
    });

    it("returns the Supabase anon key when configured", () => {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

        expect(getSupabaseAnonKey()).toBe("test-anon-key");
    });

    it("throws when the Supabase anon key is missing", () => {
        expect(() => getSupabaseAnonKey()).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined");
    });
});
