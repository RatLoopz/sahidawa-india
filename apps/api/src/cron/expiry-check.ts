import cron from "node-cron";
import { supabase } from "../db/client";
import logger from "../utils/logger";

export const initExpiryCron = () => {
    // Runs every day at 00:00 (midnight)
    cron.schedule("0 0 * * *", async () => {
        logger.info("Running medicine expiry check...");

        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        // Fetch medicines expiring within 30 days
        const { data, error } = await supabase
            .from("tracked_medicines")
            .select("*")
            .lte("expiry_date", thirtyDaysFromNow.toISOString())
            .eq("notified_30d", false); // Only pick those not yet notified

        if (error) {
            logger.error("Error fetching expiring medicines", { error });
            return;
        }

        for (const medicine of data || []) {
            // Here is where you would trigger the notification
            // e.g., sendNotification(medicine.user_id, "Your medicine is expiring!");

            // For now, mark as notified to prevent duplicate alerts
            await supabase
                .from("tracked_medicines")
                .update({ notified_30d: true })
                .eq("id", medicine.id);
        }
        logger.info(`Expiry check completed. ${data?.length || 0} medicines processed.`);
    });
};
