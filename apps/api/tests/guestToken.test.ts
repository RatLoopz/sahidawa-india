import jwt from "jsonwebtoken";
import { signGuestToken, verifyGuestPhone, isGuestTokenConfigured } from "../src/utils/guestToken";

const PHONE = "+919876543210";

describe("guest token util", () => {
    const originalSecret = process.env.JWT_SECRET;

    beforeEach(() => {
        process.env.JWT_SECRET = "unit-test-secret";
    });

    afterAll(() => {
        process.env.JWT_SECRET = originalSecret;
    });

    it("round-trips a signed token back to its phone number", () => {
        const token = signGuestToken(PHONE);
        expect(verifyGuestPhone(token)).toBe(PHONE);
    });

    it("reports configuration based on JWT_SECRET", () => {
        expect(isGuestTokenConfigured()).toBe(true);
        delete process.env.JWT_SECRET;
        expect(isGuestTokenConfigured()).toBe(false);
    });

    it("refuses to sign and cannot verify when JWT_SECRET is unset", () => {
        const token = signGuestToken(PHONE); // signed while configured
        delete process.env.JWT_SECRET;
        expect(() => signGuestToken(PHONE)).toThrow();
        expect(verifyGuestPhone(token)).toBeNull();
    });

    it("returns null for a token signed with a different secret", () => {
        const forged = jwt.sign({ scope: "guest-notification", phone: PHONE }, "attacker-secret", {
            expiresIn: 3600,
        });
        expect(verifyGuestPhone(forged)).toBeNull();
    });

    it("returns null for a token with the wrong scope", () => {
        const wrongScope = jwt.sign(
            { scope: "some-other-scope", phone: PHONE },
            process.env.JWT_SECRET as string,
            { expiresIn: 3600 }
        );
        expect(verifyGuestPhone(wrongScope)).toBeNull();
    });

    it("returns null for an expired token", () => {
        const expired = jwt.sign(
            { scope: "guest-notification", phone: PHONE },
            process.env.JWT_SECRET as string,
            { expiresIn: -10 }
        );
        expect(verifyGuestPhone(expired)).toBeNull();
    });

    it("returns null for missing or malformed tokens", () => {
        expect(verifyGuestPhone(undefined)).toBeNull();
        expect(verifyGuestPhone(null)).toBeNull();
        expect(verifyGuestPhone("")).toBeNull();
        expect(verifyGuestPhone("garbage.token.value")).toBeNull();
    });
});
