import { createCorsOptions, getAllowedOrigins } from "../src/config/cors";

type CorsOriginCallback = (
    requestOrigin: string | undefined,
    callback: (
        err: Error | null,
        origin?: boolean | string | RegExp | Array<boolean | string | RegExp>
    ) => void
) => void;

type CorsOriginResult = {
    error: Error | null;
    allowed?: boolean | string | RegExp | Array<boolean | string | RegExp>;
};

describe("CORS configuration", () => {
    const deployedOrigins =
        "http://localhost:3000, https://preview-sahidawa.vercel.app,https://staging.sahidawa.org ";

    function resolveOrigin(
        env: NodeJS.ProcessEnv,
        requestOrigin: string | undefined
    ): CorsOriginResult {
        const options = createCorsOptions(env);
        let result: CorsOriginResult | undefined;

        expect(options.origin).toBeInstanceOf(Function);
        (options.origin as CorsOriginCallback)(requestOrigin, (error, allowed) => {
            result = { error, allowed };
        });

        expect(result).toBeDefined();
        return result as CorsOriginResult;
    }

    it("keeps local development origins enabled by default", () => {
        expect(getAllowedOrigins({})).toEqual([
            "http://localhost:3000",
            "http://localhost:4000",
            "http://localhost:8000",
        ]);
    });

    it("adds FRONTEND_URL and comma-separated ALLOWED_ORIGINS without duplicates", () => {
        expect(
            getAllowedOrigins({
                FRONTEND_URL: "https://sahidawa-india-web.vercel.app",
                ALLOWED_ORIGINS: deployedOrigins,
            })
        ).toEqual([
            "http://localhost:3000",
            "http://localhost:4000",
            "http://localhost:8000",
            "https://sahidawa-india-web.vercel.app",
            "https://preview-sahidawa.vercel.app",
            "https://staging.sahidawa.org",
        ]);
    });

    it("ignores empty comma-separated entries and whitespace-only env values", () => {
        expect(
            getAllowedOrigins({
                FRONTEND_URL: "  ",
                ALLOWED_ORIGINS: " , https://app.example.com, ,  ,https://admin.example.com ",
            })
        ).toEqual([
            "http://localhost:3000",
            "http://localhost:4000",
            "http://localhost:8000",
            "https://app.example.com",
            "https://admin.example.com",
        ]);
    });

    it("keeps the first occurrence when origins are duplicated across env vars", () => {
        expect(
            getAllowedOrigins({
                FRONTEND_URL: "https://app.example.com,http://localhost:3000",
                ALLOWED_ORIGINS: "https://app.example.com,https://admin.example.com",
            })
        ).toEqual([
            "http://localhost:3000",
            "http://localhost:4000",
            "http://localhost:8000",
            "https://app.example.com",
            "https://admin.example.com",
        ]);
    });

    it("allows requests from trusted origins", () => {
        const result = resolveOrigin(
            { ALLOWED_ORIGINS: "https://sahidawa-india-web.vercel.app" },
            "https://sahidawa-india-web.vercel.app"
        );

        expect(result.error).toBeNull();
        expect(result.allowed).toBe(true);
    });

    it.each([
        ["default web dev server", {}, "http://localhost:3000"],
        ["default API dev server", {}, "http://localhost:4000"],
        ["default ML dev server", {}, "http://localhost:8000"],
        [
            "FRONTEND_URL origin",
            { FRONTEND_URL: "https://sahidawa-india-web.vercel.app" },
            "https://sahidawa-india-web.vercel.app",
        ],
        [
            "ALLOWED_ORIGINS origin",
            { ALLOWED_ORIGINS: "https://preview-sahidawa.vercel.app" },
            "https://preview-sahidawa.vercel.app",
        ],
    ])("allows the %s", (_label, env, requestOrigin) => {
        const result = resolveOrigin(env, requestOrigin);

        expect(result.error).toBeNull();
        expect(result.allowed).toBe(true);
    });

    it("rejects requests without an Origin header to prevent unintended network access", () => {
        const result = resolveOrigin(
            { ALLOWED_ORIGINS: "https://sahidawa-india-web.vercel.app" },
            undefined
        );

        expect(result.error).toBeNull();
        expect(result.allowed).toBe(false);
    });

    it.each([
        ["unknown domain", "https://unknown.example.com"],
        ["different scheme", "http://sahidawa-india-web.vercel.app"],
        ["different port", "http://localhost:3001"],
        ["case-mismatched origin", "https://SAHIDAWA-INDIA-WEB.vercel.app"],
        ["same origin with trailing slash", "https://sahidawa-india-web.vercel.app/"],
    ])("denies %s", (_label, requestOrigin) => {
        const result = resolveOrigin(
            { ALLOWED_ORIGINS: "https://sahidawa-india-web.vercel.app" },
            requestOrigin
        );

        expect(result.error).toBeNull();
        expect(result.allowed).toBe(false);
    });
});
