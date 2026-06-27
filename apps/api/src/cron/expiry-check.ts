// Use require for node-cron to avoid CommonJS/ESM issues
const cron = require('node-cron');
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
                .select("id")
                .lte("expiry_date", thresholdDate.toISOString())
                .eq(flagColumn, false);

            if (error) {
                logger.error(`Error fetching ${days}d expiring medicines`, { error });
                continue;
            }

            const medicineIds = (data || []).map((m) => m.id);
            if (medicineIds.length > 0) {
                const { error: updateError } = await supabase
                    .from("tracked_medicines")
                    .update({ [flagColumn]: true })
                    .in("id", medicineIds);

                if (updateError) {
                    logger.error(
                        `Error updating notification flags for ${days}d expiring medicines`,
                        { error: updateError }
                    );
                }
            }
            logger.info(`${days}d check done. ${medicineIds.length} medicines processed.`);
        }
    });
};