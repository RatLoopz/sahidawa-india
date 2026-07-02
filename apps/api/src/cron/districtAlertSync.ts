const cron = require("node-cron");
import { supabase } from "../db/client";
import logger from "../utils/logger";

type AlertLevel = "low" | "medium" | "high";

function computeAlertLevel(count: number): AlertLevel {
    if (count >= 10) return "high";
    if (count >= 5) return "medium";
    return "low";
}

export async function syncDistrictAlertTallies(): Promise<void> {
    logger.info("Running district alert tally sync...");

    try {
        // 1. Count verified_fake reports grouped by (district, medicine_name)
        const { data: reportCounts, error: countError } = await supabase
            .from("counterfeit_reports")
            .select("district, reported_brand_name")
            .eq("status", "verified_fake")
            .eq("is_escalated", false)
            .not("district", "is", null);

        if (countError) {
            logger.error("District alert sync: failed to fetch report counts", {
                error: countError.message,
            });
            return;
        }

        if (!reportCounts || reportCounts.length === 0) {
            logger.info("District alert sync: no verified_fake reports found, nothing to sync");
            return;
        }

        // 2. Aggregate counts per (district, medicine_name)
        const tally = new Map<string, { district: string; medicine_name: string; count: number }>();

        for (const row of reportCounts) {
            const district = row.district as string;
            const medicine_name = (row.reported_brand_name as string) ?? "Unknown";
            const key = `${district}::${medicine_name}`;

            if (tally.has(key)) {
                tally.get(key)!.count += 1;
            } else {
                tally.set(key, { district, medicine_name, count: 1 });
            }
        }

        // 3. Upsert into district_alerts
        let synced = 0;
        let errors = 0;

        for (const { district, medicine_name, count } of tally.values()) {
            const alert_level = computeAlertLevel(count);

            // Fetch existing alert level for audit trail
            const { data: existing } = await supabase
                .from("district_alerts")
                .select("alert_level")
                .eq("district", district)
                .eq("medicine_name", medicine_name)
                .maybeSingle();

            const previous_alert_level = existing?.alert_level ?? null;

            const { error: upsertError } = await supabase.from("district_alerts").upsert(
                {
                    district,
                    medicine_name,
                    alert_level,
                    previous_alert_level,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "district,medicine_name" }
            );

            if (upsertError) {
                logger.error("District alert sync: upsert failed", {
                    district,
                    medicine_name,
                    error: upsertError.message,
                });
                errors += 1;
            } else {
                synced += 1;
            }
        }

        // 4. Deactivate stale district_alerts with no remaining verified reports
        const activeKeys = Array.from(tally.keys()).map((key) => {
            const [district, medicine_name] = key.split("::");
            return { district, medicine_name };
        });

        const { data: allAlerts } = await supabase
            .from("district_alerts")
            .select("id, district, medicine_name")
            .eq("is_active", true);

        if (allAlerts) {
            for (const alert of allAlerts) {
                const stillActive = activeKeys.some(
                    (k) => k.district === alert.district && k.medicine_name === alert.medicine_name
                );

                if (!stillActive) {
                    await supabase
                        .from("district_alerts")
                        .update({ is_active: false, updated_at: new Date().toISOString() })
                        .eq("id", alert.id);
                }
            }
        }

        logger.info("District alert tally sync complete", {
            synced,
            errors,
            total: tally.size,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("District alert sync: unexpected error", { error: message });
    }
}

export const initDistrictAlertSyncCron = (): void => {
    // Runs every 6 hours
    cron.schedule("0 */6 * * *", async () => {
        await syncDistrictAlertTallies();
    });
    logger.info("District alert tally sync cron initialized (every 6 hours)");
};
