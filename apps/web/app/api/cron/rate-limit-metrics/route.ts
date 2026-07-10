import { NextRequest, NextResponse } from "next/server";
import {
    collectRateLimitMetrics,
    createRateLimitRedisClient,
    persistRateLimitMetrics,
} from "@/lib/rateLimitMetrics";

function isAuthorizedCronRequest(req: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        return process.env.NODE_ENV !== "production";
    }

    return req.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
    if (!isAuthorizedCronRequest(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const redis = createRateLimitRedisClient();

    if (!redis) {
        return NextResponse.json(
            {
                error: "Upstash Redis is not configured",
                persisted: 0,
            },
            { status: 503 }
        );
    }

    try {
        const snapshot = await collectRateLimitMetrics(redis);
        await persistRateLimitMetrics(snapshot);

        return NextResponse.json({
            ok: true,
            snapshotId: snapshot.snapshotId,
            capturedAt: snapshot.capturedAt,
            persisted: snapshot.rows.length,
            totalRejections: snapshot.totalRejections,
            otpMetrics: snapshot.otpMetrics,
            scannedKeys: snapshot.scannedKeys,
            truncated: snapshot.truncated,
        });
    } catch (error) {
        console.error("Failed to collect rate limit metrics:", error);
        return NextResponse.json(
            { error: "Failed to collect rate limit metrics" },
            { status: 500 }
        );
    }
}
