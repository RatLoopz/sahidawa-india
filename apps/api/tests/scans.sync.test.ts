import request from "supertest";
import app from "../src/app"; // Assuming the express app is exported from src/app
import { supabase } from "../src/db/client";
import { redisClient } from "../src/utils/redis";
import crypto from "crypto";

jest.mock("../src/utils/redis", () => ({
    redisClient: {
        isOpen: true,
        get: jest.fn(),
        set: jest.fn(),
        on: jest.fn(),
    },
}));

jest.mock("bullmq", () => ({
    Queue: class {
        on() {}
        add() {}
    },
    Worker: class {
        on() {}
    },
}));

jest.mock("../src/db/client", () => {
    const mockBuilder: any = {};
    mockBuilder.from = jest.fn().mockReturnValue(mockBuilder);
    mockBuilder.select = jest.fn().mockReturnValue(mockBuilder);
    mockBuilder.eq = jest.fn().mockReturnValue(mockBuilder);
    mockBuilder.insert = jest.fn().mockReturnValue(mockBuilder);
    mockBuilder.update = jest.fn().mockReturnValue(mockBuilder);
    mockBuilder.upsert = jest.fn().mockReturnValue(mockBuilder);
    mockBuilder.maybeSingle = jest.fn();
    mockBuilder.single = jest.fn();
    return { supabase: mockBuilder };
});

describe("POST /api/v1/scan/submit — offline sync", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns cached result if Idempotency-Key already processed in Redis", async () => {
        const mockKey = "test-idem-key";
        (redisClient.get as jest.Mock).mockResolvedValue(
            JSON.stringify({ scanId: "mock-scan-id", parts: { metadata: "synced" } })
        );

        const res = await request(app)
            .post("/api/v1/scan/submit")
            .set("Idempotency-Key", mockKey)
            .send({
                deviceId: "device-1",
                clientUpdatedAt: Date.now().toString(),
                metadata: JSON.stringify({ name: "Aspirin" }),
            });

        expect(res.status).toBe(200);
        expect(res.body.scanId).toBe("mock-scan-id");
        expect(redisClient.get).toHaveBeenCalledWith(`idem:${mockKey}`);
        expect(supabase.from).not.toHaveBeenCalledWith("submission_idempotency");
    });

    it("inserts a new scan and returns parts status if not seen before", async () => {
        const mockKey = "new-idem-key";
        (redisClient.get as jest.Mock).mockResolvedValue(null);

        // Mock fallback idempotency check
        (supabase.maybeSingle as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

        // Mock conflict resolution (new record)
        (supabase.maybeSingle as jest.Mock).mockResolvedValueOnce({ data: null, error: null });
        (supabase.single as jest.Mock).mockResolvedValueOnce({
            data: { id: "new-scan-id" },
            error: null,
        });

        const res = await request(app)
            .post("/api/v1/scan/submit")
            .set("Idempotency-Key", mockKey)
            .send({
                deviceId: "device-1",
                clientUpdatedAt: Date.now().toString(),
                metadata: JSON.stringify({ name: "Paracetamol" }),
            });

        expect(res.status).toBe(200);
        expect(res.body.scanId).toBe("new-scan-id");
        expect(res.body.parts.metadata).toBe("synced");
        expect(res.body.parts.image).toBe("skipped");
        expect(res.body.parts.voice).toBe("skipped");
        expect(redisClient.set).toHaveBeenCalled();
        expect(supabase.from).toHaveBeenCalledWith("scan_submission_parts");
        expect(supabase.from).toHaveBeenCalledWith("submission_idempotency");
    });
});
