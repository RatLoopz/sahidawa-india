import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createServiceRoleSupabaseClient } from "@/lib/rateLimitMetrics";

// force-dynamic: never pre-render at build time — credentials only exist at runtime
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const serviceRoleSupabase = createServiceRoleSupabaseClient();
        const [bannedRes, recalledRes, counterfeitRes, nsqRes, scansRes, pharmaciesRes] =
            await Promise.all([
                supabase
                    .from("drug_alerts")
                    .select("*", { count: "exact", head: true })
                    .eq("alert_type", "Banned"),
                supabase
                    .from("drug_alerts")
                    .select("*", { count: "exact", head: true })
                    .eq("alert_type", "Recalled"),
                supabase
                    .from("drug_alerts")
                    .select("*", { count: "exact", head: true })
                    .eq("alert_type", "Spurious"),
                supabase
                    .from("drug_alerts")
                    .select("*", { count: "exact", head: true })
                    .eq("alert_type", "NSQ"),
                serviceRoleSupabase
                    .from("scan_history")
                    .select("*", { count: "exact", head: true }),
                supabase
                    .from("pharmacies")
                    .select("*", { count: "exact", head: true })
                    .eq("is_verified", true),
            ]);

        // Check for any errors
        if (bannedRes.error) throw bannedRes.error;
        if (recalledRes.error) throw recalledRes.error;
        if (counterfeitRes.error) throw counterfeitRes.error;
        if (nsqRes.error) throw nsqRes.error;
        if (scansRes.error) throw scansRes.error;
        if (pharmaciesRes.error) throw pharmaciesRes.error;

        return NextResponse.json({
            banned: bannedRes.count ?? 0,
            recalled: recalledRes.count ?? 0,
            counterfeit: counterfeitRes.count ?? 0,
            nsq: nsqRes.count ?? 0,
            totalScans: scansRes.count ?? 0,
            verifiedPharmacies: pharmaciesRes.count ?? 0,
        });
    } catch (error) {
        console.error("Error fetching stats:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
