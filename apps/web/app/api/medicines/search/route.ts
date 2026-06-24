import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { redis } from "@/lib/redis";

const CACHE_TTL = 24 * 60 * 60;

function escapePostgres(val: string) {
    return val.replace(/[%_]/g, "\\$&");
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get("q")?.trim() || "";

        if (query.length < 2) {
            return NextResponse.json([]);
        }

        const escaped = escapePostgres(query);
        const cacheKey = `med_search:${escaped.toLowerCase()}`;

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

        return NextResponse.json(data || []);
    } catch (error) {
        console.error("Error in medicine search route:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
