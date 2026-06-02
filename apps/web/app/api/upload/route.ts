import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
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

        // correct signature format — sorted params + secret appended at end
        const paramsToSign = `folder=${folder}&signature_algorithm=sha256&timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash("sha256").update(paramsToSign).digest("hex");

        const cloudinaryFormData = new FormData();
        cloudinaryFormData.append("file", file);
        cloudinaryFormData.append("api_key", apiKey);
        cloudinaryFormData.append("timestamp", timestamp);
        cloudinaryFormData.append("signature_algorithm", "sha256");
        cloudinaryFormData.append("signature", signature);
        cloudinaryFormData.append("folder", folder);

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
