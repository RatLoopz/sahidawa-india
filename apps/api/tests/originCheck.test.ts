import { describe, it, expect } from "vitest";
import { isAllowedOrigin, ALLOWED_ORIGINS } from "../src/utils/originCheck";

describe("isAllowedOrigin", () => {
    it("returns true for an allowed origin", () => {
        const req = {
            headers: {
                origin: ALLOWED_ORIGINS[0],
            },
        };

        expect(isAllowedOrigin(req as any)).toBe(true);
    });

    it("returns false for a disallowed origin", () => {
        const req = {
            headers: {
                origin: "https://malicious-site.com",
            },
        };

        expect(isAllowedOrigin(req as any)).toBe(false);
    });

    it("returns true when referer origin is allowed", () => {
        const req = {
            headers: {
                referer: `${ALLOWED_ORIGINS[0]}/dashboard`,
            },
        };

        expect(isAllowedOrigin(req as any)).toBe(true);
    });

    it("returns false when referer origin is not allowed", () => {
        const req = {
            headers: {
                referer: "https://evil.com/page",
            },
        };

        expect(isAllowedOrigin(req as any)).toBe(false);
    });

    it("returns true when origin and referer are missing", () => {
        const req = {
            headers: {},
        };

        expect(isAllowedOrigin(req as any)).toBe(true);
    });

    it("prefers origin over referer when both are present", () => {
        const req = {
            headers: {
                origin: "https://malicious-site.com",
                referer: `${ALLOWED_ORIGINS[0]}/page`,
            },
        };

        expect(isAllowedOrigin(req as any)).toBe(false);
    });
});
