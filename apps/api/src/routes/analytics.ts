import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import logger from "../utils/logger";
import { limiter } from "../middleware/rateLimit";

const router = Router();
const QuerySchema = z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
});

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

router.get("/heatmap", limiter, async (req: Request, res: Response) => {
    try {
        const { days } = QuerySchema.parse(req.query);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const { data: scans, error } = await supabase
            .from("scan_history")
            .select("latitude, longitude, created_at")
            .not("latitude", "is", null)
            .not("longitude", "is", null)
            .gte("created_at", since);

        if (error) {
            logger.error({ message: "Failed to fetch scan history for heatmap", error, days });
            res.status(500).json({ error: "Failed to fetch heatmap data" });
            return;
        }

        const grouped = new Map<string, { lat: number; lng: number; intensity: number }>();
        for (const scan of scans || []) {
            const lat = Math.round(parseFloat(scan.latitude as string) * 100) / 100;
            const lng = Math.round(parseFloat(scan.longitude as string) * 100) / 100;
            const key = `${lat},${lng}`;
            const entry = grouped.get(key) || { lat, lng, intensity: 0 };
            entry.intensity++;
            grouped.set(key, entry);
        }

        const features = Array.from(grouped.values()).map((point) => ({
            type: "Feature" as const,
            geometry: {
                type: "Point" as const,
                coordinates: [point.lng, point.lat],
            },
            properties: { intensity: point.intensity },
        }));

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
