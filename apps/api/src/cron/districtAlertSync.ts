const cron = require("node-cron");
import { supabase } from "../db/client";
import logger from "../utils/logger";

type AlertLevel = "low" | "medium" | "high";

type DistrictAlertRow = {
    id: string;
    district: string;
    medicine_name: string | null;
    alert_level: AlertLevel | null;
};

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
            .not("district", "is", null)
            .or(`snoozed_until.is.null,snoozed_until.lte.${new Date().toISOString()}`);

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

        // 3. Bulk Upsert into district_alerts

        // Fetch all existing active alerts upfront to map previous_alert_level
        const { data: allAlerts, error: alertFetchError } = await supabase
            .from("district_alerts")
            .select("id, district, medicine_name, alert_level")
            .eq("is_active", true);

        if (alertFetchError) {
            logger.error("District alert sync: failed to fetch active alerts", {
                error: alertFetchError.message,
            });
            return;
        }

        const existingAlertsMap = new Map<string, DistrictAlertRow>();
        if (allAlerts) {
            for (const alert of allAlerts) {
                existingAlertsMap.set(`${alert.district}::${alert.medicine_name}`, alert);
            }
        }

        const timestamp = new Date().toISOString();
        const upsertPayload = [];

        for (const { district, medicine_name, count } of tally.values()) {
            const alert_level = computeAlertLevel(count);
            const key = `${district}::${medicine_name}`;
            const previous_alert_level = existingAlertsMap.get(key)?.alert_level ?? null;

            upsertPayload.push({
                district,
                medicine_name,
                alert_level,
                previous_alert_level,
                is_active: true,
                updated_at: timestamp,
            });
        }

        let synced = 0;
        let errors = 0;

        if (upsertPayload.length > 0) {
            const { error: upsertError } = await supabase
                .from("district_alerts")
                .upsert(upsertPayload, { onConflict: "district,medicine_name" });

            if (upsertError) {
                logger.error("District alert sync: bulk upsert failed", {
                    error: upsertError.message,
                });
                errors += upsertPayload.length;
            } else {
                synced += upsertPayload.length;
            }
        }

        // 4. Deactivate stale district_alerts with no remaining verified reports
        const staleIds = [];

        if (allAlerts) {
            for (const alert of allAlerts) {
                const stillActive = tally.has(`${alert.district}::${alert.medicine_name}`);
                if (!stillActive) {
                    staleIds.push(alert.id);
                }
            }
        }

        if (staleIds.length > 0) {
            const { error: updateError } = await supabase
                .from("district_alerts")
                .update({ is_active: false, updated_at: timestamp })
                .in("id", staleIds);

            if (updateError) {
                logger.error("District alert sync: bulk deactivate failed", {
                    error: updateError.message,
                });
                errors += 1;
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

export const initDistrictAlertSyncCron = (): { stop: () => void } => {
    // Runs every 6 hours
    const task = cron.schedule("0 */6 * * *", async () => {
        try {
            await syncDistrictAlertTallies();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error("District alert tally sync cron: unhandled error during scheduled run", {
                error: message,
            });
        }
    });
    logger.info("District alert tally sync cron initialized (every 6 hours)");
    return task;
};
