import request from "supertest";
import app from "../src/app";
import { redisClient } from "../src/utils/redis";
import axios from "axios";

jest.mock("../src/utils/redis", () => ({
    redisClient: {
        isOpen: true,
        get: jest.fn(),
        set: jest.fn(),
    },
}));

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedRedis = redisClient as jest.Mocked<typeof redisClient>;

// Using a mock auth middleware via environmental setup or mocking would be ideal,
// but if `requireAuth` is used, we must mock it or bypass it.
jest.mock("../src/middleware/auth", () => ({
    requireAuth: (req: any, res: any, next: any) => {
        req.user = { id: "test-user-id", role: "user" };
        next();
    },
    requireRole: (role: string) => (req: any, res: any, next: any) => {
        next();
    },
    optionalAuth: (req: any, res: any, next: any) => {
        next();
    },
}));

describe("POST /api/compare", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns 400 when medicine names are missing or too long", async () => {
        const response1 = await request(app).post("/api/compare").send({});
        expect(response1.status).toBe(400);

        const longString = "a".repeat(201);
        const response2 = await request(app)
            .post("/api/compare")
            .send({ medicine_a: longString, medicine_b: "medB" });
        expect(response2.status).toBe(400);
        expect(response2.body.error).toBe("Invalid payload");
    });

    it("fetches result from ML service on cache miss", async () => {
        mockedRedis.get.mockResolvedValueOnce(null);
        mockedAxios.post.mockResolvedValueOnce({ data: { similarity: 0.95 } });

        const response = await request(app)
            .post("/api/compare")
            .send({ medicine_a: "medA", medicine_b: "medB" });

        expect(response.status).toBe(200);
        expect(response.body.similarity).toBe(0.95);
        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
        expect(mockedRedis.set).toHaveBeenCalledTimes(1);
    });

    it("prevents cache collision for maliciously crafted inputs", async () => {
        // We simulate caching the first pair
        mockedRedis.get.mockResolvedValueOnce(null); // miss for pair 1
        mockedAxios.post.mockResolvedValueOnce({ data: { similarity: 0.1 } });

        await request(app).post("/api/compare").send({ medicine_a: "a||b", medicine_b: "c" });

        // Capture the cache key used in the Redis SET command
        const cacheKey1 = (mockedRedis.set as jest.Mock).mock.calls[0][0];

        // Now test the colliding pair
        mockedRedis.get.mockResolvedValueOnce(null); // cache miss for pair 2
        mockedAxios.post.mockResolvedValueOnce({ data: { similarity: 0.9 } });

        await request(app).post("/api/compare").send({ medicine_a: "a", medicine_b: "b||c" });

        const cacheKey2 = (mockedRedis.set as jest.Mock).mock.calls[1][0];

        // The cache keys MUST be completely different to avoid poisoning!
        expect(cacheKey1).not.toBe(cacheKey2);
    });
});
