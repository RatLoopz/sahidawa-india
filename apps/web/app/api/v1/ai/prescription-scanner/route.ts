import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

        if (!["image/jpeg", "image/png"].includes(file.type)) {
            return NextResponse.json({ error: "unsupportedFile" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString("base64");

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `You are an expert medical assistant AI. Read the handwritten prescription in the provided image.
Extract the following information and return it strictly in the JSON format below. Do not include any markdown formatting, explanations, or introductory text. Just the raw JSON object.

JSON Schema:
{
  "medicines": [
    {
      "name": "Medicine name extracted",
      "dosage": "Dosage extracted",
      "timing": "Timing extracted (e.g. 1-0-1)",
      "instructions": "Any specific instructions",
      "purpose": "Detect or infer medicine purpose if possible",
      "side_effects": "Detect or infer common side effects if available",
      "simpleTiming": "Convert timing to simple language (e.g., Morning and Night, Before/After Food)"
    }
  ],
  "patientVitals": {
    "bloodPressure": "Blood pressure if written, else empty string",
    "temperature": "Temperature if written, else empty string"
  }
}

If the image is too blurry, illegible, or does not contain a prescription, return exactly this JSON:
{
  "error": "blurry"
}`;

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

        if (parsedData.error === "blurry") {
            return NextResponse.json({ error: "blurry" }, { status: 400 });
        }

        return NextResponse.json(parsedData, { status: 200 });
    } catch (error) {
        console.error("Prescription Scanner API Error:", error);
        return NextResponse.json({ error: "apiFailure" }, { status: 500 });
    }
}
