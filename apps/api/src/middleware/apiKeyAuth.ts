import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { supabase } from "../db/client";
import logger from "../utils/logger";

export interface ApiKeyInfo {
    keyId: string;
    callerName: string;
    scopes: string[];
}

export interface ApiKeyRequest extends Request {
    apiKey?: ApiKeyInfo;
}

export const requireApiKey = async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    const apiKey = req.headers["x-api-secret"] as string | undefined;

    if (!apiKey) {
        res.status(401).json({ error: "Missing API key" });
        return;
    }

    const keyHash = crypto
        .pbkdf2Sync(apiKey, "sahidawa-api-key-v1", 100000, 64, "sha512")
        .toString("hex");

    try {
        const { data, error } = await supabase
            .from("api_keys")
            .select("id, caller_name, scopes, is_active")
            .eq("key_hash", keyHash)
            .maybeSingle();

        if (error) {
            logger.error("Error looking up API key", { error });
            res.status(500).json({ error: "Internal server error" });
            return;
        }

        if (!data || !data.is_active) {
            res.status(401).json({ error: "Invalid or inactive API key" });
            return;
        }

        supabase
            .from("api_keys")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", data.id)
            .then(({ error: updateError }) => {
                if (updateError) {
                    logger.warn("Failed to update api_key last_used_at", {
                        error: updateError,
                        keyId: data.id,
                    });
                }
            });

        req.apiKey = {
            keyId: data.id,
            callerName: data.caller_name,
            scopes: data.scopes,
        };

        logger.info("Authenticated API request", { caller: data.caller_name });

        next();
    } catch (err) {
        logger.error("Unexpected error in API key authentication", { error: err });
        res.status(500).json({ error: "Internal server error" });
    }
};
