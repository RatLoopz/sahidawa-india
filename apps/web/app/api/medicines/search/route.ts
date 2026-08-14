import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { redis } from "@/lib/redis";
import { rateLimit } from "@/lib/rateLimit";
import { escapePostgrest } from "@sahidawa/shared";
import { getClientIp } from "@/lib/getClientIp";

const CACHE_TTL = 24 * 60 * 60;
const MAX_QUERY_LENGTH = 100;

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

        if (query.length > MAX_QUERY_LENGTH) {
            return NextResponse.json(
                { error: "Search query must be 100 characters or fewer." },
                { status: 400 }
            );
        }

        function cleanGenericName(name: string | null | undefined): string {
            if (!name) return "";
            return name
                .replace(/\s*\(\s*\/\s*\)\s*/g, "") // removes " (/)"
                .replace(/\s*\(\s*\)\s*/g, "") // removes " ()"
                .replace(/\s*\(\s*NA\s*\)\s*/g, "") // removes " (NA)"
                .trim();
        }

        const escaped = escapePostgrest(query);
        const cacheKey = `med_search:${query.toLowerCase()}`;
        let responseData: any[] = [];

        try {
            const cachedData = await redis.get(cacheKey);
            if (cachedData) {
                responseData = Array.isArray(cachedData) ? cachedData : [];
            }
        } catch (cacheError) {
            console.error("Redis cache error:", cacheError);
        }

        if (!responseData || responseData.length === 0) {
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
            responseData = data ?? [];

            try {
                await redis.set(cacheKey, responseData, { ex: CACHE_TTL });
            } catch (cacheError) {
                console.error("Failed to save to Redis cache:", cacheError);
            }
        }

        const cleanedData = responseData.map((row: any) => ({
            ...row,
            generic_name: cleanGenericName(row.generic_name),
        }));

        return NextResponse.json(cleanedData);
    } catch (error) {
        console.error("Error in medicine search route:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
