import request from "supertest";
import app from "../src/app"; // Assuming the express app is exported from src/app
import { supabase } from "../src/db/client";
import { redisClient } from "../src/utils/redis";

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
    mockBuilder.delete = jest.fn().mockReturnValue(mockBuilder);
    mockBuilder.maybeSingle = jest.fn();
    mockBuilder.single = jest.fn();
    return { supabase: mockBuilder };
});

describe("POST /api/v1/scan/submit — offline sync", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default: reservation INSERT succeeds (no error) unless a test overrides it.
        (supabase.insert as jest.Mock).mockReturnValue(supabase);
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

    it("reserves the key atomically, processes the submission, and persists the durable record", async () => {
        const mockKey = "new-idem-key";
        (redisClient.get as jest.Mock).mockResolvedValue(null);

        // Reservation INSERT in the middleware succeeds (no unique-violation) — this
        // request wins the race and is allowed to proceed to the handler.
        (supabase.insert as jest.Mock).mockReturnValueOnce(
            Promise.resolve({ data: null, error: null })
        );

        // Conflict resolution (new record): no existing row, then a successful insert.
        (supabase.maybeSingle as jest.Mock).mockResolvedValueOnce({ data: null, error: null });
        (supabase.single as jest.Mock).mockResolvedValueOnce({
            data: { id: "new-scan-id" },
            error: null,
        });

        // .eq() is called twice: once inside resolveConflict's existence check
        // (chained into .maybeSingle(), so it must stay chainable), and once as
        // the terminal call of the final reservation UPDATE.
        (supabase.eq as jest.Mock)
            .mockReturnValueOnce(supabase)
            .mockReturnValueOnce(Promise.resolve({ error: null }));
        (supabase.update as jest.Mock).mockReturnValueOnce(supabase);

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
        // Only one durable write against submission_idempotency — the reservation
        // INSERT. Fill-in is an UPDATE, not a second INSERT, so a concurrent
        // duplicate can never silently fail an insert the way the old code did.
        expect(supabase.insert).toHaveBeenCalledTimes(2); // reservation + user_scan_history insert
        expect(supabase.update).toHaveBeenCalledWith({ scan_id: "new-scan-id" });
    });

    it("short-circuits with 409 when a concurrent request for the same key is still in-flight", async () => {
        const mockKey = "racing-idem-key";
        (redisClient.get as jest.Mock).mockResolvedValue(null);

        // Reservation INSERT fails: another request already holds the primary key.
        (supabase.insert as jest.Mock).mockReturnValueOnce(
            Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key" } })
        );

        // The winning request hasn't finished yet, so scan_id is still null.
        (supabase.maybeSingle as jest.Mock).mockResolvedValueOnce({
            data: { scan_id: null },
            error: null,
        });

        const res = await request(app)
            .post("/api/v1/scan/submit")
            .set("Idempotency-Key", mockKey)
            .send({
                deviceId: "device-1",
                clientUpdatedAt: Date.now().toString(),
                metadata: JSON.stringify({ name: "Ibuprofen" }),
            });

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/already being processed/i);
        // Never reaches the handler, so the submission pipeline never runs twice.
        expect(supabase.upsert).not.toHaveBeenCalled();
    });

    it("returns the durable cached result when the winning request already completed", async () => {
        const mockKey = "completed-idem-key";
        (redisClient.get as jest.Mock).mockResolvedValue(null);

        (supabase.insert as jest.Mock).mockReturnValueOnce(
            Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key" } })
        );

        (supabase.maybeSingle as jest.Mock).mockResolvedValueOnce({
            data: { scan_id: "already-done-scan-id" },
            error: null,
        });

        // .eq() is called twice: once inside the middleware's fallback lookup
        // (chained into .maybeSingle()), and once as the terminal call of
        // getPartsStatus(), which awaits .eq() directly.
        (supabase.eq as jest.Mock)
            .mockReturnValueOnce(supabase)
            .mockReturnValueOnce(
                Promise.resolve({ data: [{ part_type: "metadata", status: "synced" }] })
            );

        const res = await request(app)
            .post("/api/v1/scan/submit")
            .set("Idempotency-Key", mockKey)
            .send({
                deviceId: "device-1",
                clientUpdatedAt: Date.now().toString(),
                metadata: JSON.stringify({ name: "Ibuprofen" }),
            });

        expect(res.status).toBe(200);
        expect(res.body.scanId).toBe("already-done-scan-id");
        expect(res.body.parts).toEqual({ metadata: "synced" });
        expect(supabase.upsert).not.toHaveBeenCalled();
    });
});