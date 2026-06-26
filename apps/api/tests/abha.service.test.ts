import { generateKeyPairSync } from "node:crypto";
import { generateOTP, verifyOTP } from "../src/services/abha.service";

jest.mock("../src/utils/logger", () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
}));

const fetchMock = jest.fn();
const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const testPublicKey = publicKey
    .export({ type: "spki", format: "pem" })
    .toString()
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");

describe("ABHA service ABDM sandbox integration", () => {
    const originalFetch = global.fetch;
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            ABDM_SANDBOX_BASE_URL: "https://abha-sandbox.test/abha/api",
            ABDM_SANDBOX_SESSION_URL: "https://gateway-sandbox.test/api/hiecm/gateway/v3/sessions",
            ABDM_SANDBOX_CLIENT_ID: "sandbox-client-id",
            ABDM_SANDBOX_CLIENT_SECRET: "sandbox-client-secret",
        };
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        process.env = originalEnv;
        global.fetch = originalFetch;
    });

    it("generates an ABHA address OTP with ABDM session credentials and returns txnId", async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse(200, {
                    accessToken: "session-access-token",
                })
            )
            .mockResolvedValueOnce(
                jsonResponse(200, {
                    publicKey: testPublicKey,
                    encryptionAlgorithm: "RSA/ECB/OAEPWithSHA-1AndMGF1Padding",
                })
            )
            .mockResolvedValueOnce(
                jsonResponse(200, {
                    txnId: "otp-txn-id",
                })
            );

        await expect(generateOTP("deepak@sbx")).resolves.toEqual({
            txnId: "otp-txn-id",
        });

        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            "https://gateway-sandbox.test/api/hiecm/gateway/v3/sessions",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    clientId: "sandbox-client-id",
                    clientSecret: "sandbox-client-secret",
                }),
            })
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            "https://abha-sandbox.test/abha/api/v3/profile/public/certificate",
            expect.objectContaining({
                method: "GET",
                headers: expect.objectContaining({
                    Authorization: "Bearer session-access-token",
                }),
            })
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            "https://abha-sandbox.test/abha/api/v3/phr/web/login/abha/request/otp",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    Authorization: "Bearer session-access-token",
                    "REQUEST-ID": expect.any(String),
                    TIMESTAMP: expect.any(String),
                }),
                body: expect.any(String),
            })
        );

        const otpRequestBody = parseFetchBody(3);
        expect(otpRequestBody).toMatchObject({
            scope: ["abha-address-login", "mobile-verify"],
            loginHint: "abha-address",
            otpSystem: "abdm",
        });
        expect(otpRequestBody.loginId).toEqual(expect.any(String));
        expect(otpRequestBody.loginId).not.toBe("deepak@sbx");
        expect(otpRequestBody.loginId.length).toBeGreaterThan(100);
    });

    it("verifies an ABHA OTP and keeps the token response contract stable", async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(200, { accessToken: "session-access-token" }))
            .mockResolvedValueOnce(
                jsonResponse(200, {
                    publicKey: testPublicKey,
                    encryptionAlgorithm: "RSA/ECB/OAEPWithSHA-1AndMGF1Padding",
                })
            )
            .mockResolvedValueOnce(jsonResponse(200, { token: "abha-login-token" }));

        await expect(verifyOTP("otp-txn-id", "123456")).resolves.toEqual({
            token: "abha-login-token",
        });

        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            "https://abha-sandbox.test/abha/api/v3/phr/web/login/abha/verify",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    Authorization: "Bearer session-access-token",
                }),
                body: expect.any(String),
            })
        );

        const verifyRequestBody = parseFetchBody(3);
        expect(verifyRequestBody).toMatchObject({
            scope: ["abha-address-login", "mobile-verify"],
            authData: {
                authMethods: ["otp"],
                otp: {
                    txnId: "otp-txn-id",
                },
            },
        });
        expect(verifyRequestBody.authData.otp.otpValue).toEqual(expect.any(String));
        expect(verifyRequestBody.authData.otp.otpValue).not.toBe("123456");
        expect(verifyRequestBody.authData.otp.otpValue.length).toBeGreaterThan(100);
    });

    it("maps ABDM 400 responses to an invalid ABHA error", async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(200, { accessToken: "session-access-token" }))
            .mockResolvedValueOnce(jsonResponse(200, { publicKey: testPublicKey }))
            .mockResolvedValueOnce(jsonResponse(400, { message: "Invalid ABHA address" }));

        await expect(generateOTP("bad-abha")).rejects.toThrow(
            "Invalid ABHA address: Invalid ABHA address"
        );
    });

    it("maps ABDM 401 responses to an unauthorized sandbox error", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(401, { message: "Invalid client credentials" })
        );

        await expect(generateOTP("deepak@sbx")).rejects.toThrow(
            "ABDM sandbox authorization failed: Invalid client credentials"
        );
    });

    it("maps ABDM 500 responses to a sandbox service error", async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(200, { accessToken: "session-access-token" }))
            .mockResolvedValueOnce(jsonResponse(200, { publicKey: testPublicKey }))
            .mockResolvedValueOnce(jsonResponse(500, { message: "Sandbox unavailable" }));

        await expect(generateOTP("deepak@sbx")).rejects.toThrow(
            "ABDM sandbox service failed: Sandbox unavailable"
        );
    });

    it("maps network failures to a sandbox connectivity error", async () => {
        fetchMock.mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND"));

        await expect(generateOTP("deepak@sbx")).rejects.toThrow(
            "ABDM sandbox request failed: getaddrinfo ENOTFOUND"
        );
    });
});

function parseFetchBody(callNumber: number): Record<string, any> {
    const [, init] = fetchMock.mock.calls[callNumber - 1] as [string, RequestInit];
    return JSON.parse(init.body as string);
}

function jsonResponse(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: jest.fn().mockResolvedValue(body),
        text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    } as unknown as Response;
}
