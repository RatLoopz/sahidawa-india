import { randomUUID } from "crypto";
import { Redis } from "@upstash/redis";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/env";

export const RATE_LIMIT_KEY_PATTERN = "upstash_ratelimit_*";
export const RATE_LIMIT_WINDOW_SECONDS = 60;
export const RATE_LIMIT_METRICS_MAX_SCAN_KEYS = 5000;

const SCAN_COUNT = 100;

type RateLimitMetricRow = {
    snapshot_id: string;
    ip_address: string;
    rate_limit_key: string;
    request_count: number;
    window_seconds: number;
    window_start: string;
    captured_at: string;
    is_otp_metric: boolean;
    updated_at: string;
};

export type RateLimitMetricSnapshot = {
    snapshotId: string;
    capturedAt: string;
    rows: RateLimitMetricRow[];
    totalRejections: number;
    otpMetrics: {
        totalHits: number;
        blocked: number;
    };
    scannedKeys: number;
    truncated: boolean;
};

export function hasRedisCredentials(): boolean {
    return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function createRateLimitRedisClient(): Redis | null {
    return hasRedisCredentials() ? Redis.fromEnv() : null;
}

export function createServiceRoleSupabaseClient() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for privileged server operations.");
    }

    return createClient(getSupabaseUrl(), serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

function getCurrentHourStart(date: Date): string {
    const windowStart = new Date(date);
    windowStart.setUTCMinutes(0, 0, 0);
    return windowStart.toISOString();
}

function getRequestCount(data: unknown): number {
    if (typeof data === "number" && Number.isFinite(data)) {
        return Math.max(0, Math.floor(data));
    }

    if (typeof data === "string") {
        const parsed = Number.parseInt(data, 10);
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 1;
    }

    return data ? 1 : 0;
}

export async function scanRateLimitKeys(redisClient: Redis): Promise<{
    keys: string[];
    scannedKeys: number;
    truncated: boolean;
}> {
    const keys: string[] = [];
    let cursor = "0";

    do {
        const [nextCursor, batch] = await redisClient.scan(cursor, {
            match: RATE_LIMIT_KEY_PATTERN,
            count: SCAN_COUNT,
        });

        cursor = String(nextCursor);
        const remainingCapacity = RATE_LIMIT_METRICS_MAX_SCAN_KEYS - keys.length;
        const batchExceedsCapacity = batch.length > remainingCapacity;

        if (remainingCapacity > 0) {
            keys.push(...batch.slice(0, remainingCapacity));
        }

        if (
            keys.length >= RATE_LIMIT_METRICS_MAX_SCAN_KEYS &&
            (cursor !== "0" || batchExceedsCapacity)
        ) {
            return {
                keys,
                scannedKeys: keys.length,
                truncated: true,
            };
        }
    } while (cursor !== "0");

    return {
        keys,
        scannedKeys: keys.length,
        truncated: false,
    };
}

export async function collectRateLimitMetrics(
    redisClient: Redis
): Promise<RateLimitMetricSnapshot> {
    const { keys, scannedKeys, truncated } = await scanRateLimitKeys(redisClient);
    const now = new Date();
    const capturedAt = now.toISOString();
    const snapshotId = randomUUID();
    const windowStart = getCurrentHourStart(now);
    const metricMap = new Map<string, RateLimitMetricRow>();
    let totalRejections = 0;
    const otpMetrics = {
        totalHits: 0,
        blocked: 0,
    };

    for (const key of keys) {
        try {
            const data = await redisClient.get(key);
            const requestCount = getRequestCount(data);

            if (!requestCount) {
                continue;
            }

            const ipAddress = key.replace("upstash_ratelimit_", "");
            const isOtpMetric = key.includes("notification_register");
            const current = metricMap.get(ipAddress);

            if (current) {
                current.request_count += requestCount;
                current.is_otp_metric = current.is_otp_metric || isOtpMetric;
                current.updated_at = capturedAt;
            } else {
                metricMap.set(ipAddress, {
                    snapshot_id: snapshotId,
                    ip_address: ipAddress,
                    rate_limit_key: key,
                    request_count: requestCount,
                    window_seconds: RATE_LIMIT_WINDOW_SECONDS,
                    window_start: windowStart,
                    captured_at: capturedAt,
                    is_otp_metric: isOtpMetric,
                    updated_at: capturedAt,
                });
            }

            totalRejections += requestCount;

            if (isOtpMetric) {
                otpMetrics.totalHits += requestCount;
                otpMetrics.blocked += 1;
            }
        } catch (error) {
            console.error(`Failed to process rate limit key ${key}:`, error);
        }
    }

    return {
        snapshotId,
        capturedAt,
        rows: Array.from(metricMap.values()),
        totalRejections,
        otpMetrics,
        scannedKeys,
        truncated,
    };
}

export async function persistRateLimitMetrics(snapshot: RateLimitMetricSnapshot) {
    const supabase = createServiceRoleSupabaseClient();

    if (snapshot.rows.length === 0) {
        return;
    }

    const { error } = await supabase
        .from("rate_limit_metrics")
        .upsert(snapshot.rows, { onConflict: "ip_address,window_start" });

    if (error) {
        throw error;
    }
}
