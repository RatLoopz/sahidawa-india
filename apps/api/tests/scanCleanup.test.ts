import request from "supertest";
import http from "http";
import fs from "fs";
import path from "path";
import app from "../src/app";

// Regression coverage for the temp-file cleanup added in PR #3535 (issue #3548).
//
// POST /api/v1/scan/extract stores the upload with multer disk storage, then
// registers res.on("finish") AND res.on("close") -> cleanupTempFile so the temp
// file is always removed once the response is done, whether it finishes normally
// or the client disconnects first. The ML call is the last thing that can go
// wrong, so these tests drive every outcome and spy on fs.unlinkSync to prove
// the file multer wrote to temp-uploads is actually deleted:
//   1. fetch rejects          -> handler catch sends 503 -> "finish"
//   2. ML returns !ok         -> handler sends the ML status -> "finish"
//   3. ML succeeds            -> handler sends 200 -> "finish"
//   4. client aborts mid-call -> no response is ever sent -> "close"

const EXTRACT_URL = "/api/v1/scan/extract";
const UPLOAD_DIR = path.join(__dirname, "../temp-uploads");

// Content is irrelevant — multer's fileFilter only checks the declared mimetype,
// so a short buffer tagged audio/webm is enough to make it write a temp file.
const AUDIO_WEBM = Buffer.from("1a45dfa3010000000000001f", "hex");
const attachAudio = (req: request.Test) =>
    req.attach("file", AUDIO_WEBM, { filename: "clip.webm", contentType: "audio/webm" });

// Poll for a condition instead of sleeping a fixed amount, so the disconnect
// case stays deterministic rather than racing a timer.
async function waitFor(cond: () => boolean, timeoutMs = 3000): Promise<void> {
    const start = Date.now();
    while (!cond()) {
        if (Date.now() - start > timeoutMs) throw new Error("condition not met in time");
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
}

const cleanedTempPath = (spy: jest.SpyInstance): string | undefined =>
    spy.mock.calls.map((call) => String(call[0])).find((p) => p.startsWith(UPLOAD_DIR));

describe("POST /api/v1/scan/extract — temp file cleanup (#3548)", () => {
    const realFetch = global.fetch;
    let unlinkSpy: jest.SpyInstance;
    // Drive requests through one long-lived server we own, so the disconnect test
    // can be force-closed in afterAll instead of leaking the aborted socket (which
    // would keep the event loop — and jest — alive).
    let server: http.Server;

    beforeAll((done) => {
        server = http.createServer(app);
        server.listen(0, done);
    });

    afterAll((done) => {
        server.closeAllConnections?.();
        server.close(() => done());
    });

    beforeEach(() => {
        // Spy but call through: the real unlink runs, so nothing leaks into
        // temp-uploads, and we still get to inspect the path it was called with.
        unlinkSpy = jest.spyOn(fs, "unlinkSync");
    });

    afterEach(() => {
        jest.restoreAllMocks();
        global.fetch = realFetch;
    });

    it("deletes the temp file when the ML request throws (503, finish)", async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as never;

        const response = await attachAudio(request(server).post(EXTRACT_URL));

        expect(response.status).toBe(503);
        await waitFor(() => cleanedTempPath(unlinkSpy) !== undefined);
        const tempPath = cleanedTempPath(unlinkSpy)!;
        expect(tempPath.endsWith(".webm")).toBe(true);
        expect(fs.existsSync(tempPath)).toBe(false);
    });

    it("deletes the temp file when the ML service returns an error status (finish)", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 502,
            json: async () => ({ detail: "OCR upstream failed" }),
        }) as never;

        const response = await attachAudio(request(server).post(EXTRACT_URL));

        expect(response.status).toBe(502);
        await waitFor(() => cleanedTempPath(unlinkSpy) !== undefined);
        expect(fs.existsSync(cleanedTempPath(unlinkSpy)!)).toBe(false);
    });

    it("deletes the temp file after a successful extraction (200, finish)", async () => {
        // OCR text of only short/filler words keeps searchWords empty, so the
        // handler never queries Supabase and the test stays fully in-memory:
        // mocked ML success -> unmatched 200 -> "finish" -> cleanup.
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ text: "rs 12 mrp", confidence: 0.9 }),
        }) as never;

        const response = await attachAudio(request(server).post(EXTRACT_URL));

        expect(response.status).toBe(200);
        await waitFor(() => cleanedTempPath(unlinkSpy) !== undefined);
        const tempPath = cleanedTempPath(unlinkSpy)!;
        expect(tempPath.endsWith(".webm")).toBe(true);
        expect(fs.existsSync(tempPath)).toBe(false);
    });

    it("deletes the temp file when the client disconnects before a response (close)", async () => {
        // Signal the moment the handler reaches the ML call: by then multer has
        // written the file and res.on("close") is registered. The call then never
        // resolves, so the handler is parked and only a disconnect ends the request.
        let handlerReachedFetch: () => void;
        const reachedFetch = new Promise<void>((resolve) => {
            handlerReachedFetch = resolve;
        });
        global.fetch = jest.fn(() => {
            handlerReachedFetch();
            return new Promise(() => {}); // never settles
        }) as never;

        const req = attachAudio(request(server).post(EXTRACT_URL));
        const settled = req.then(
            () => "completed",
            () => "aborted"
        );

        await reachedFetch;
        req.abort();
        await settled;

        await waitFor(() => cleanedTempPath(unlinkSpy) !== undefined);
        expect(fs.existsSync(cleanedTempPath(unlinkSpy)!)).toBe(false);
    });
});
