import { constants, publicEncrypt, randomUUID } from "node:crypto";
import { supabase } from "../db/client";
import logger from "../utils/logger";

const DEFAULT_ABDM_BASE_URL = "https://abhasbx.abdm.gov.in/abha/api";
const DEFAULT_ABDM_SESSION_URL = "https://dev.abdm.gov.in/api/hiecm/gateway/v3/sessions";
const ABDM_REQUEST_TIMEOUT_MS = 10000;
const ABHA_LOGIN_SCOPE = ["abha-address-login", "mobile-verify"];
const ABHA_ADDRESS_LOGIN_PATH = "/v3/phr/web/login/abha";
const ABDM_PUBLIC_CERTIFICATE_PATH = "/v3/profile/public/certificate";

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

interface AbdmSessionResponse {
    accessToken?: string;
}

interface AbdmPublicCertificateResponse {
    publicKey?: string;
}

interface AbdmOtpResponse {
    txnId?: string;
}

interface AbdmVerifyResponse {
    token?: string;
    authToken?: string;
}

export const generateOTP = async (abhaAddress: string): Promise<ABHALinkResponse> => {
    logger.info("ABHA OTP generation requested", { abhaAddress });

    const accessToken = await getAbdmSessionToken();
    const publicKey = await getAbdmPublicKey(accessToken);
    const response = await postToAbdm<AbdmOtpResponse>(
        `${getAbdmBaseUrl()}${ABHA_ADDRESS_LOGIN_PATH}/request/otp`,
        {
            scope: ABHA_LOGIN_SCOPE,
            loginHint: "abha-address",
            loginId: encryptWithAbdmPublicKey(abhaAddress, publicKey),
            otpSystem: "abdm",
        },
        accessToken
    );

    if (!response.txnId) {
        throw new Error("ABDM sandbox returned an invalid OTP response");
    }

    return {
        txnId: response.txnId,
    };
};

export const verifyOTP = async (txnId: string, otp: string): Promise<{ token: string }> => {
    logger.info("ABHA OTP verification requested", {
        txnId,
        otpProvided: Boolean(otp),
    });

    const accessToken = await getAbdmSessionToken();
    const publicKey = await getAbdmPublicKey(accessToken);
    const response = await postToAbdm<AbdmVerifyResponse>(
        `${getAbdmBaseUrl()}${ABHA_ADDRESS_LOGIN_PATH}/verify`,
        {
            scope: ABHA_LOGIN_SCOPE,
            authData: {
                authMethods: ["otp"],
                otp: {
                    txnId,
                    otpValue: encryptWithAbdmPublicKey(otp, publicKey),
                },
            },
        },
        accessToken
    );

    const token = response.token ?? response.authToken;
    if (!token) {
        throw new Error("ABDM sandbox returned an invalid OTP verification response");
    }

    return {
        token,
    };
};

const getAbdmSessionToken = async (): Promise<string> => {
    const clientId = getRequiredEnv("ABDM_SANDBOX_CLIENT_ID");
    const clientSecret = getRequiredEnv("ABDM_SANDBOX_CLIENT_SECRET");
    const sessionUrl = process.env.ABDM_SANDBOX_SESSION_URL?.trim() || DEFAULT_ABDM_SESSION_URL;

    const response = await postToAbdm<AbdmSessionResponse>(sessionUrl, {
        clientId,
        clientSecret,
    });

    if (!response.accessToken) {
        throw new Error("ABDM sandbox returned an invalid session response");
    }

    return response.accessToken;
};

const getAbdmPublicKey = async (accessToken: string): Promise<string> => {
    const response = await getFromAbdm<AbdmPublicCertificateResponse>(
        `${getAbdmBaseUrl()}${ABDM_PUBLIC_CERTIFICATE_PATH}`,
        accessToken
    );

    if (!response.publicKey) {
        throw new Error("ABDM sandbox returned an invalid public certificate response");
    }

    return response.publicKey;
};

const postToAbdm = async <T>(url: string, body: unknown, accessToken?: string): Promise<T> => {
    return requestAbdm<T>(url, {
        method: "POST",
        accessToken,
        body,
    });
};

const getFromAbdm = async <T>(url: string, accessToken?: string): Promise<T> => {
    return requestAbdm<T>(url, {
        method: "GET",
        accessToken,
    });
};

const requestAbdm = async <T>(
    url: string,
    options: { method: "GET" | "POST"; accessToken?: string; body?: unknown }
): Promise<T> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ABDM_REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: options.method,
            headers: {
                "Content-Type": "application/json",
                "REQUEST-ID": randomUUID(),
                TIMESTAMP: new Date().toISOString(),
                ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
            },
            ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
            signal: controller.signal,
        });

        const responseBody = await parseAbdmResponse(response);

        if (!response.ok) {
            throw createAbdmError(response.status, responseBody);
        }

        return responseBody as T;
    } catch (error) {
        if (error instanceof Error && isMappedAbdmError(error.message)) {
            throw error;
        }

        const message =
            error instanceof Error && error.name === "AbortError"
                ? "request timed out"
                : error instanceof Error
                  ? error.message
                  : "unknown network error";
        throw new Error(`ABDM sandbox request failed: ${message}`);
    } finally {
        clearTimeout(timeout);
    }
};

const encryptWithAbdmPublicKey = (value: string, publicKey: string): string => {
    const normalizedPublicKey = publicKey.includes("BEGIN PUBLIC KEY")
        ? publicKey
        : `-----BEGIN PUBLIC KEY-----\n${publicKey.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;

    return publicEncrypt(
        {
            key: normalizedPublicKey,
            padding: constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha1",
        },
        Buffer.from(value, "utf8")
    ).toString("base64");
};

const isMappedAbdmError = (message: string): boolean =>
    message.startsWith("Invalid ABHA address:") || message.startsWith("ABDM ");

const parseAbdmResponse = async (response: Response): Promise<unknown> => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const createAbdmError = (status: number, body: unknown): Error => {
    const detail = extractAbdmErrorMessage(body);

    if (status === 400) {
        return new Error(`Invalid ABHA address: ${detail}`);
    }

    if (status === 401 || status === 403) {
        return new Error(`ABDM sandbox authorization failed: ${detail}`);
    }

    if (status >= 500) {
        return new Error(`ABDM sandbox service failed: ${detail}`);
    }

    return new Error(`ABDM sandbox request failed with status ${status}: ${detail}`);
};

const extractAbdmErrorMessage = (body: unknown): string => {
    if (typeof body === "object" && body !== null) {
        const record = body as Record<string, unknown>;
        const message = record.message ?? record.error ?? record.details;
        if (typeof message === "string" && message.trim()) {
            return message;
        }
    }

    return "Unexpected ABDM sandbox response";
};

const getRequiredEnv = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`${name} is required for ABDM sandbox integration`);
    }

    return value;
};

const getAbdmBaseUrl = (): string =>
    (process.env.ABDM_SANDBOX_BASE_URL?.trim() || DEFAULT_ABDM_BASE_URL).replace(/\/$/, "");

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
