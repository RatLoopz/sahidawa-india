export type VerificationVerdict = "GENUINE" | "SUSPICIOUS" | "LIKELY_FAKE";

export interface ImageVerifyRequest {
    cloudinaryUrl: string;
    medicineName?: string;
}

export interface ImageVerifyResponse {
    verdict: VerificationVerdict;
    confidence: number;
    matchedReference?: string;
    processingTimeMs: number;
    error?: string;
}

export interface ImageVerifyApiResponse {
    success: boolean;
    data?: ImageVerifyResponse;
    error?: string;
}
