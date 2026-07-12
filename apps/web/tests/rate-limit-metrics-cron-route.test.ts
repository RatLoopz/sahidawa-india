import {
    describe,
    it,
    expect,
    jest,
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
} from "@jest/globals";
/**
 * @jest-environment node
 */

const mockCreateRateLimitRedisClient = jest.fn();
const mockCollectRateLimitMetrics = jest.fn();
const mockPersistRateLimitMetrics = jest.fn();

jest.mock("@/lib/rateLimitMetrics", () => ({
    createRateLimitRedisClient: mockCreateRateLimitRedisClient,
    collectRateLimitMetrics: mockCollectRateLimitMetrics,
    persistRateLimitMetrics: mockPersistRateLimitMetrics,
}));

import { NextRequest } from "next/server";
import { GET } from "../app/api/cron/rate-limit-metrics/route";

describe("GET /api/cron/rate-limit-metrics", () => {
    const originalCronSecret = process.env.CRON_SECRET;

    beforeEach(() => {
        jest.resetAllMocks();
        process.env.CRON_SECRET = "test-cron-secret";
    });

    afterEach(() => {
        if (originalCronSecret === undefined) {
            delete process.env.CRON_SECRET;
        } else {
            process.env.CRON_SECRET = originalCronSecret;
        }
    });

    it("returns 401 when the authorization header is missing", async () => {
        const response = await GET(new NextRequest("http://localhost/api/cron/rate-limit-metrics"));

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
        expect(mockCreateRateLimitRedisClient).not.toHaveBeenCalled();
        expect(mockCollectRateLimitMetrics).not.toHaveBeenCalled();
        expect(mockPersistRateLimitMetrics).not.toHaveBeenCalled();
    });

    it("returns 401 when the bearer token is incorrect", async () => {
        const response = await GET(
            new NextRequest("http://localhost/api/cron/rate-limit-metrics", {
                headers: {
                    authorization: "Bearer wrong-secret",
                },
            })
        );

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
        expect(mockCreateRateLimitRedisClient).not.toHaveBeenCalled();
        expect(mockCollectRateLimitMetrics).not.toHaveBeenCalled();
        expect(mockPersistRateLimitMetrics).not.toHaveBeenCalled();
    });

    it("returns 401 when CRON_SECRET is unset", async () => {
        delete process.env.CRON_SECRET;

        const response = await GET(
            new NextRequest("http://localhost/api/cron/rate-limit-metrics", {
                headers: {
                    authorization: "Bearer test-cron-secret",
                },
            })
        );

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
        expect(mockCreateRateLimitRedisClient).not.toHaveBeenCalled();
        expect(mockCollectRateLimitMetrics).not.toHaveBeenCalled();
        expect(mockPersistRateLimitMetrics).not.toHaveBeenCalled();
    });

    it("allows the existing cron logic to run when the bearer token is correct", async () => {
        const redis = {};
        const snapshot = {
            snapshotId: "snapshot-1",
            capturedAt: "2026-07-10T00:00:00.000Z",
            rows: [{ ip_address: "127.0.0.1" }],
            totalRejections: 3,
            otpMetrics: {
                totalHits: 1,
                blocked: 1,
            },
            scannedKeys: 2,
            truncated: false,
        };

        mockCreateRateLimitRedisClient.mockReturnValue(redis);
        mockCollectRateLimitMetrics.mockResolvedValue(snapshot);
        mockPersistRateLimitMetrics.mockResolvedValue(undefined);

        const response = await GET(
            new NextRequest("http://localhost/api/cron/rate-limit-metrics", {
                headers: {
                    authorization: "Bearer test-cron-secret",
                },
            })
        );

        await expect(response.json()).resolves.toEqual({
            ok: true,
            snapshotId: snapshot.snapshotId,
            capturedAt: snapshot.capturedAt,
            persisted: snapshot.rows.length,
            totalRejections: snapshot.totalRejections,
            otpMetrics: snapshot.otpMetrics,
            scannedKeys: snapshot.scannedKeys,
            truncated: snapshot.truncated,
        });
        expect(response.status).toBe(200);
        expect(mockCreateRateLimitRedisClient).toHaveBeenCalledTimes(1);
        expect(mockCollectRateLimitMetrics).toHaveBeenCalledWith(redis);
        expect(mockPersistRateLimitMetrics).toHaveBeenCalledWith(snapshot);
    });
});
