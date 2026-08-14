// @ts-nocheck
import request from "supertest";
import http from "http";
import fs from "fs";
import path from "path";
import app from "../src/app";
import { supabase } from "../src/db/client";
import { redisClient } from "../src/utils/redis";

// Regression coverage for the temp-file cleanup added in issue #4112.
//
// POST /api/v1/scan/submit stores image/voice uploads with multer disk storage,
// then registers res.on("finish") AND res.on("close") -> cleanupTempFiles so the
// temp files are always removed once the response is done, whether it finishes
// normally or the client disconnects first.

const SUBMIT_URL = "/api/v1/scan/submit";
const UPLOAD_DIR = path.join(__dirname, "../temp-uploads");

// Minimal buffers — multer's fileFilter only checks declared mimetype
const JPEG_BUF = Buffer.from([0xff, 0xd8, 0xff]);
const WEBM_BUF = Buffer.from("1a45dfa3010000000000001f", "hex");

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

// Poll for a condition instead of sleeping a fixed amount
async function waitFor(cond: () => boolean, timeoutMs = 10000): Promise<void> {
    const start = Date.now();
    while (!cond()) {
        if (Date.now() - start > timeoutMs) throw new Error("condition not met in time");
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
}

const cleanedTempPaths = (spy: jest.SpyInstance): string[] =>
    spy.mock.calls.map((call) => String(call[0])).filter((p) => p.startsWith(UPLOAD_DIR));

/**
 * Set up the standard happy-path mocks for the idempotency middleware +
 * resolveConflict + handler upsert chain.
 */
function setupHappyMocks() {
    (redisClient.get as jest.Mock).mockResolvedValue(null);

    // 1st insert call — idempotency reservation INSERT in the middleware
    (supabase.insert as jest.Mock).mockReturnValueOnce(
        Promise.resolve({ data: null, error: null })
    );

    // resolveConflict: existence check (no existing row)
    (supabase.maybeSingle as jest.Mock).mockResolvedValueOnce({ data: null, error: null });
    // resolveConflict: insert new row
    (supabase.single as jest.Mock).mockResolvedValueOnce({
        data: { id: "test-scan-id" },
        error: null,
    });

    // resolveConflict: two .eq() calls for existence check, then terminal .eq() for update
    (supabase.eq as jest.Mock)
        .mockReturnValueOnce(supabase)
        .mockReturnValueOnce(supabase)
        .mockReturnValueOnce(Promise.resolve({ error: null }));
    (supabase.update as jest.Mock).mockReturnValueOnce(supabase);
}

describe("POST /api/v1/scan/submit — temp file cleanup (#4112)", () => {
    let server: http.Server;
    let unlinkSpy: jest.SpyInstance;

    beforeAll((done) => {
        server = http.createServer(app);
        server.listen(0, done);
    });

    afterAll((done) => {
        server.closeAllConnections?.();
        server.close(() => done());
    });

    beforeEach(() => {
        jest.clearAllMocks();
        unlinkSpy = jest.spyOn(fs, "unlinkSync");
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("deletes the temp files after a successful submission (200, finish)", async () => {
        setupHappyMocks();

        const res = await request(server)
            .post(SUBMIT_URL)
            .set("Idempotency-Key", "cleanup-success-key")
            .field("deviceId", "device-1")
            .field("clientUpdatedAt", Date.now().toString())
            .field("metadata", JSON.stringify({ name: "Paracetamol" }))
            .attach("image", JPEG_BUF, {
                filename: "medicine.jpg",
                contentType: "image/jpeg",
            })
            .attach("voice", WEBM_BUF, {
                filename: "recording.webm",
                contentType: "audio/webm",
            });

        expect(res.status).toBe(200);
        await waitFor(() => cleanedTempPaths(unlinkSpy).length > 0);
        const cleaned = cleanedTempPaths(unlinkSpy);
        expect(cleaned.length).toBeGreaterThanOrEqual(2);
        expect(cleaned.some((p) => p.endsWith(".jpg"))).toBe(true);
        expect(cleaned.some((p) => p.endsWith(".webm"))).toBe(true);
        for (const p of cleaned) {
            expect(fs.existsSync(p)).toBe(false);
        }
    });

    it("deletes the temp files when validation fails (400, finish)", async () => {
        // No happy-path mocks needed — the request fails before resolveConflict.
        // Multer still writes the file, but validation rejects the body.
        const res = await request(server)
            .post(SUBMIT_URL)
            .set("Idempotency-Key", "cleanup-validation-key")
            .field("deviceId", "device-1")
            .field("metadata", JSON.stringify({ name: "Test" }))
            // clientUpdatedAt intentionally missing — triggers 400
            .attach("image", JPEG_BUF, {
                filename: "medicine.jpg",
                contentType: "image/jpeg",
            });

        expect(res.status).toBe(400);
        await waitFor(() => cleanedTempPaths(unlinkSpy).length > 0);
        expect(cleanedTempPaths(unlinkSpy).some((p) => p.endsWith(".jpg"))).toBe(true);
    });

    it("deletes the temp files when processing throws (500, finish)", async () => {
        (redisClient.get as jest.Mock).mockResolvedValue(null);

        // 1st insert call — idempotency reservation INSERT in the middleware
        (supabase.insert as jest.Mock).mockReturnValueOnce(
            Promise.resolve({ data: null, error: null })
        );

        // resolveConflict: existence check (no existing row)
        (supabase.maybeSingle as jest.Mock).mockResolvedValueOnce({ data: null, error: null });
        // resolveConflict: insert throws
        (supabase.single as jest.Mock).mockRejectedValueOnce(new Error("DB connection lost"));

        (supabase.eq as jest.Mock).mockReturnValueOnce(supabase).mockReturnValueOnce(supabase);

        const res = await request(server)
            .post(SUBMIT_URL)
            .set("Idempotency-Key", "cleanup-error-key")
            .field("deviceId", "device-1")
            .field("clientUpdatedAt", Date.now().toString())
            .attach("image", JPEG_BUF, {
                filename: "medicine.jpg",
                contentType: "image/jpeg",
            });

        expect(res.status).toBe(500);
        await waitFor(() => cleanedTempPaths(unlinkSpy).length > 0);
        expect(cleanedTempPaths(unlinkSpy).some((p) => p.endsWith(".jpg"))).toBe(true);
    });

    it("deletes image upload temp files (image-only cleanup works)", async () => {
        setupHappyMocks();

        const res = await request(server)
            .post(SUBMIT_URL)
            .set("Idempotency-Key", "cleanup-image-only-key")
            .field("deviceId", "device-1")
            .field("clientUpdatedAt", Date.now().toString())
            .field("metadata", JSON.stringify({ name: "Aspirin" }))
            .attach("image", JPEG_BUF, {
                filename: "tablet.jpg",
                contentType: "image/jpeg",
            });

        expect(res.status).toBe(200);
        await waitFor(() => cleanedTempPaths(unlinkSpy).length > 0);
        expect(cleanedTempPaths(unlinkSpy).some((p) => p.endsWith(".jpg"))).toBe(true);
    });

    it("deletes voice upload temp files (voice-only cleanup works)", async () => {
        setupHappyMocks();

        const res = await request(server)
            .post(SUBMIT_URL)
            .set("Idempotency-Key", "cleanup-voice-only-key")
            .field("deviceId", "device-1")
            .field("clientUpdatedAt", Date.now().toString())
            .field("metadata", JSON.stringify({ name: "Ibuprofen" }))
            .attach("voice", WEBM_BUF, {
                filename: "dictation.webm",
                contentType: "audio/webm",
            });

        expect(res.status).toBe(200);
        await waitFor(() => cleanedTempPaths(unlinkSpy).length > 0);
        expect(cleanedTempPaths(unlinkSpy).some((p) => p.endsWith(".webm"))).toBe(true);
    });

    it("does not crash when cleanup of an already-removed file is attempted", async () => {
        setupHappyMocks();

        const res = await request(server)
            .post(SUBMIT_URL)
            .set("Idempotency-Key", "cleanup-gone-key")
            .field("deviceId", "device-1")
            .field("clientUpdatedAt", Date.now().toString())
            .attach("image", JPEG_BUF, {
                filename: "gone.jpg",
                contentType: "image/jpeg",
            });

        expect(res.status).toBe(200);
        await waitFor(() => cleanedTempPaths(unlinkSpy).length > 0);
        for (const call of unlinkSpy.mock.calls) {
            const filePath = String(call[0]);
            if (filePath.startsWith(UPLOAD_DIR)) {
                expect(fs.existsSync(filePath)).toBe(false);
            }
        }
    });

    it("works when no files are attached (no cleanup needed, no error)", async () => {
        setupHappyMocks();

        const res = await request(server)
            .post(SUBMIT_URL)
            .set("Idempotency-Key", "cleanup-no-files-key")
            .send({
                deviceId: "device-1",
                clientUpdatedAt: Date.now().toString(),
                metadata: JSON.stringify({ name: "Paracetamol" }),
            });

        expect(res.status).toBe(200);
        expect(res.body.parts.image).toBe("skipped");
        expect(res.body.parts.voice).toBe("skipped");
        // No temp files were written, so no unlink calls for UPLOAD_DIR paths
        expect(cleanedTempPaths(unlinkSpy).length).toBe(0);
    });
});

describe("POST /api/v1/scan/submit — temp file cleanup on idempotency short-circuits (#4243)", () => {
    let server: http.Server;
    let unlinkSpy: jest.SpyInstance;

    beforeAll((done) => {
        server = http.createServer(app);
        server.listen(0, done);
    });

    afterAll((done) => {
        server.closeAllConnections?.();
        server.close(() => done());
    });

    beforeEach(() => {
        jest.clearAllMocks();
        unlinkSpy = jest.spyOn(fs, "unlinkSync");
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("deletes the uploaded files when the Idempotency-Key header is missing (400)", async () => {
        // No Idempotency-Key header: idempotencyMiddleware returns 400 before
        // the /submit handler body ever runs. Multer still wrote the file, so
        // the pre-idempotency cleanup must remove it.
        const res = await request(server)
            .post(SUBMIT_URL)
            .field("deviceId", "device-1")
            .field("clientUpdatedAt", Date.now().toString())
            .attach("image", JPEG_BUF, {
                filename: "nokey.jpg",
                contentType: "image/jpeg",
            });

        expect(res.status).toBe(400);
        await waitFor(() => cleanedTempPaths(unlinkSpy).length > 0);
        const cleaned = cleanedTempPaths(unlinkSpy);
        expect(cleaned.some((p) => p.endsWith(".jpg"))).toBe(true);
        for (const p of cleaned) {
            expect(fs.existsSync(p)).toBe(false);
        }
    });

    it("deletes the uploaded files when Redis returns a cached replay (200)", async () => {
        // Redis already has an idem:<key> entry: idempotencyMiddleware returns
        // the cached 200 without running the handler — cleanup must still run.
        (redisClient.get as jest.Mock).mockResolvedValue(
            JSON.stringify({ scanId: "cached-scan", parts: { image: "synced", voice: "synced" } })
        );

        const res = await request(server)
            .post(SUBMIT_URL)
            .set("Idempotency-Key", "cleanup-redis-replay-key")
            .field("deviceId", "device-1")
            .field("clientUpdatedAt", Date.now().toString())
            .attach("image", JPEG_BUF, {
                filename: "replay.jpg",
                contentType: "image/jpeg",
            });

        expect(res.status).toBe(200);
        await waitFor(() => cleanedTempPaths(unlinkSpy).length > 0);
        const cleaned = cleanedTempPaths(unlinkSpy);
        expect(cleaned.some((p) => p.endsWith(".jpg"))).toBe(true);
        for (const p of cleaned) {
            expect(fs.existsSync(p)).toBe(false);
        }
    });

    it("deletes the uploaded files when the key is already completed (200)", async () => {
        // Reservation INSERT hits the primary-key conflict (23505), then the
        // prior request already recorded a scan_id → completed-key 200 replay.
        (redisClient.get as jest.Mock).mockResolvedValue(null);
        (supabase.insert as jest.Mock).mockReturnValueOnce(
            Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key" } })
        );
        (supabase.maybeSingle as jest.Mock).mockResolvedValueOnce({
            data: { scan_id: "already-done" },
            error: null,
        });

        const res = await request(server)
            .post(SUBMIT_URL)
            .set("Idempotency-Key", "cleanup-completed-key")
            .field("deviceId", "device-1")
            .field("clientUpdatedAt", Date.now().toString())
            .attach("image", JPEG_BUF, {
                filename: "completed.jpg",
                contentType: "image/jpeg",
            });

        expect(res.status).toBe(200);
        await waitFor(() => cleanedTempPaths(unlinkSpy).length > 0);
        const cleaned = cleanedTempPaths(unlinkSpy);
        expect(cleaned.some((p) => p.endsWith(".jpg"))).toBe(true);
        for (const p of cleaned) {
            expect(fs.existsSync(p)).toBe(false);
        }
    });

    it("deletes the uploaded files when the key is in-flight (409)", async () => {
        // Reservation INSERT hits 23505 and scan_id is still null → the other
        // request is in-flight → 409 without ever reaching the handler.
        (redisClient.get as jest.Mock).mockResolvedValue(null);
        (supabase.insert as jest.Mock).mockReturnValueOnce(
            Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key" } })
        );
        (supabase.maybeSingle as jest.Mock).mockResolvedValueOnce({
            data: { scan_id: null },
            error: null,
        });

        const res = await request(server)
            .post(SUBMIT_URL)
            .set("Idempotency-Key", "cleanup-inflight-key")
            .field("deviceId", "device-1")
            .field("clientUpdatedAt", Date.now().toString())
            .attach("voice", WEBM_BUF, {
                filename: "inflight.webm",
                contentType: "audio/webm",
            });

        expect(res.status).toBe(409);
        await waitFor(() => cleanedTempPaths(unlinkSpy).length > 0);
        const cleaned = cleanedTempPaths(unlinkSpy);
        expect(cleaned.some((p) => p.endsWith(".webm"))).toBe(true);
        for (const p of cleaned) {
            expect(fs.existsSync(p)).toBe(false);
        }
    });
});
