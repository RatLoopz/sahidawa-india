import { describe, it, expect, jest } from "@jest/globals";
import { Request } from "express";

const { authTargetKeyGenerator } = jest.requireActual("../src/middleware/rateLimit") as any;

/**
 * Unit tests for the authTargetLimiter key generator.
 *
 * The limiter caps how many OTPs one target can be sent regardless of the
 * source IP. It only does that if the key it builds actually names the target,
 * so these tests assert the key string directly rather than driving requests
 * through the limiter - a key that quietly falls through to the IP branch still
 * returns 200s and looks healthy from the outside.
 *
 * Related: Issue #3958 - per-target OTP limiter never matched the notification
 * routes, which send `phone`, not `phone_number`.
 */

const makeReq = (body: unknown, ip = "203.0.113.7"): Request => ({ body, ip }) as Request;

describe("authTargetKeyGenerator", () => {
    describe("phone targets", () => {
        it("keys on `phone`, the field the notification routes send", () => {
            expect(authTargetKeyGenerator(makeReq({ phone: "9876543210" }))).toBe(
                "phone:+919876543210"
            );
        });

        it("still keys on `phone_number` for callers using the older field", () => {
            expect(authTargetKeyGenerator(makeReq({ phone_number: "9876543210" }))).toBe(
                "phone:+919876543210"
            );
        });

        it("gives one bucket to national and E.164 spellings of the same number", () => {
            const national = authTargetKeyGenerator(makeReq({ phone: "9876543210" }));
            const e164 = authTargetKeyGenerator(makeReq({ phone: "+919876543210" }));
            const spaced = authTargetKeyGenerator(makeReq({ phone: "+91 98765 43210" }));

            expect(national).toBe(e164);
            expect(spaced).toBe(e164);
        });

        it("does not let the two field names split one number across buckets", () => {
            expect(authTargetKeyGenerator(makeReq({ phone: "+919876543210" }))).toBe(
                authTargetKeyGenerator(makeReq({ phone_number: "9876543210" }))
            );
        });

        it("falls back to IP when the number cannot be parsed", () => {
            // The routes reject these with 400 before any OTP is sent, so there
            // is no target to throttle - and an unparseable value must not mint
            // a fresh bucket on every request.
            expect(authTargetKeyGenerator(makeReq({ phone: "not-a-number" }))).toBe("203.0.113.7");
        });
    });

    describe("ABHA targets", () => {
        it("keys on abhaAddress", () => {
            expect(authTargetKeyGenerator(makeReq({ abhaAddress: "ravi.kumar@sbx" }))).toBe(
                "abha:ravi.kumar@sbx"
            );
        });

        it("gives one bucket to differently-cased spellings of one address", () => {
            expect(authTargetKeyGenerator(makeReq({ abhaAddress: "Ravi.Kumar@SBX" }))).toBe(
                authTargetKeyGenerator(makeReq({ abhaAddress: "ravi.kumar@sbx" }))
            );
        });

        it("ignores surrounding whitespace", () => {
            expect(authTargetKeyGenerator(makeReq({ abhaAddress: "  ravi.kumar@sbx  " }))).toBe(
                "abha:ravi.kumar@sbx"
            );
        });

        it("takes precedence over a phone in the same body", () => {
            expect(
                authTargetKeyGenerator(
                    makeReq({ abhaAddress: "ravi.kumar@sbx", phone: "9876543210" })
                )
            ).toBe("abha:ravi.kumar@sbx");
        });
    });

    describe("IP fallback", () => {
        it("falls back to IP for an empty body", () => {
            expect(authTargetKeyGenerator(makeReq({}))).toBe("203.0.113.7");
        });

        it("falls back to IP when the body is absent", () => {
            expect(authTargetKeyGenerator(makeReq(undefined))).toBe("203.0.113.7");
        });

        it("escapes colons so IPv6 addresses stay valid Redis key segments", () => {
            expect(authTargetKeyGenerator(makeReq({}, "2001:db8::1"))).toBe("2001_db8__1");
        });

        it("uses `unknown` when express reports no IP", () => {
            expect(authTargetKeyGenerator({ body: {} } as Request)).toBe("unknown");
        });

        it("ignores non-string target values", () => {
            expect(authTargetKeyGenerator(makeReq({ phone: 9876543210 }))).toBe("203.0.113.7");
            expect(authTargetKeyGenerator(makeReq({ abhaAddress: { id: 1 } }))).toBe("203.0.113.7");
        });
    });
});
