import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_PDF_TYPE = "application/pdf";
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
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "emptyUpload" }, { status: 400 });
        }

        const allowed = [...ALLOWED_IMAGE_TYPES, ALLOWED_PDF_TYPE];
        if (!allowed.includes(file.type)) {
            return NextResponse.json({ error: "unsupportedFile" }, { status: 400 });
        }

        if (file.size > MAX_BYTES) {
            return NextResponse.json({ error: "fileTooLarge" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString("base64");

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `You are an expert medical assistant AI. Analyze the provided lab report (image or PDF).
Extract every test result you can find and compare it against standard adult reference ranges.
Return STRICTLY the raw JSON object below — no markdown, no explanation, no introductory text.

JSON Schema:
{
  "tests": [
    {
      "testName": "e.g. Hemoglobin",
      "userValue": "the patient's value with units, e.g. 13.2 g/dL",
      "referenceRange": "standard reference range, e.g. 13.5-17.5 g/dL",
      "status": "Low" | "Normal" | "High",
      "simpleExplanation": "one short plain-language sentence explaining what this means for a layperson"
    }
  ],
  "summary": "a 1-2 sentence plain-language overview of the overall results"
}

If the document is too blurry, illegible, or is not a lab report, return exactly:
{ "error": "unreadable" }`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
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
        console.error("Lab Analyzer API Error:", error);
        return NextResponse.json({ error: "apiFailure" }, { status: 500 });
    }
}
