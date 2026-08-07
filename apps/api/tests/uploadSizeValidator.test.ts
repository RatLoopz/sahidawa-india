import request from "supertest";
import express, { NextFunction, Request, Response } from "express";
import app from "../src/app";
import {
    MAX_SCAN_FILE_SIZE_BYTES,
    MAX_SCAN_MULTIPART_BODY_SIZE_BYTES,
    validateUploadSize,
} from "../src/middleware/uploadSizeValidator";

function invokeMiddleware(contentLength?: string) {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const next = jest.fn();
    const req = {
        headers: contentLength === undefined ? {} : { "content-length": contentLength },
    } as Request;
    const res = { status } as unknown as Response;

    validateUploadSize(req, res, next as NextFunction);

    return { json, next, status };
}

function createMultipartBody(fileSize: number) {
    const boundary = "sahidawa-upload-size-test-boundary";
    const prefix = Buffer.from(
        `--${boundary}\r\n` +
            'Content-Disposition: form-data; name="file"; filename="medicine.jpg"\r\n' +
            "Content-Type: image/jpeg\r\n\r\n"
    );
    const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);

    return {
        body: Buffer.concat([prefix, Buffer.alloc(fileSize), suffix]),
        contentType: `multipart/form-data; boundary=${boundary}`,
    };
}

function createTwoFileSubmitBody() {
    const boundary = "sahidawa-two-file-submit-test-boundary";
    const field = (name: string, value: string) =>
        Buffer.from(
            `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
                `${value}\r\n`
        );
    const fileHeader = (name: string, filename: string, contentType: string) =>
        Buffer.from(
            `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="${name}"; filename="${filename}"\r\n` +
                `Content-Type: ${contentType}\r\n\r\n`
        );

    return {
        body: Buffer.concat([
            field("clientUpdatedAt", "1784139437317"),
            field("metadata", JSON.stringify({ name: "Paracetamol" })),
            fileHeader("image", "medicine.jpg", "image/jpeg"),
            Buffer.alloc(MAX_SCAN_FILE_SIZE_BYTES),
            Buffer.from("\r\n"),
            fileHeader("voice", "medicine.webm", "audio/webm"),
            Buffer.alloc(MAX_SCAN_FILE_SIZE_BYTES),
            Buffer.from(`\r\n--${boundary}--\r\n`),
        ]),
        contentType: `multipart/form-data; boundary=${boundary}`,
    };
}

describe("validateUploadSize", () => {
    it("accepts Content-Length below the multipart request limit", () => {
        const { next, status } = invokeMiddleware(String(MAX_SCAN_MULTIPART_BODY_SIZE_BYTES - 1));

        expect(next).toHaveBeenCalledTimes(1);
        expect(status).not.toHaveBeenCalled();
    });

    it("accepts Content-Length exactly at the multipart request limit", () => {
        const { next, status } = invokeMiddleware(String(MAX_SCAN_MULTIPART_BODY_SIZE_BYTES));

        expect(next).toHaveBeenCalledTimes(1);
        expect(status).not.toHaveBeenCalled();
    });

    it("rejects Content-Length above the multipart request limit", () => {
        const { json, next, status } = invokeMiddleware(
            String(MAX_SCAN_MULTIPART_BODY_SIZE_BYTES + 1)
        );

        expect(next).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(413);
        expect(json).toHaveBeenCalledWith({
            error: "Request body exceeds maximum allowed size of 25MiB",
            maxSize: MAX_SCAN_MULTIPART_BODY_SIZE_BYTES,
            providedSize: MAX_SCAN_MULTIPART_BODY_SIZE_BYTES + 1,
        });
    });

    it("preserves invalid Content-Length handling", () => {
        const { json, next, status } = invokeMiddleware("not-a-number");

        expect(next).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(413);
        expect(json).toHaveBeenCalledWith(
            expect.objectContaining({
                maxSize: MAX_SCAN_MULTIPART_BODY_SIZE_BYTES,
                providedSize: Number.NaN,
            })
        );
    });

    it("preserves missing Content-Length handling", () => {
        const { json, next, status } = invokeMiddleware();

        expect(next).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(411);
        expect(json).toHaveBeenCalledWith({ error: "Content-Length header required" });
    });

    it("accepts a two-file submit body within the 25 MiB request ceiling", async () => {
        const { body, contentType } = createTwoFileSubmitBody();
        expect(body.length).toBeGreaterThan(2 * MAX_SCAN_FILE_SIZE_BYTES);
        expect(body.length).toBeLessThan(MAX_SCAN_MULTIPART_BODY_SIZE_BYTES);

        const middlewareApp = express();
        middlewareApp.post("/submit", validateUploadSize, (req, res) => {
            req.on("data", () => undefined);
            req.on("end", () => res.sendStatus(204));
        });

        const response = await request(middlewareApp)
            .post("/submit")
            .set("Content-Type", contentType)
            .set("Content-Length", String(body.length))
            .send(body);

        expect(response.status).toBe(204);
    });
});

describe("POST /api/v1/scan/extract upload limits", () => {
    const realFetch = global.fetch;

    afterEach(() => {
        global.fetch = realFetch;
        jest.restoreAllMocks();
    });

    it("accepts an exactly 10,485,760-byte file despite multipart overhead", async () => {
        const { body, contentType } = createMultipartBody(MAX_SCAN_FILE_SIZE_BYTES);
        expect(MAX_SCAN_FILE_SIZE_BYTES).toBe(10_485_760);
        expect(body.length).toBeGreaterThan(MAX_SCAN_FILE_SIZE_BYTES);
        expect(body.length).toBeLessThan(MAX_SCAN_MULTIPART_BODY_SIZE_BYTES);

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ text: "rs 12 mrp", confidence: 0.9 }),
        }) as never;

        const response = await request(app)
            .post("/api/v1/scan/extract")
            .set("Content-Type", contentType)
            .set("Content-Length", String(body.length))
            .send(body);

        expect(response.status).toBe(200);
        expect(global.fetch).toHaveBeenCalledWith(
            "http://example.com/ocr/extract",
            expect.objectContaining({ method: "POST" })
        );
    });

    it("rejects a 10,485,761-byte file through Multer", async () => {
        const { body, contentType } = createMultipartBody(MAX_SCAN_FILE_SIZE_BYTES + 1);
        expect(body.length).toBeLessThan(MAX_SCAN_MULTIPART_BODY_SIZE_BYTES);

        const response = await request(app)
            .post("/api/v1/scan/extract")
            .set("Content-Type", contentType)
            .set("Content-Length", String(body.length))
            .send(body);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "File too large" });
    });
});
