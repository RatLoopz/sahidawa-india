const cron = require("node-cron");
import webPush from "web-push";
import { supabase } from "../db/client";
import logger from "../utils/logger";
import { smsService } from "../services/sms-service";
import {
    listPushSubscriptions,
    isWebPushConfigured,
    buildPushDeliveryEvent,
    recordPushDeliveryEvents,
    removePushSubscription,
} from "../services/notifications";

function buildExpiryPayload(medicineName: string, daysLeft: number) {
    return {
        title: `Medicine expiring in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
        body: `${medicineName} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Please check your stock.`,
        url: "/expiry-tracker",
    };
}

export const initExpiryCron = () => {
    // Runs every day at 00:00 (midnight)
    cron.schedule("0 0 * * *", async () => {
        logger.info("Running medicine expiry check...");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const alertWindows = [
            { days: 30, min: 15, max: 30 },
            { days: 14, min: 8, max: 14 },
            { days: 7, min: 0, max: 7 },
        ];
        for (const window of alertWindows) {
            const days = window.days;

            const minDate = new Date(today);
            minDate.setDate(today.getDate() + window.min);
            minDate.setHours(0, 0, 0, 0);

            const maxDate = new Date(today);
            maxDate.setDate(today.getDate() + window.max);
            maxDate.setHours(23, 59, 59, 999);
            const flagColumn = `notified_${days}d`;

            const { data, error } = await supabase
                .from("tracked_medicines")
                .select("*")
                .gte("expiry_date", minDate.toISOString())
                .lte("expiry_date", maxDate.toISOString())
                .eq(flagColumn, false);

            if (error) {
                logger.error(`Error fetching ${days}d expiring medicines`, { error });
                continue;
            }

            let notifiedCount = 0;
            const deliveredIds: string[] = [];

            for (const medicine of data || []) {
                try {
                    let delivered = false;
                    const expiry = new Date(medicine.expiry_date);

                    const daysLeft = Math.max(
                        0,
                        Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                    );
                    const payload = buildExpiryPayload(medicine.name, daysLeft);

                    // --- Web Push ---
                    if (isWebPushConfigured()) {
                        const allSubs = await listPushSubscriptions();
                        const userSubs = allSubs.filter((s) => s.userId === medicine.user_id);

                        if (userSubs.length > 0) {
                            const results = await Promise.allSettled(
                                userSubs.map((item) =>
                                    webPush.sendNotification(
                                        item.subscription,
                                        JSON.stringify(payload)
                                    )
                                )
                            );

                            // Record delivery events for analytics
                            const fakeAlert = {
                                id: `expiry-${medicine.id}-${days}d`,
                                medicineName: medicine.name,
                                reason: payload.body,
                                severity: "medium" as const,
                                source: "expiry-cron",
                            };
                            const events = results.map((result, i) =>
                                buildPushDeliveryEvent(fakeAlert, userSubs[i].endpoint, result)
                            );
                            await recordPushDeliveryEvents(events);

                            // Clean up expired subscriptions (404/410 = unsubscribed)
                            results.forEach((result, i) => {
                                if (
                                    result.status === "rejected" &&
                                    [404, 410].includes(
                                        (result.reason as { statusCode?: number })?.statusCode ?? -1
                                    )
                                ) {
                                    removePushSubscription(userSubs[i].endpoint);
                                }
                            });

                            const sent = results.filter((r) => r.status === "fulfilled").length;
                            if (sent > 0) delivered = true;
                        }
                    }

                    // --- SMS via notification_subscribers ---
                    if (medicine.user_id) {
                        const { data: subscriber } = await supabase
                            .from("notification_subscribers")
                            .select("phone, language")
                            .eq("user_id", medicine.user_id)
                            .maybeSingle();

                        if (subscriber?.phone) {
                            const smsMessage = `SahiDawa Alert: ${medicine.name} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Please check your stock.`;
                            const smsSent = await smsService.send(
                                subscriber.phone,
                                smsMessage,
                                subscriber.language ?? "en"
                            );
                            if (smsSent) delivered = true;
                        }
                    }

                    // Collect delivered IDs for bulk update
                    if (delivered) {
                        deliveredIds.push(medicine.id);
                        notifiedCount++;
                    } else {
                        logger.warn(
                            `No delivery channel available for medicine ${medicine.id} (${days}d alert)`
                        );
                    }
                } catch (err) {
                    logger.error(
                        `Failed to process ${days}d expiry alert for medicine ${medicine.id}`,
                        { err }
                    );
                }
            }

            // Single bulk update after loop — avoids N+1 DB calls
            if (deliveredIds.length > 0) {
                const { error: updateError } = await supabase
                    .from("tracked_medicines")
                    .update({ [flagColumn]: true })
                    .in("id", deliveredIds);

                if (updateError) {
                    logger.error(
                        `Error updating notification flags for ${days}d expiring medicines`,
                        { error: updateError }
                    );
                }
            }

            logger.info(
                `${days}d check done. ${data?.length ?? 0} medicines found, ${notifiedCount} notified.`
            );
        }
    });
};
