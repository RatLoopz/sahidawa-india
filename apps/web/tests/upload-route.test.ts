import crypto from "crypto";

import { POST } from "../app/api/upload/route";

const CLOUD_NAME = "test-cloud";
const API_KEY = "test-key";
const API_SECRET = "test-secret";

function buildRequest(fields: Record<string, string> = {}) {
    const formData = new FormData();
    formData.append("file", new Blob(["fake-image-bytes"], { type: "image/jpeg" }), "photo.jpg");
    for (const [key, value] of Object.entries(fields)) {
        formData.append(key, value);
    }
    return new Request("http://localhost/api/upload", {
        method: "POST",
        body: formData,
    });
}

function captureCloudinaryFormData(fetchMock: jest.Mock): FormData {
    const [, init] = fetchMock.mock.calls[0];
    return init.body as FormData;
}

describe("POST /api/upload", () => {
    let fetchMock: jest.Mock;

    beforeEach(() => {
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
        const response = await POST(buildRequest({ batch_number: "BATCH123" }));

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const sent = captureCloudinaryFormData(fetchMock);
        const timestamp = sent.get("timestamp") as string;

        expect(sent.get("folder")).toBe("sahidawa/reports");
        expect(sent.get("public_id")).toBe(`BATCH123_${timestamp}`);
    });

    it("falls back to a 'report' prefix when no batch number is supplied", async () => {
        await POST(buildRequest());

        const sent = captureCloudinaryFormData(fetchMock);
        const timestamp = sent.get("timestamp") as string;

        expect(sent.get("public_id")).toBe(`report_${timestamp}`);
    });

    it("signs the request over the sorted params including public_id", async () => {
        await POST(buildRequest({ batch_number: "BATCH123" }));

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
});
