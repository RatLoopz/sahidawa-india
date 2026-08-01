import crypto from "node:crypto";
import { redisClient } from "../utils/redis";

interface StoredOtp {
    hash: string;
    salt: string;
    expiresAt: string;
}

class OtpStore {
    private fallbackStore = new Map<string, StoredOtp>();
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        this.cleanupInterval = setInterval(
            () => {
                const now = new Date();
                for (const [phone, data] of this.fallbackStore.entries()) {
                    if (new Date(data.expiresAt) < now) {
                        this.fallbackStore.delete(phone);
                    }
                }
            },
            5 * 60 * 1000
        ); // Clean up every 5 minutes

        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    private getRedisKey(phone: string): string {
        return `otp:${phone}`;
    }

    async store(phone: string, otp: string, expiresAt: string): Promise<void> {
        const salt = crypto.randomBytes(16).toString("hex");
        const hash = crypto
            .createHash("sha256")
            .update(otp + salt)
            .digest("hex");
        const data: StoredOtp = { hash, salt, expiresAt };

        if (redisClient.isOpen) {
            const ttl = Math.max(
                1,
                Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
            );
            try {
                await redisClient.setEx(this.getRedisKey(phone), ttl, JSON.stringify(data));
            } catch {}
        }

        this.fallbackStore.set(phone, data);
    }

    async verify(phone: string, otp: string): Promise<boolean> {
        let stored: StoredOtp | undefined;

        if (redisClient.isOpen) {
            try {
                const raw = await redisClient.get(this.getRedisKey(phone));
                if (raw) stored = JSON.parse(raw);
            } catch {}
        }

        if (!stored) {
            stored = this.fallbackStore.get(phone);
        }

        if (!stored) return false;

        if (new Date(stored.expiresAt) < new Date()) {
            await this.clear(phone);
            return false;
        }

        const computedHash = crypto
            .createHash("sha256")
            .update(otp + stored.salt)
            .digest("hex");
        return computedHash === stored.hash;
    }

    async clear(phone: string): Promise<void> {
        if (redisClient.isOpen) {
            try {
                await redisClient.del(this.getRedisKey(phone));
            } catch {}
        }
        this.fallbackStore.delete(phone);
    }
}

export const otpStore = new OtpStore();
