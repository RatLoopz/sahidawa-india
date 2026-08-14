import { supabase } from "@/lib/supabase";

export const FAKE_MEDICINE_HUNTER_THRESHOLD = 5;

/**
 * Count a user's verified counterfeit-medicine reports.
 *
 * The badge in the profile dashboard is awarded once this count crosses
 * FAKE_MEDICINE_HUNTER_THRESHOLD. The query is guarded so a missing table
 * or RLS denial resolves to 0 (no badge) rather than throwing — the badge
 * is a nice-to-have and must never break the profile page.
 */
export async function getVerifiedReportCount(userId: string): Promise<number> {
    const { count, error } = await supabase
        .from("counterfeit_reports")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "verified");

    if (error) {
        console.error("Failed to load verified report count:", error.message);
        return 0;
    }

    return count ?? 0;
}
