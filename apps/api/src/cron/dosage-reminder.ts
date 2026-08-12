const cron = require("node-cron");
import { supabase } from "../db/client";
import logger from "../utils/logger";
import { redisClient } from "../utils/redis";
import { smsService } from "../services/sms-service";
import { whatsappService } from "../services/whatsapp-service";

const LOCK_KEY = "dosage-reminder:lock";
const LOCK_TTL_MS = 4 * 60 * 1000; // 4 minutes, shorter than the 5-min tick
const LOCK_VALUE = `${process.env.HOSTNAME ?? "api"}:${process.pid}`;
// How close "now" must be to a scheduled time to count as due. The cron ticks
// every 5 minutes, so a 5-minute tolerance window ensures no slot is missed
// while still being tight enough to feel like a "daily reminder", not spam.
const MATCH_WINDOW_MINUTES = 5;

interface DueSchedule {
    id: string;
    user_id: string;
    medicine_name: string;
    dosage: string;
    times: string[];
}

async function acquireLock(): Promise<boolean> {
    if (!redisClient.isOpen) {
        logger.warn("Redis not connected; skipping distributed lock for dosage reminder cron.");
        return true;
    }
    try {
        const result = await redisClient.set(LOCK_KEY, LOCK_VALUE, { NX: true, PX: LOCK_TTL_MS });
        return result === "OK";
    } catch (err) {
        logger.error({ message: "Failed to acquire dosage reminder lock", error: err });
        return false;
    }
}

async function releaseLock(): Promise<void> {
    if (!redisClient.isOpen) return;
    try {
        const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        `;
        await redisClient.eval(script, { keys: [LOCK_KEY], arguments: [LOCK_VALUE] });
    } catch (err) {
        logger.error({ message: "Failed to release dosage reminder lock", error: err });
    }
}

function isTimeDue(timeStr: string, now: Date): boolean {
    const [hh, mm] = timeStr.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return false;

    const scheduled = new Date(now);
    scheduled.setHours(hh, mm, 0, 0);

    const diffMinutes = Math.abs(now.getTime() - scheduled.getTime()) / (1000 * 60);
    return diffMinutes <= MATCH_WINDOW_MINUTES;
}

async function alreadySent(scheduleId: string, timeStr: string, dateStr: string): Promise<boolean> {
    const { data, error } = await supabase
        .from("dosage_reminder_deliveries")
        .select("id")
        .eq("schedule_id", scheduleId)
        .eq("scheduled_time", timeStr)
        .eq("reminder_date", dateStr)
        .maybeSingle();

    if (error) {
        logger.error({ message: "Failed to check dosage reminder delivery record", error });
        return false;
    }
    return Boolean(data);
}

async function markSent(scheduleId: string, timeStr: string, dateStr: string): Promise<void> {
    const { error } = await supabase
        .from("dosage_reminder_deliveries")
        .upsert(
            { schedule_id: scheduleId, scheduled_time: timeStr, reminder_date: dateStr },
            { onConflict: "schedule_id,scheduled_time,reminder_date" }
        );
    if (error) {
        logger.error({ message: "Failed to record dosage reminder delivery", error });
    }
}

async function sendDosageReminder(schedule: DueSchedule): Promise<boolean> {
    const { data: subscriber, error } = await supabase
        .from("notification_subscribers")
        .select("phone, language, channels")
        .eq("user_id", schedule.user_id)
        .eq("is_active", true)
        .eq("status", "active")
        .maybeSingle();

    if (error) {
        logger.error({ message: "Failed to fetch subscriber for dosage reminder", error });
        return false;
    }
    if (!subscriber?.phone) return false;

    const message = `SahiDawa Reminder: Time to take ${schedule.medicine_name} (${schedule.dosage}).`;

    const sendPromises: Promise<boolean>[] = [];
    if (subscriber.channels?.includes("sms")) {
        sendPromises.push(smsService.send(subscriber.phone, message, subscriber.language ?? "en"));
    }
    if (subscriber.channels?.includes("whatsapp")) {
        sendPromises.push(
            whatsappService.send(subscriber.phone, message, subscriber.language ?? "en")
        );
    }
    if (sendPromises.length === 0) return false;

    const results = await Promise.allSettled(sendPromises);
    return results.some((r) => r.status === "fulfilled" && r.value);
}

export async function runDosageReminderCheck(now: Date = new Date()): Promise<void> {
    const todayStr = now.toISOString().split("T")[0];

    const { data: schedules, error } = await supabase
        .from("medicine_schedules")
        .select("id, user_id, medicine_name, dosage, times")
        .eq("is_active", true)
        .lte("start_date", todayStr)
        .or(`end_date.is.null,end_date.gte.${todayStr}`);

    if (error) {
        logger.error({ message: "Failed to fetch active medicine schedules", error });
        return;
    }

    for (const schedule of (schedules as DueSchedule[]) ?? []) {
        const times: string[] = Array.isArray(schedule.times) ? schedule.times : [];

        for (const timeStr of times) {
            if (!isTimeDue(timeStr, now)) continue;

            const sent = await alreadySent(schedule.id, timeStr, todayStr);
            if (sent) continue;

            const delivered = await sendDosageReminder(schedule);
            if (delivered) {
                await markSent(schedule.id, timeStr, todayStr);
            } else {
                logger.warn("Dosage reminder not delivered; will retry next tick.", {
                    scheduleId: schedule.id,
                    timeStr,
                });
            }
        }
    }
}

export const initDosageReminderCron = (): { stop: () => void } => {
    // Every 5 minutes, matching MATCH_WINDOW_MINUTES so no slot is skipped.
    return cron.schedule("*/5 * * * *", async () => {
        const acquired = await acquireLock();
        if (!acquired) {
            logger.info("Dosage reminder lock held by another instance — skipping this tick.");
            return;
        }
        try {
            await runDosageReminderCheck();
        } catch (err) {
            logger.error("Dosage reminder cron: unhandled error during scheduled run", {
                error: err,
            });
        } finally {
            await releaseLock();
        }
    });
};
