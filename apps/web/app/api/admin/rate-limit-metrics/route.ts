import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";
import { cookies } from "next/headers";
import { getAdminRoleFromSession } from "@/lib/adminAuth";
import { Redis } from "@upstash/redis";

/**
 * GET /api/admin/rate-limit-metrics
 *
 * Secure admin-only endpoint that exposes rate limit analytics from Upstash.
 * Returns blocked IPs, rejection counts, and metrics window information.
 *
 * Security: Admin/Moderator only (verified via Supabase session)
 * Related: Issue #2699 — Unified Rate Limiter Monitoring & Metrics Dashboard
 */

const hasRedisCredentials =
    Boolean(process.env.UPSTASH_REDIS_REST_URL) && Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

const redis = hasRedisCredentials ? Redis.fromEnv() : null;

export async function GET() {
    try {
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

        // If Redis is not configured, return mock data
        if (!redis) {
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
                windowSeconds: 60,
                fetchedAt: new Date().toISOString(),
                isDemo: true,
            });
        }

        // Query Redis for rate limit keys
        // Pattern: upstash_ratelimit_* (Upstash stores rate limit data with this prefix)
        const keys = await redis.keys("upstash_ratelimit_*");

        interface BlockedIP {
            ip: string;
            count: number;
            lastBlocked: string;
        }

        const blockedIps: BlockedIP[] = [];
        let totalRejections = 0;

        // Aggregate rejection data per IP
        const ipMap = new Map<string, { count: number; lastBlocked: string }>();

        for (const key of keys) {
            try {
                // Key format: upstash_ratelimit_<identifier>
                // Extract IP or identifier from key
                const identifier = key.replace("upstash_ratelimit_", "");

                // Fetch the value (contains rejection count and timestamp)
                const data = await redis.get(key);

                if (data) {
                    // Data structure from Upstash: { limit, remaining, reset, pending, success }
                    // For failed requests: success = false
                    const count = typeof data === "number" ? data : 1;
                    const now = new Date().toISOString();

                    if (!ipMap.has(identifier)) {
                        ipMap.set(identifier, { count: 0, lastBlocked: now });
                    }

                    const current = ipMap.get(identifier)!;
                    current.count += count;
                    current.lastBlocked = now;
                    totalRejections += count;
                }
            } catch (err) {
                // Skip malformed keys
                console.error(`Failed to process rate limit key ${key}:`, err);
            }
        }

        // Convert map to sorted array
        blockedIps.push(
            ...Array.from(ipMap.entries()).map(([ip, data]) => ({
                ip,
                count: data.count,
                lastBlocked: data.lastBlocked,
            }))
        );

        // Sort by rejection count descending
        blockedIps.sort((a, b) => b.count - a.count);

        return NextResponse.json({
            blockedIps: blockedIps.slice(0, 100), // Limit to top 100 IPs
            totalRejections,
            windowSeconds: 60,
            fetchedAt: new Date().toISOString(),
            isDemo: false,
        });
    } catch (err) {
        console.error("Failed to fetch rate limit metrics:", err);
        return NextResponse.json({ error: "Failed to fetch rate limit metrics" }, { status: 500 });
    }
}
