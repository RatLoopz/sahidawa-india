import logger from "../utils/logger";

export interface ABHALinkResponse {
    txnId: string;
}

export interface ABHAPrescription {
    id: string;
    title: string;
    issuedAt: string;
}

export const generateOTP = async (abhaAddress: string): Promise<ABHALinkResponse> => {
    logger.info("ABHA OTP generation requested", {
        abhaAddress,
    });

    return {
        txnId: crypto.randomUUID(),
    };
};

export const verifyOTP = async (txnId: string, otp: string): Promise<{ token: string }> => {
    logger.info("ABHA OTP verification requested", {
        txnId,
        otpProvided: Boolean(otp),
    });

    return {
        token: "mock-abha-token",
    };
};

export const uploadVerification = async (): Promise<{
    success: boolean;
}> => {
    logger.info("ABHA verification upload requested");

    return {
        success: true,
    };
};

export const getPrescriptions = async (): Promise<ABHAPrescription[]> => {
    logger.info("ABHA prescription fetch requested");

    return [];
};

export const unlinkABHA = async (): Promise<{
    success: boolean;
}> => {
    logger.info("ABHA unlink requested");

    return {
        success: true,
    };
};
