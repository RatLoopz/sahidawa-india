import { describe, it, expect, beforeEach, afterAll } from "@jest/globals";
/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */

function makeRequest(headers: Record<string, string> = {}): Request {
    return new Request("http://localhost:3000/test", { headers });
}

describe("getClientIp", () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ORIGINAL_ENV };
        delete process.env.TRUST_PROXY_HEADERS;
        delete process.env.TRUSTED_PROXY_HOPS;
        delete process.env.VERCEL;
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    // ── Default behaviour (no env vars) ──────────────────────────

    it("returns 127.0.0.1 when no headers are present", () => {
        const { getClientIp } = require("@/lib/getClientIp");
        expect(getClientIp(makeRequest())).toBe("127.0.0.1");
    });

    it("ignores forged X-Forwarded-For when TRUST_PROXY_HEADERS is not set", () => {
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({ "x-forwarded-for": "203.0.113.1" });
        expect(getClientIp(req)).toBe("127.0.0.1");
    });

    it("ignores forged X-Real-IP when TRUST_PROXY_HEADERS is not set", () => {
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({ "x-real-ip": "203.0.113.2" });
        expect(getClientIp(req)).toBe("127.0.0.1");
    });

    it("ignores multiple forged X-Forwarded-For entries", () => {
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({
            "x-forwarded-for": "203.0.113.1, 203.0.113.2, 203.0.113.3",
        });
        expect(getClientIp(req)).toBe("127.0.0.1");
    });

    // ── Vercel (only when VERCEL env-var is set) ─────────────────

    it("trusts x-vercel-forwarded-for when VERCEL=1", () => {
        process.env.VERCEL = "1";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({ "x-vercel-forwarded-for": "198.51.100.7" });
        expect(getClientIp(req)).toBe("198.51.100.7");
    });

    it("takes the leftmost IP from x-vercel-forwarded-for", () => {
        process.env.VERCEL = "1";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({
            "x-vercel-forwarded-for": "198.51.100.7, 10.0.0.1",
        });
        expect(getClientIp(req)).toBe("198.51.100.7");
    });

    it("falls through when x-vercel-forwarded-for contains invalid IP", () => {
        process.env.VERCEL = "1";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({
            "x-vercel-forwarded-for": "not-an-ip",
            "x-forwarded-for": "10.0.0.1",
        });
        // x-forwarded-for ignored (TRUST_PROXY_HEADERS not set), x-real-ip absent
        expect(getClientIp(req)).toBe("127.0.0.1");
    });

    it("ignores x-vercel-forwarded-for when VERCEL is not set (non-Vercel server)", () => {
        // VERCEL is explicitly deleted in beforeEach
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({ "x-vercel-forwarded-for": "198.51.100.7" });
        expect(getClientIp(req)).toBe("127.0.0.1");
    });

    // ── Trusted proxy (TRUST_PROXY_HEADERS=true) ─────────────────

    it("reads from X-Forwarded-For when TRUST_PROXY_HEADERS=true", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        const { getClientIp } = require("@/lib/getClientIp");
        // With hops=1, the rightmost entry is the real client
        const req = makeRequest({
            "x-forwarded-for": "203.0.113.1, 198.51.100.7",
        });
        expect(getClientIp(req)).toBe("198.51.100.7");
    });

    it("returns the single entry from X-Forwarded-For with hops=1", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({ "x-forwarded-for": "198.51.100.7" });
        expect(getClientIp(req)).toBe("198.51.100.7");
    });

    it("prefers X-Forwarded-For over X-Real-IP when both are present", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({
            "x-forwarded-for": "203.0.113.1, 198.51.100.7",
            "x-real-ip": "10.0.0.99",
        });
        expect(getClientIp(req)).toBe("198.51.100.7");
    });

    it("falls back to X-Real-IP when X-Forwarded-For is absent", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({ "x-real-ip": "198.51.100.7" });
        expect(getClientIp(req)).toBe("198.51.100.7");
    });

    it("returns 127.0.0.1 when TRUST_PROXY_HEADERS=true but no headers present", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        const { getClientIp } = require("@/lib/getClientIp");
        expect(getClientIp(makeRequest())).toBe("127.0.0.1");
    });

    // ── Forged headers bypass prevention ─────────────────────────

    it("does not let attacker forge X-Forwarded-For with TRUST_PROXY_HEADERS unset", () => {
        const { getClientIp } = require("@/lib/getClientIp");
        const req1 = makeRequest({ "x-forwarded-for": "203.0.113.1" });
        const req2 = makeRequest({ "x-forwarded-for": "203.0.113.2" });
        const req3 = makeRequest({ "x-forwarded-for": "203.0.113.3" });
        // All return the same IP — attacker cannot get different buckets
        expect(getClientIp(req1)).toBe("127.0.0.1");
        expect(getClientIp(req2)).toBe("127.0.0.1");
        expect(getClientIp(req3)).toBe("127.0.0.1");
    });

    it("does not let attacker forge X-Real-IP with TRUST_PROXY_HEADERS unset", () => {
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({ "x-real-ip": "203.0.113.99" });
        expect(getClientIp(req)).toBe("127.0.0.1");
    });

    it("attacker cannot forge a different IP per request with TRUST_PROXY_HEADERS=true", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        process.env.TRUSTED_PROXY_HOPS = "1";
        const { getClientIp } = require("@/lib/getClientIp");

        // Nginx appends the real client IP (10.0.0.50) to the right.
        // Anything to the left is attacker-controlled and ignored.
        const req1 = makeRequest({
            "x-forwarded-for": "203.0.113.1, 10.0.0.50",
        });
        const req2 = makeRequest({
            "x-forwarded-for": "203.0.113.2, 10.0.0.50",
        });
        const req3 = makeRequest({
            "x-forwarded-for": "203.0.113.3, 10.0.0.50",
        });
        // All return the same IP — the real client behind the proxy
        expect(getClientIp(req1)).toBe("10.0.0.50");
        expect(getClientIp(req2)).toBe("10.0.0.50");
        expect(getClientIp(req3)).toBe("10.0.0.50");
    });

    // ── Multiple proxy hops ──────────────────────────────────────

    it("reads from the correct hop position with TRUSTED_PROXY_HOPS=2", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        process.env.TRUSTED_PROXY_HOPS = "2";
        const { getClientIp } = require("@/lib/getClientIp");
        // 3 entries: attacker, CDN, Nginx → real client is 2 from right
        const req = makeRequest({
            "x-forwarded-for": "203.0.113.1, 192.0.2.50, 10.0.0.50",
        });
        expect(getClientIp(req)).toBe("192.0.2.50");
    });

    it("falls back to 127.0.0.1 when fewer entries than hops", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        process.env.TRUSTED_PROXY_HOPS = "3";
        const { getClientIp } = require("@/lib/getClientIp");
        // Only 2 entries but hops=3 → cannot determine trusted IP
        const req = makeRequest({
            "x-forwarded-for": "203.0.113.1, 192.0.2.50",
        });
        expect(getClientIp(req)).toBe("127.0.0.1");
    });

    // ── TRUSTED_PROXY_HOPS defaults and edge cases ───────────────

    it("defaults hops to 1 when TRUSTED_PROXY_HOPS is not set", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({
            "x-forwarded-for": "203.0.113.1, 198.51.100.7",
        });
        // hops=1 → rightmost entry
        expect(getClientIp(req)).toBe("198.51.100.7");
    });

    it("clamps TRUSTED_PROXY_HOPS to minimum 1 when set to 0", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        process.env.TRUSTED_PROXY_HOPS = "0";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({
            "x-forwarded-for": "203.0.113.1, 198.51.100.7",
        });
        // hops clamped to 1 → rightmost entry
        expect(getClientIp(req)).toBe("198.51.100.7");
    });

    it("clamps TRUSTED_PROXY_HOPS to minimum 1 when set to negative", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        process.env.TRUSTED_PROXY_HOPS = "-5";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({
            "x-forwarded-for": "203.0.113.1, 198.51.100.7",
        });
        expect(getClientIp(req)).toBe("198.51.100.7");
    });

    it("defaults hops to 1 when TRUSTED_PROXY_HOPS is non-numeric", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        process.env.TRUSTED_PROXY_HOPS = "abc";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({
            "x-forwarded-for": "203.0.113.1, 198.51.100.7",
        });
        expect(getClientIp(req)).toBe("198.51.100.7");
    });

    // ── Case-insensitive env var parsing ──────────────────────────

    it("accepts TRUST_PROXY_HEADERS=true in any case", () => {
        process.env.TRUST_PROXY_HEADERS = "TRUE";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({ "x-forwarded-for": "198.51.100.7" });
        expect(getClientIp(req)).toBe("198.51.100.7");
    });

    it("accepts TRUST_PROXY_HEADERS with surrounding whitespace", () => {
        process.env.TRUST_PROXY_HEADERS = "  true  ";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({ "x-forwarded-for": "198.51.100.7" });
        expect(getClientIp(req)).toBe("198.51.100.7");
    });

    it("rejects TRUST_PROXY_HEADERS=1 (must be true/yes)", () => {
        process.env.TRUST_PROXY_HEADERS = "1";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({ "x-forwarded-for": "198.51.100.7" });
        expect(getClientIp(req)).toBe("127.0.0.1");
    });

    // ── IPv6 ─────────────────────────────────────────────────────

    it("returns IPv6 address from x-vercel-forwarded-for", () => {
        process.env.VERCEL = "1";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({
            "x-vercel-forwarded-for": "2001:db8::1",
        });
        expect(getClientIp(req)).toBe("2001:db8::1");
    });

    it("returns IPv6 from X-Forwarded-For when trusted", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({
            "x-forwarded-for": "203.0.113.1, 2001:db8::1",
        });
        expect(getClientIp(req)).toBe("2001:db8::1");
    });

    // ── Invalid/malformed values ─────────────────────────────────

    it("rejects X-Real-IP with invalid octet > 255 when trusted", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({
            "x-real-ip": "999.999.999.999",
        });
        expect(getClientIp(req)).toBe("127.0.0.1");
    });

    it("rejects X-Forwarded-For entry with invalid octet when trusted", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({
            "x-forwarded-for": "999.999.999.999, 10.0.0.1",
        });
        // Rightmost (10.0.0.1) is valid
        expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it("falls back to 127.0.0.1 when X-Forwarded-For is empty string", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({ "x-forwarded-for": "" });
        expect(getClientIp(req)).toBe("127.0.0.1");
    });

    it("falls back to 127.0.0.1 when X-Real-IP is empty string", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({ "x-real-ip": "" });
        expect(getClientIp(req)).toBe("127.0.0.1");
    });

    it("handles whitespace-only X-Forwarded-For", () => {
        process.env.TRUST_PROXY_HEADERS = "true";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({ "x-forwarded-for": "  ,  ,  " });
        expect(getClientIp(req)).toBe("127.0.0.1");
    });

    // ── Vercel precedence over TRUST_PROXY_HEADERS ───────────────

    it("prefers x-vercel-forwarded-for over X-Forwarded-For when VERCEL=1", () => {
        process.env.VERCEL = "1";
        process.env.TRUST_PROXY_HEADERS = "true";
        const { getClientIp } = require("@/lib/getClientIp");
        const req = makeRequest({
            "x-vercel-forwarded-for": "198.51.100.7",
            "x-forwarded-for": "10.0.0.1, 10.0.0.2",
        });
        expect(getClientIp(req)).toBe("198.51.100.7");
    });
});
