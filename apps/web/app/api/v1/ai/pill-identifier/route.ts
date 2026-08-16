import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY is not configured." },
                { status: 500 }
            );
        }

        const formData = await req.formData();
        const file = formData.get("image") as File | null;

        if (!file) {
            return NextResponse.json({ error: "emptyUpload" }, { status: 400 });
        }

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            return NextResponse.json({ error: "unsupportedFile" }, { status: 400 });
        }

        if (file.size > MAX_BYTES) {
            return NextResponse.json({ error: "fileTooLarge" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString("base64");

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `You are an expert pharmacist AI. A user has uploaded a close-up photo of a cut medicine strip, a loose pill, or partial packaging where the name may be partially ripped off.

Analyze the visual characteristics (color, shape, scoring, markings) and any visible text fragments (e.g. "Parac...", "500") to deduce the most likely medicine.

Return STRICTLY the raw JSON object below — no markdown, no explanation, no introductory text.

JSON Schema:
{
  "medicineName": "best-guess medicine name, or empty string if truly unknown",
  "genericName": "likely generic/salt name if deducible, else empty string",
  "confidence": "High" | "Medium" | "Low",
  "observedFeatures": "brief description of the color, shape, and any text/markings seen",
  "possibleUses": "short plain-language note on what this medicine is typically used for, or empty string",
  "safetyNote": "a clear safety reminder to verify with a pharmacist"
}

If the image is too blurry, not a medicine/pill, or illegible, return exactly:
{ "error": "unreadable" }`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Image,
                    mimeType: file.type,
                },
            },
        ]);

        const text = result.response.text();

        const cleanedText = text
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        let parsedData;
        try {
            parsedData = JSON.parse(cleanedText);
        } catch {
            console.error("Failed to parse Gemini response:", cleanedText);
            return NextResponse.json({ error: "apiFailure" }, { status: 500 });
        }

        if (parsedData.error === "unreadable") {
            return NextResponse.json({ error: "unreadable" }, { status: 400 });
        }

        return NextResponse.json(parsedData, { status: 200 });
    } catch (error) {
        console.error("Pill Identifier API Error:", error);
        return NextResponse.json({ error: "apiFailure" }, { status: 500 });
    }
}
