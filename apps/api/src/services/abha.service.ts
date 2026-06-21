import { supabase } from "../db/client";
import logger from "../utils/logger";

export interface ABHALinkResponse {
    txnId: string;
}

export interface ABHAPrescription {
    id: string;
    title: string;
    issuedAt: string;
}

export interface ABHAVerificationData {
    medicineId: string;
    verificationResult: string;
    scannedAt: string;
}

export const generateOTP = async (abhaAddress: string): Promise<ABHALinkResponse> => {
    logger.info("ABHA OTP generation requested", { abhaAddress });

    /**
     * Future Integration Point:
     * This method is a stub. It should be replaced with the actual
     * ABDM Sandbox API call for generating ABHA OTPs.
     */
    return {
        txnId: crypto.randomUUID(),
    };
};

export const verifyOTP = async (txnId: string, otp: string): Promise<{ token: string }> => {
    logger.info("ABHA OTP verification requested", {
        txnId,
        otpProvided: Boolean(otp),
    });

    /**
     * Future Integration Point:
     * This method is a stub. It should be replaced with the actual
     * ABDM Sandbox API call for verifying ABHA OTPs.
     */
    return {
        token: "mock-abha-token",
    };
};

export const uploadVerification = async (
    userId: string,
    verificationData: ABHAVerificationData
): Promise<{ success: boolean }> => {
    logger.info("ABHA verification upload requested", { userId });

    const { error } = await supabase.from("abha_records").insert({
        user_id: userId,
        record_type: "verification",
        record_data: verificationData,
    });

    if (error) {
        logger.error("ABHA verification upload failed", { error: error.message });
        throw new Error(error.message);
    }

    return { success: true };
};

export const getPrescriptions = async (userId: string): Promise<ABHAPrescription[]> => {
    logger.info("ABHA prescription fetch requested", { userId });

    const { data, error } = await supabase
        .from("abha_records")
        .select("*")
        .eq("user_id", userId)
        .eq("record_type", "prescription");

    if (error) {
        logger.error("ABHA prescription fetch failed", { error: error.message });
        throw new Error(error.message);
    }

    return (data ?? []).map((record) => ({
        id: record.id,
        title: record.record_data?.title ?? "Prescription",
        issuedAt: record.synced_at,
    }));
};

export const unlinkABHA = async (userId: string): Promise<{ success: boolean }> => {
    logger.info("ABHA unlink requested", { userId });

    const { error } = await supabase
        .from("abha_links")
        .update({ is_active: false })
        .eq("user_id", userId);

    if (error) {
        logger.error("ABHA unlink failed", { error: error.message });
        throw new Error(error.message);
    }

    return { success: true };
};
