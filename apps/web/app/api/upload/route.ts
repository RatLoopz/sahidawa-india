import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { rateLimit } from "@/lib/rateLimit";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function getUploadClientIp(req: NextRequest) {
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");

    return forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "127.0.0.1";
}

export async function POST(req: NextRequest) {
    try {
        const ip = getUploadClientIp(req);
        const { success, reset } = await rateLimit.limit(ip);
        if (!success) {
            const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
            return NextResponse.json(
                {
                    error: "Too many upload requests. Please try again later.",
                    retryAfter,
                },
                {
                    status: 429,
                    headers: { "Retry-After": retryAfter.toString() },
                }
            );
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return NextResponse.json(
                {
                    error: "invalid_file_type",
                    message: "Invalid file type. Only JPEG, PNG, and WEBP images are allowed.",
                    allowedTypes: ALLOWED_MIME_TYPES,
                    receivedType: file.type,
                },
                { status: 400 }
            );
        }

        if (file.size > MAX_UPLOAD_SIZE) {
            return NextResponse.json(
                {
                    error: "file_too_large",
                    message: `File exceeds maximum upload size of ${MAX_UPLOAD_SIZE / 1024 / 1024} MB`,
                    maxSize: MAX_UPLOAD_SIZE,
                    actualSize: file.size,
                },
                { status: 413 }
            );
        }
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        if (!cloudName || !apiKey || !apiSecret) {
            return NextResponse.json(
                { error: "Server is missing Cloudinary credentials." },
                { status: 500 }
            );
        }

        const timestamp = Math.round(new Date().getTime() / 1000).toString();
        const folder = "sahidawa/reports";

        // Store each report image at cloud_name/sahidawa/reports/{batch_number}_{timestamp}.
        // Sanitise the batch number so it cannot inject extra folder paths into the public_id.
        const rawBatchNumber = (formData.get("batch_number") as string | null) ?? "";
        const batchNumber = rawBatchNumber.replace(/[^A-Za-z0-9._-]/g, "") || "report";
        const publicId = `${batchNumber}_${timestamp}`;

        // correct signature format — sorted params + secret appended at end
        const paramsToSign = `folder=${folder}&public_id=${publicId}&signature_algorithm=sha256&timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash("sha256").update(paramsToSign).digest("hex");

        const cloudinaryFormData = new FormData();
        cloudinaryFormData.append("file", file);
        cloudinaryFormData.append("api_key", apiKey);
        cloudinaryFormData.append("timestamp", timestamp);
        cloudinaryFormData.append("signature_algorithm", "sha256");
        cloudinaryFormData.append("signature", signature);
        cloudinaryFormData.append("folder", folder);
        cloudinaryFormData.append("public_id", publicId);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: "POST",
            body: cloudinaryFormData,
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json(
                { error: data.error?.message || "Failed to upload to Cloudinary" },
                { status: res.status }
            );
        }

        return NextResponse.json({ secure_url: data.secure_url });
    } catch (error) {
        console.error("Upload route error:", error);
        return NextResponse.json({ error: "Internal server error during upload" }, { status: 500 });
    }
}
