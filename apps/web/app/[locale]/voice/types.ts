import type { ConfidenceMeta } from "./lib/confidence";

export type VoiceStep = "initial" | "listening" | "review" | "processing" | "result" | "error";

export type VoiceTriageResult = {
    text: string;
    summary: string;
    recommendations: string[];
    disclaimer: string;
    emergency: boolean;
};
export type VoiceErrorType = "generic" | "timeout" | "service-unavailable";

export type VoiceErrorState = {
    title: string;
    message: string;
    type?: VoiceErrorType;
};

export type VoiceStreamingStatus = "idle" | "connecting" | "streaming" | "fallback";

export type VoiceFlowState = {
    transcript: string;
    confidence: ConfidenceMeta;
    result: VoiceTriageResult | null;
    error: VoiceErrorState | null;
    emergencyMatches: string[];
};
