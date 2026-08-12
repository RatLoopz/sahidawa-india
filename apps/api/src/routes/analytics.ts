import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import logger from "../utils/logger";
import { analyticsLimiter } from "../middleware/rateLimit";
import { requireAuth } from "../middleware/auth";

const router = Router();
const QuerySchema = z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
    precision: z.coerce.number().int().min(1).max(12).default(6),
});

function encodeGeohash(latitude: number, longitude: number, precision: number = 6): string {
    const BASE32_CHARS = "0123456789bcdefghjkmnpqrstuvwxyz";
    let isEven = true;
    let latMin = -90.0,
        latMax = 90.0;
    let lngMin = -180.0,
        lngMax = 180.0;
    let geohash = "";
    let bit = 0;
    let ch = 0;

    while (geohash.length < precision) {
        if (isEven) {
            const mid = (lngMin + lngMax) / 2;
            if (longitude > mid) {
                ch |= 1 << (4 - bit);
                lngMin = mid;
            } else {
                lngMax = mid;
            }
        } else {
            const mid = (latMin + latMax) / 2;
            if (latitude > mid) {
                ch |= 1 << (4 - bit);
                latMin = mid;
            } else {
                latMax = mid;
            }
        }

        isEven = !isEven;
        if (bit < 4) {
            bit++;
        } else {
            geohash += BASE32_CHARS[ch];
            bit = 0;
            ch = 0;
        }
    }
    return geohash;
}

type PushNotificationEventRow = {
    status: string | null;
    http_status: number | null;
    failure_reason: string | null;
    occurred_at: string | null;
};

function roundRate(value: number) {
    return Math.round(value * 1000) / 1000;
}

function summarizePushNotificationEvents(rows: PushNotificationEventRow[]) {
    const attempted = rows.length;
    const sent = rows.filter((row) => row.status === "sent").length;
    const failedRows = rows.filter((row) => row.status === "failed");
    const failed = failedRows.length;
    const reasons = new Map<string, { reason: string; httpStatus: number | null; count: number }>();

    for (const row of failedRows) {
        const httpStatus = typeof row.http_status === "number" ? row.http_status : null;
        const reason = row.failure_reason ?? (httpStatus === null ? "unknown" : String(httpStatus));
        const key = `${reason}:${httpStatus ?? "none"}`;
        const current = reasons.get(key) ?? { reason, httpStatus, count: 0 };
        current.count += 1;
        reasons.set(key, current);
    }

    const failureReasons = Array.from(reasons.values())
        .map((reason) => ({
            ...reason,
            rate: failed === 0 ? 0 : roundRate(reason.count / failed),
        }))
        .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));

    return {
        attempted,
        sent,
        failed,
        deliveryRate: attempted === 0 ? 0 : roundRate(sent / attempted),
        failureReasons,
    };
}

router.get("/heatmap", analyticsLimiter, requireAuth, async (req: Request, res: Response) => {
    try {
        const { days, precision } = QuerySchema.parse(req.query);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const { data: scans, error } = await supabase
            .from("scan_history")
            .select("latitude, longitude, created_at")
            .not("latitude", "is", null)
            .not("longitude", "is", null)
            .gte("created_at", since)
            .limit(10000);

        if (error) {
            logger.error({ message: "Failed to fetch scan history for heatmap", error, days });
            res.status(500).json({ error: "Failed to fetch heatmap data" });
            return;
        }

        const geohashGroups = new Map<
            string,
            { totalLat: number; totalLng: number; count: number }
        >();

        for (const scan of scans || []) {
            const rawLat = parseFloat(scan.latitude as string);
            const rawLng = parseFloat(scan.longitude as string);

            if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) continue;
            if (rawLat < -90 || rawLat > 90 || rawLng < -180 || rawLng > 180) continue;

            const hash = encodeGeohash(rawLat, rawLng, precision);
            const group = geohashGroups.get(hash) || { totalLat: 0, totalLng: 0, count: 0 };

            group.totalLat += rawLat;
            group.totalLng += rawLng;
            group.count += 1;
            geohashGroups.set(hash, group);
        }

        // C. Features mapping (Centroid points aur properties mein geohash return)
        const features = Array.from(geohashGroups.entries()).map(([hash, data]) => {
            const centroidLat = data.totalLat / data.count;
            const centroidLng = data.totalLng / data.count;

            return {
                type: "Feature" as const,
                geometry: {
                    type: "Point" as const,
                    coordinates: [
                        Math.round(centroidLng * 100000) / 100000,
                        Math.round(centroidLat * 100000) / 100000,
                    ],
                },
                properties: {
                    intensity: data.count,
                    geohash: hash, // Frontend capability enhancement ke liye
                },
            };
        });

        const geoJson = {
            type: "FeatureCollection",
            features,
        };

        res.json(geoJson);
    } catch (e) {
        if (e instanceof z.ZodError) {
            res.status(400).json({ error: "Invalid query parameters", details: e.issues });
            return;
        }
        logger.error({ message: "Unexpected error in analytics heatmap", error: e });
        res.status(500).json({ error: "Internal server error" });
    }
});

export async function getPushNotificationAnalytics(req: Request, res: Response) {
    try {
        const { days } = QuerySchema.parse(req.query);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase
            .from("push_notification_events")
            .select("status, http_status, failure_reason, occurred_at")
            .gte("occurred_at", since);

        if (error) {
            logger.error({
                message: "Failed to fetch push notification analytics",
                error,
                days,
            });
            res.status(500).json({ error: "Failed to fetch push notification analytics" });
            return;
        }

        res.json({
            days,
            since,
            ...summarizePushNotificationEvents((data ?? []) as PushNotificationEventRow[]),
        });
    } catch (e) {
        if (e instanceof z.ZodError) {
            res.status(400).json({ error: "Invalid query parameters", details: e.issues });
            return;
        }
        logger.error({ message: "Unexpected error in push notification analytics", error: e });
        res.status(500).json({ error: "Internal server error" });
    }
}

export default router;
