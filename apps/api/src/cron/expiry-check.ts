import cron from "node-cron";
import { supabase } from "../db/client";
import logger from "../utils/logger";

export const initExpiryCron = () => {
    // Runs every day at 00:00 (midnight)
    cron.schedule("0 0 * * *", async () => {
        logger.info("Running medicine expiry check...");

        const alertWindows = [30, 14, 7];

        for (const days of alertWindows) {
            const thresholdDate = new Date();
            thresholdDate.setDate(thresholdDate.getDate() + days);

            const flagColumn = `notified_${days}d`;

            const { data, error } = await supabase
                .from("tracked_medicines")
                .select("*")
                .lte("expiry_date", thresholdDate.toISOString())
                .eq(flagColumn, false);

            if (error) {
                logger.error(`Error fetching ${days}d expiring medicines`, { error });
                continue;
            }

            for (const medicine of data || []) {
                await supabase
                    .from("tracked_medicines")
                    .update({ [flagColumn]: true })
                    .eq("id", medicine.id);
            }
            logger.info(`${days}d check done. ${data?.length || 0} medicines processed.`);
        }
    });
};
