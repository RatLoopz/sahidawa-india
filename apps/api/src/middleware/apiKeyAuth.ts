import { Request, Response, NextFunction } from "express";
import crypto, { pbkdf2 } from "crypto";
import { promisify } from "util";
import { supabase } from "../db/client";
import logger from "../utils/logger";

const pbkdf2Async = promisify(pbkdf2);

export interface ApiKeyInfo {
    keyId: string;
    userId: string;
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

    // Use the async pbkdf2 variant to avoid blocking the Node.js event loop.
    // pbkdf2Sync with 100k iterations can stall the server for 200-500ms per
    // request, creating a CPU-based DoS vector. The async version offloads the
    // computation to libuv's thread pool, keeping the event loop responsive.
    const [keyId, secret] = apiKey.split(".");

    if (!keyId || !secret) {
        res.status(401).json({ error: "Invalid API key format" });
        return;
    }

    try {
        const { data, error } = await supabase
            .from("api_keys")
            .select("id, user_id, scopes, expires_at, key_hash, key_salt, is_active")
            .eq("id", keyId)
            .maybeSingle();

        if (error) {
            logger.error("Error looking up API key", { error });
            res.status(500).json({ error: "Internal server error" });
            return;
        }

        if (!data || !data.key_salt) {
            res.status(401).json({ error: "Invalid API key" });
            return;
        }

        if (data.expires_at && new Date(data.expires_at) < new Date()) {
            res.status(401).json({ error: "API key has expired" });
            return;
        }

        // Revoked keys are rejected before the expensive hash comparison so a
        // leaked-and-revoked key cannot be used to burn CPU either. Checked with
        // `=== false` so a legacy row where the column is somehow null is still
        // treated as active (the column defaults to true).
        if (data.is_active === false) {
            res.status(401).json({ error: "API key has been revoked" });
            return;
        }

        const computedHashBuffer = await pbkdf2Async(secret, data.key_salt, 100000, 64, "sha512");
        const computedHash = computedHashBuffer.toString("hex");
        const storedHash = data.key_hash;

        const computedBuffer = Buffer.from(computedHash, "hex");
        const storedBuffer = Buffer.from(storedHash, "hex");

        const isValid =
            computedBuffer.length === storedBuffer.length &&
            crypto.timingSafeEqual(computedBuffer, storedBuffer);

        if (!isValid) {
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
            userId: data.user_id,
            scopes: data.scopes,
        };

        logger.info("Authenticated API request", { userId: data.user_id });

        next();
    } catch (err) {
        logger.error("Unexpected error in API key authentication", { error: err });
        res.status(500).json({ error: "Internal server error" });
    }
};
