import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { redis } from "@/lib/redis";
import { rateLimit } from "@/lib/rateLimit";

const CACHE_TTL = 24 * 60 * 60;

function escapePostgrest(val: string) {
    // Escape backslash first (must be first to avoid double-escaping),
    // then LIKE wildcards, then PostgREST .or() syntax characters
    return val
        .replace(/\\/g, "\\\\")
        .replace(/[%_]/g, "\\$&")
        .replace(/[,"'()]/g, "\\$&");
}

function getClientIp(request: NextRequest): string {
    return (
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        request.headers.get("x-real-ip") ??
        "anonymous"
    );
}

export async function GET(request: NextRequest) {
    try {
        // Rate limiting — before any cache or DB work
        const ip = getClientIp(request);
        const { success, limit, remaining, reset } = await rateLimit.limit(ip);

        if (!success) {
            return NextResponse.json(
                { error: "Too many requests. Please try again later." },
                {
                    status: 429,
                    headers: {
                        "X-RateLimit-Limit": String(limit),
                        "X-RateLimit-Remaining": String(remaining),
                        "X-RateLimit-Reset": String(reset),
                        "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
                    },
                }
            );
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get("q")?.trim() ?? "";

        // Whitespace-only or too-short queries short-circuit without hitting DB
        if (query.length < 2) {
            return NextResponse.json([]);
        }

        const escaped = escapePostgrest(query);
        const cacheKey = `med_search:${query.toLowerCase()}`;

        try {
            const cachedData = await redis.get(cacheKey);
            if (cachedData) {
                return NextResponse.json(cachedData);
            }
        } catch (cacheError) {
            console.error("Redis cache error:", cacheError);
        }

        const { data, error } = await supabase
            .from("medicines")
            .select(
                "id, brand_name, generic_name, manufacturer, mrp, jan_aushadhi_price, composition, cdsco_approval_status"
            )
            .or(`brand_name.ilike."%${escaped}%",generic_name.ilike."%${escaped}%"`)
            .limit(20);

        if (error) {
            throw error;
        }

        try {
            await redis.set(cacheKey, data, { ex: CACHE_TTL });
        } catch (cacheError) {
            console.error("Failed to save to Redis cache:", cacheError);
        }

        return NextResponse.json(data ?? []);
    } catch (error) {
        console.error("Error in medicine search route:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
