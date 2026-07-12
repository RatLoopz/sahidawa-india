const mockRedisClient = {
    set: jest.fn(),
    getDel: jest.fn(),
};

jest.mock("../src/utils/redis", () => ({
    redisClient: mockRedisClient,
}));

import {
    ABHA_PKCE_SESSION_TTL_SECONDS,
    consumeAbhaPkceSession,
    storeAbhaPkceSession,
} from "../src/services/abhaPkceSession.service";

describe("ABHA PKCE session storage", () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it("stores only required fields under a namespaced key for five minutes", async () => {
        mockRedisClient.set.mockResolvedValue("OK");

        await storeAbhaPkceSession("state-123", {
            codeVerifier: "verifier-123",
            userId: "user-123",
        });

        expect(mockRedisClient.set).toHaveBeenCalledWith(
            "abha:pkce:state-123",
            JSON.stringify({ codeVerifier: "verifier-123", userId: "user-123" }),
            { EX: ABHA_PKCE_SESSION_TTL_SECONDS }
        );
        expect(ABHA_PKCE_SESSION_TTL_SECONDS).toBe(300);
    });

    it("propagates shared-storage write failures", async () => {
        const redisError = new Error("Redis unavailable");
        mockRedisClient.set.mockRejectedValue(redisError);

        await expect(
            storeAbhaPkceSession("state-123", {
                codeVerifier: "verifier-123",
                userId: "user-123",
            })
        ).rejects.toBe(redisError);
    });

    it("atomically consumes a stored session and returns null on replay", async () => {
        mockRedisClient.getDel
            .mockResolvedValueOnce(
                JSON.stringify({ codeVerifier: "verifier-123", userId: "user-123" })
            )
            .mockResolvedValueOnce(null);

        await expect(consumeAbhaPkceSession("state-123")).resolves.toEqual({
            codeVerifier: "verifier-123",
            userId: "user-123",
        });
        await expect(consumeAbhaPkceSession("state-123")).resolves.toBeNull();

        expect(mockRedisClient.getDel).toHaveBeenNthCalledWith(1, "abha:pkce:state-123");
        expect(mockRedisClient.getDel).toHaveBeenNthCalledWith(2, "abha:pkce:state-123");
    });

    it("returns null for a missing or expired session", async () => {
        mockRedisClient.getDel.mockResolvedValue(null);

        await expect(consumeAbhaPkceSession("expired-state")).resolves.toBeNull();
    });

    it.each([
        "not-json",
        "null",
        "[]",
        JSON.stringify({ codeVerifier: "", userId: "user-123" }),
        JSON.stringify({ codeVerifier: "verifier-123", userId: 123 }),
    ])("returns null for malformed session data", async (serializedSession) => {
        mockRedisClient.getDel.mockResolvedValue(serializedSession);

        await expect(consumeAbhaPkceSession("malformed-state")).resolves.toBeNull();
    });

    it("propagates shared-storage failures", async () => {
        const redisError = new Error("Redis unavailable");
        mockRedisClient.getDel.mockRejectedValue(redisError);

        await expect(consumeAbhaPkceSession("state-123")).rejects.toBe(redisError);
    });
});
