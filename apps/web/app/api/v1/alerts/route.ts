import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helper for ILIKE escaping
function escapeIlike(str: string) {
    return str.replace(/[%_]/g, "\\$&");
}

export async function GET(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ error: "Supabase configuration is missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const searchParams = request.nextUrl.searchParams;

    const rawPage = parseInt(searchParams.get("page") || "1", 10);
    const rawLimit = parseInt(searchParams.get("limit") || "10", 10);
    const brand = searchParams.get("brand") || "";
    const region = searchParams.get("region") || "";
    const batchNumber = searchParams.get("batch_number") || "";

    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 100);
    const offset = (page - 1) * limit;

    let query = supabase.from("drug_alerts").select("*", { count: "exact" });

    if (brand) {
        query = query.ilike("reported_brand_name", `%${escapeIlike(brand)}%`);
    }
    if (region) {
        query = query.ilike("state", `%${escapeIlike(region)}%`);
    }
    if (batchNumber) {
        query = query.eq("batch_number", batchNumber);
    }

    try {
        const pagePromise = query
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        // Get stats
        const statsPromise = supabase.rpc("get_alerts_aggregate_stats", {
            p_brand: brand || null,
            p_region: region || null,
            p_batch_number: batchNumber || null,
        });

        const [pageResult, statsResult] = await Promise.all([pagePromise, statsPromise]);

        if (pageResult.error) {
            console.error("Alerts DB Error:", pageResult.error);
            return NextResponse.json(
                { error: "Failed to fetch alerts", details: pageResult.error },
                { status: 500 }
            );
        }

        if (statsResult.error) {
            console.error("Alerts Stats DB Error:", statsResult.error);
        }

        const stats = (statsResult.data ?? {}) as {
            totalCriticalCount?: number;
            totalImpactedRegionsCount?: number;
        };

        const totalCount = pageResult.count ?? 0;
        const totalPageCount = Math.ceil(totalCount / limit);

        return NextResponse.json({
            data: pageResult.data ?? [],
            pageIndex: page,
            pageSize: (pageResult.data ?? []).length,
            totalCount,
            totalPageCount,
            totalCriticalCount: stats.totalCriticalCount ?? 0,
            totalImpactedRegionsCount: stats.totalImpactedRegionsCount ?? 0,
        });
    } catch (err) {
        console.error("Unexpected error in GET /api/v1/alerts", err);
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }
}
