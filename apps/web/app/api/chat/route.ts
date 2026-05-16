import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// Ensure you have GEMINI_API_KEY in your environment variables (e.g., .env or .env.local)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // The messages array contains the conversation history
    const lastMessage = messages[messages.length - 1];

    // Build the prompt for Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: lastMessage.text,
      config: {
        systemInstruction: "You are the SahiDawa AI Assistant. SahiDawa is India's First Open-Source Citizen Medicine Verifier & Rural Health Bridge. You help users verify medicine information, understand their prescriptions, and navigate the app. Be concise, empathetic, and highly accurate in your medical guidance, but always remind users to consult a doctor for serious concerns.",
      }
    });

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    
    // Provide a more specific error message based on the error code
    const errorMessage = error?.status === 503 
      ? "Google AI is currently experiencing high demand. Please try again in a few moments." 
      : "Failed to generate AI response";

    return NextResponse.json(
      { error: errorMessage },
      { status: error?.status || 500 }
    );
  }
}
