import crypto from "crypto";

const CLOUD_NAME = "test-cloud";
const API_KEY = "test-key";
const API_SECRET = "test-secret";
type UploadPost = typeof import("../app/api/upload/route").POST;

const limitBuckets = new Map<string, { count: number; resetAt: number }>();
const mockLimit = jest.fn().mockImplementation(async (ip: string) => {
    const now = Date.now();
    let bucket = limitBuckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + 60000 };
        limitBuckets.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count > 10) {
        return { success: false, limit: 10, remaining: 0, reset: bucket.resetAt };
    }
    return { success: true, limit: 10, remaining: 10 - bucket.count, reset: bucket.resetAt };
});

jest.mock("@/lib/rateLimit", () => ({
    rateLimit: {
        limit: (ip: string) => mockLimit(ip),
    },
}));

function buildRequest(
    fields: Record<string, string> = {},
    headers?: HeadersInit,
    fileType = "image/jpeg"
) {
    const formData = new FormData();
    const fakeImageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
    formData.append("file", new Blob([fakeImageBytes], { type: fileType }), "photo.jpg");
    for (const [key, value] of Object.entries(fields)) {
        formData.append(key, value);
    }
    return new Request("http://localhost/api/upload", {
        method: "POST",
        headers,
        body: formData,
    });
}

function captureCloudinaryFormData(fetchMock: jest.Mock): FormData {
    const [, init] = fetchMock.mock.calls[0];
    return init.body as FormData;
}

describe("POST /api/upload", () => {
    let fetchMock: jest.Mock;
    let post: UploadPost;

    beforeEach(async () => {
        jest.resetModules();
        limitBuckets.clear();
        mockLimit.mockClear();
        const route = await import("../app/api/upload/route");
        post = route.POST;

        process.env.CLOUDINARY_CLOUD_NAME = CLOUD_NAME;
        process.env.CLOUDINARY_API_KEY = API_KEY;
        process.env.CLOUDINARY_API_SECRET = API_SECRET;

        fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                secure_url: "https://res.cloudinary.com/test-cloud/image/upload/v1/sample.jpg",
            }),
        });
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        delete process.env.CLOUDINARY_CLOUD_NAME;
        delete process.env.CLOUDINARY_API_KEY;
        delete process.env.CLOUDINARY_API_SECRET;
        jest.restoreAllMocks();
    });

    it("stores the image under sahidawa/reports with a {batch_number}_{timestamp} public_id", async () => {
        const response = await post(buildRequest({ batch_number: "BATCH123" }));

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const sent = captureCloudinaryFormData(fetchMock);
        const timestamp = sent.get("timestamp") as string;

        expect(sent.get("folder")).toBe("sahidawa/reports");
        expect(sent.get("public_id")).toBe(`BATCH123_${timestamp}`);
    });

    it("falls back to a 'report' prefix when no batch number is supplied", async () => {
        await post(buildRequest());

        const sent = captureCloudinaryFormData(fetchMock);
        const timestamp = sent.get("timestamp") as string;

        expect(sent.get("public_id")).toBe(`report_${timestamp}`);
    });

    it("signs the request over the sorted params including public_id", async () => {
        await post(buildRequest({ batch_number: "BATCH123" }));

        const sent = captureCloudinaryFormData(fetchMock);
        const timestamp = sent.get("timestamp") as string;
        const publicId = sent.get("public_id") as string;

        const expectedSignature = crypto
            .createHash("sha256")
            .update(
                `folder=sahidawa/reports&public_id=${publicId}&signature_algorithm=sha256&timestamp=${timestamp}${API_SECRET}`
            )
            .digest("hex");

        expect(sent.get("signature")).toBe(expectedSignature);
    });

    it("rejects non-image uploads before calling Cloudinary", async () => {
        const response = await post(
            buildRequest(
                { batch_number: "BATCH123" },
                { "x-forwarded-for": "203.0.113.30" },
                "text/plain"
            )
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({
            error: "invalid_file_type",
            message: "Invalid file type. Only JPEG, PNG, and WEBP images are allowed.",
            allowedTypes: ["image/jpeg", "image/png", "image/webp"],
            receivedType: "text/plain",
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns 429 after 10 uploads in one minute for the same forwarded IP", async () => {
        jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
        const headers = { "x-forwarded-for": "203.0.113.10, 10.0.0.1" };

        for (let i = 0; i < 10; i += 1) {
            const response = await post(buildRequest({ batch_number: `BATCH${i}` }, headers));
            expect(response.status).toBe(200);
        }

        const response = await post(buildRequest({ batch_number: "BATCH10" }, headers));
        const body = await response.json();

        expect(response.status).toBe(429);
        expect(response.headers.get("Retry-After")).toBe("60");
        expect(body).toEqual({
            error: "Too many upload requests. Please try again later.",
            retryAfter: 60,
        });
        expect(fetchMock).toHaveBeenCalledTimes(10);
    });

    it("uses the first x-forwarded-for IP as the rate limit key", async () => {
        jest.spyOn(Date, "now").mockReturnValue(1_700_000_100_000);
        const firstIpHeaders = { "x-forwarded-for": "198.51.100.20, 10.0.0.1" };

        for (let i = 0; i < 10; i += 1) {
            await post(buildRequest({ batch_number: `FIRST${i}` }, firstIpHeaders));
        }

        const secondIpResponse = await post(
            buildRequest(
                { batch_number: "SECOND" },
                { "x-forwarded-for": "198.51.100.21, 10.0.0.1" }
            )
        );
        const firstIpResponse = await post(
            buildRequest({ batch_number: "FIRST10" }, firstIpHeaders)
        );

        expect(secondIpResponse.status).toBe(200);
        expect(firstIpResponse.status).toBe(429);
    });

    it("allows the same IP again after the one-minute window resets", async () => {
        const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(1_700_000_200_000);
        const headers = { "x-forwarded-for": "203.0.113.40" };

        for (let i = 0; i < 10; i += 1) {
            const response = await post(buildRequest({ batch_number: `RESET${i}` }, headers));
            expect(response.status).toBe(200);
        }

        const limitedResponse = await post(buildRequest({ batch_number: "RESET10" }, headers));
        expect(limitedResponse.status).toBe(429);

        dateNowSpy.mockReturnValue(1_700_000_260_001);

        const resetResponse = await post(buildRequest({ batch_number: "RESET11" }, headers));
        expect(resetResponse.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(11);
    });
});
