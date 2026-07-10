import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";
import { cookies } from "next/headers";
import { getAdminRoleFromSession } from "@/lib/adminAuth";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getClientIp";
import {
    RATE_LIMIT_METRICS_MAX_SCAN_KEYS,
    RATE_LIMIT_WINDOW_SECONDS,
} from "@/lib/rateLimitMetrics";

/**
 * GET /api/admin/rate-limit-metrics
 *
 * Secure admin-only endpoint that exposes persisted rate limit analytics.
 * Returns blocked IPs, rejection counts, and metrics window information.
 *
 * Security: Admin/Moderator only (verified via Supabase session)
 * Related: Issue #2699 — Unified Rate Limiter Monitoring & Metrics Dashboard
 */

type RateLimitMetricRow = {
    ip_address: string;
    request_count: number;
    captured_at: string;
    is_otp_metric: boolean;
};

export async function GET(req: NextRequest) {
    try {
        const ip = getClientIp(req);
        const { success } = await rateLimit.limit(ip);
        if (!success) {
            return NextResponse.json(
                { error: "Too many requests. Please try again later." },
                { status: 429 }
            );
        }

        // Security: Verify admin session
        const cookieStore = await cookies();
        const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set({ name, value, ...options });
                    });
                },
            },
        });
        const {
            data: { session },
            error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
            return NextResponse.json({ error: "Unauthorized: Please sign in" }, { status: 401 });
        }

        // Check admin role
        const adminRole = getAdminRoleFromSession(session);
        if (adminRole !== "admin" && adminRole !== "moderator") {
            return NextResponse.json(
                { error: "Forbidden: Admin access required" },
                { status: 403 }
            );
        }

        const { data: latestSnapshot, error: latestSnapshotError } = await supabase
            .from("rate_limit_metrics")
            .select("snapshot_id,captured_at")
            .order("captured_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (latestSnapshotError) {
            throw latestSnapshotError;
        }

        if (!latestSnapshot) {
            return NextResponse.json({
                blockedIps: [
                    {
                        ip: "192.0.2.1",
                        count: 15,
                        lastBlocked: new Date(Date.now() - 5 * 60000).toISOString(),
                    },
                    {
                        ip: "203.0.113.42",
                        count: 8,
                        lastBlocked: new Date(Date.now() - 15 * 60000).toISOString(),
                    },
                ],
                totalRejections: 23,
                otpMetrics: {
                    totalHits: 12,
                    blocked: 3,
                },
                windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
                fetchedAt: new Date().toISOString(),
                isDemo: true,
                truncated: false,
                scannedKeys: 0,
                maxScanKeys: RATE_LIMIT_METRICS_MAX_SCAN_KEYS,
            });
        }

        const { data: rows, error: rowsError } = await supabase
            .from("rate_limit_metrics")
            .select("ip_address,request_count,captured_at,is_otp_metric")
            .eq("snapshot_id", latestSnapshot.snapshot_id)
            .order("request_count", { ascending: false });

        if (rowsError) {
            throw rowsError;
        }

        const metricRows = (rows ?? []) as RateLimitMetricRow[];
        const totalRejections = metricRows.reduce((total, row) => total + row.request_count, 0);
        const otpRows = metricRows.filter((row) => row.is_otp_metric);
        const otpMetrics = {
            totalHits: otpRows.reduce((total, row) => total + row.request_count, 0),
            blocked: otpRows.length,
        };
        const blockedIps = metricRows.map((row) => ({
            ip: row.ip_address,
            count: row.request_count,
            lastBlocked: row.captured_at,
        }));

        return NextResponse.json({
            blockedIps: blockedIps.slice(0, 100),
            totalRejections,
            otpMetrics,
            windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
            fetchedAt: latestSnapshot.captured_at,
            isDemo: false,
            truncated: false,
            scannedKeys: 0,
            maxScanKeys: RATE_LIMIT_METRICS_MAX_SCAN_KEYS,
        });
    } catch (err) {
        console.error("Failed to fetch rate limit metrics:", err);
        return NextResponse.json({ error: "Failed to fetch rate limit metrics" }, { status: 500 });
    }
}
