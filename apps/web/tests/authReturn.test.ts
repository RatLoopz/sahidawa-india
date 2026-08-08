import { buildLoginPath, isSafeReturnTo, stripLocalePrefix, toLocalePath } from "../lib/authReturn";

describe("authReturn helpers", () => {
    describe("stripLocalePrefix", () => {
        it("removes the locale segment from a locale-prefixed path", () => {
            expect(stripLocalePrefix("/en/admin/dashboard", "en")).toBe("/admin/dashboard");
        });

        it("returns the root for just the locale path", () => {
            expect(stripLocalePrefix("/en", "en")).toBe("/");
        });

        it("leaves a non-prefixed path untouched", () => {
            expect(stripLocalePrefix("/admin/dashboard", "en")).toBe("/admin/dashboard");
        });

        it("only strips when the locale is at the first segment", () => {
            expect(stripLocalePrefix("/report/en/details", "en")).toBe("/report/en/details");
        });
    });

    describe("toLocalePath", () => {
        it("prefixes a bare path with the given locale", () => {
            expect(toLocalePath("/admin", "en")).toBe("/en/admin");
        });

        it("returns the locale root for a root path", () => {
            expect(toLocalePath("/", "ta")).toBe("/ta");
        });

        it("is idempotent for an already-prefixed path", () => {
            expect(toLocalePath("/en/admin", "en")).toBe("/en/admin");
        });
    });

    describe("isSafeReturnTo", () => {
        it("accepts an internal path", () => {
            expect(isSafeReturnTo("/en/admin/analytics")).toBe(true);
        });

        it("rejects external / protocol-relative URLs", () => {
            expect(isSafeReturnTo("https://evil.example")).toBe(false);
            expect(isSafeReturnTo("//evil.example")).toBe(false);
        });

        it("rejects the login route to avoid self-redirect", () => {
            expect(isSafeReturnTo("/en/login")).toBe(false);
            expect(isSafeReturnTo("/login")).toBe(false);
        });

        it("rejects path traversal and CR/LF injection", () => {
            expect(isSafeReturnTo("/admin\\..")).toBe(false);
            expect(isSafeReturnTo("/admin/%0aSet-Cookie:")).toBe(false);
        });

        it("rejects non-string values", () => {
            expect(isSafeReturnTo(null)).toBe(false);
            expect(isSafeReturnTo(undefined)).toBe(false);
        });
    });

    describe("buildLoginPath", () => {
        it("builds a locale-prefixed login path with a safe returnTo", () => {
            expect(buildLoginPath("en", "/en/admin/analytics")).toBe(
                "/en/login?returnTo=%2Fen%2Fadmin%2Fanalytics"
            );
        });

        it("omits returnTo for the default destination", () => {
            expect(buildLoginPath("ta")).toBe("/ta/login");
        });

        it("omits returnTo for an unsafe value", () => {
            expect(buildLoginPath("en", "https://evil.example")).toBe("/en/login");
            expect(buildLoginPath("en", "/en/login")).toBe("/en/login");
        });
    });
});
