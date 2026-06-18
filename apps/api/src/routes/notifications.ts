import express, { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, optionalAuth, AuthenticatedRequest } from "../middleware/auth";
import { verifyTwilioSignature } from "../middleware/twilioSignature";
import { supabase, dbConfig } from "../db/client";
import { smsService } from "../services/sms-service";
import { whatsappService } from "../services/whatsapp-service";
import logger from "../utils/logger";
import {
    getMockRecallFeed,
    getVapidPublicKey,
    isWebPushConfigured,
    pushSubscriptionSchema,
    recallAlertSchema,
    removePushSubscription,
    savePushSubscription,
    triggerRecallAlert,
} from "../services/notifications";

const router = Router();

// ── Web Push Notifications (Existing) ──────────────────────────────────────────

const unsubscribeSchema = z.object({
    endpoint: z.string().url(),
});

router.get("/vapid-public-key", (_req, res) => {
    const publicKey = getVapidPublicKey();
    res.json({
        publicKey,
        configured: isWebPushConfigured(),
    });
});

router.post("/subscriptions", requireAuth, async (req: AuthenticatedRequest, res) => {
    const parsed = pushSubscriptionSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid push subscription",
            issues: parsed.error.issues,
        });
        return;
    }

    const result = await savePushSubscription(parsed.data, req.user!.id);

    res.status(201).json({
        endpoint: result.stored.endpoint,
        persisted: result.persisted,
        warning: result.persisted
            ? undefined
            : "Stored in memory because push_subscriptions table is unavailable.",
    });
});

router.delete("/subscriptions", requireAuth, async (req: AuthenticatedRequest, res) => {
    const parsed = unsubscribeSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid unsubscribe payload",
            issues: parsed.error.issues,
        });
        return;
    }

    await removePushSubscription(parsed.data.endpoint);
    res.status(204).send();
});

router.get("/recalls/mock", (_req, res) => {
    res.json({ recalls: getMockRecallFeed() });
});

router.post("/recalls/mock/trigger", requireAuth, requireRole("admin"), async (req, res) => {
    if (process.env.NODE_ENV === "production") {
        res.status(403).json({ error: "Mock triggers are disabled in production" });
        return;
    }

    const feed = getMockRecallFeed();
    const parsed = recallAlertSchema.partial({ id: true }).safeParse(req.body ?? {});

    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid recall alert payload",
            issues: parsed.error.issues,
        });
        return;
    }

    const alert = recallAlertSchema.parse({
        ...feed[0],
        ...parsed.data,
        id: parsed.data.id ?? `manual-${Date.now()}`,
        recalledAt: parsed.data.recalledAt ?? new Date().toISOString(),
    });

    const result = await triggerRecallAlert(alert);

    res.json({
        alert,
        delivery: result,
    });
});

// ── SMS & WhatsApp Alert Integration (New) ─────────────────────────────────────

const registerSchema = z.object({
    phone: z.string().min(10, "Phone number too short").max(20, "Phone number too long"),
    channels: z.array(z.enum(["sms", "whatsapp"])).min(1, "At least one channel is required"),
    language: z.string().default("en"),
    district: z.string().min(2, "District is required"),
});

const updatePhoneSchema = z.object({
    phone: z.string().min(10).max(20),
    newPhone: z.string().min(10).max(20).optional(),
    channels: z.array(z.enum(["sms", "whatsapp"])).optional(),
    language: z.string().optional(),
    district: z.string().optional(),
    is_active: z.boolean().optional(),
});

const deletePhoneSchema = z.object({
    phone: z.string().min(10).max(20).optional(),
});

function formatPhoneNumber(phone: string): string {
    let cleaned = phone.trim().replace(/[\s\-\(\)]/g, "");
    if (/^\d{10}$/.test(cleaned)) {
        return `+91${cleaned}`;
    }
    if (/^\+/.test(cleaned)) {
        return cleaned;
    }
    if (/^91\d{10}$/.test(cleaned)) {
        return `+${cleaned}`;
    }
    return cleaned;
}

// Local in-memory fallback store for development when Supabase is offline
interface InMemorySubscriber {
    id: string;
    user_id: string | null;
    phone: string;
    channels: ("sms" | "whatsapp")[];
    language: string;
    district: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// Global flag to track Supabase offline status and skip connection retries instantly
// (Live view of dbConfig.isSupabaseOffline is read directly inside request handlers)
const memorySubscribers = new Map<string, InMemorySubscriber>();

router.get("/status", optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
        const phone = req.query.phone ? formatPhoneNumber(req.query.phone as string) : undefined;
        let query = supabase.from("notification_subscribers").select("*");

        if (req.user) {
            query = query.eq("user_id", req.user.id);
        } else if (phone) {
            query = query.eq("phone", phone);
        } else {
            res.json({ registered: false });
            return;
        }

        let subscriber = null;
        let dbFailed = dbConfig?.isSupabaseOffline;

        if (!dbFailed) {
            try {
                const { data, error } = await query.maybeSingle();
                if (error) {
                    dbFailed = true;
                    if (
                        error.message?.includes("fetch failed") ||
                        error.message?.includes("refused") ||
                        error.message?.includes("timeout")
                    ) {
                        if (dbConfig) dbConfig.isSupabaseOffline = true;
                    }
                } else {
                    subscriber = data;
                }
            } catch (dbError: any) {
                dbFailed = true;
                const msg = dbError?.message || String(dbError);
                if (
                    msg.includes("fetch failed") ||
                    msg.includes("refused") ||
                    msg.includes("timeout")
                ) {
                    if (dbConfig) dbConfig.isSupabaseOffline = true;
                }
            }
        }

        if (dbFailed) {
            logger.warn(
                "Supabase database is offline. Falling back to in-memory subscription store."
            );
            if (req.user) {
                subscriber = Array.from(memorySubscribers.values()).find(
                    (s) => s.user_id === req.user!.id
                );
            } else if (phone) {
                subscriber = memorySubscribers.get(phone);
            }
        }

        if (!subscriber) {
            res.json({ registered: false });
            return;
        }

        res.json({ registered: true, subscriber });
    } catch (err) {
        logger.error({ message: "Error in /status endpoint", error: err });
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/register", optionalAuth, async (req: AuthenticatedRequest, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid registration payload",
            issues: parsed.error.issues,
        });
        return;
    }

    const { phone, channels, language, district } = parsed.data;
    const formattedPhone = formatPhoneNumber(phone);

    try {
        let existing = null;
        let dbFailed = dbConfig?.isSupabaseOffline;

        if (!dbFailed) {
            try {
                const { data, error: findError } = await supabase
                    .from("notification_subscribers")
                    .select("*")
                    .eq("phone", formattedPhone)
                    .maybeSingle();

                if (findError) {
                    dbFailed = true;
                    if (
                        findError.message?.includes("fetch failed") ||
                        findError.message?.includes("refused") ||
                        findError.message?.includes("timeout")
                    ) {
                        if (dbConfig) dbConfig.isSupabaseOffline = true;
                    }
                } else {
                    existing = data;
                }
            } catch (dbError: any) {
                dbFailed = true;
                const msg = dbError?.message || String(dbError);
                if (
                    msg.includes("fetch failed") ||
                    msg.includes("refused") ||
                    msg.includes("timeout")
                ) {
                    if (dbConfig) dbConfig.isSupabaseOffline = true;
                }
            }
        }

        let result;
        if (dbFailed) {
            logger.warn("Supabase database is offline. Registering subscriber in-memory.");
            existing = memorySubscribers.get(formattedPhone);

            if (existing) {
                existing.user_id = req.user?.id || existing.user_id;
                existing.channels = channels;
                existing.language = language;
                existing.district = district;
                existing.is_active = true;
                existing.updated_at = new Date().toISOString();
                result = existing;
            } else {
                result = {
                    id: `mem-${Date.now()}`,
                    user_id: req.user?.id || null,
                    phone: formattedPhone,
                    channels,
                    language,
                    district,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
                memorySubscribers.set(formattedPhone, result);
            }
        } else {
            if (existing) {
                const { data: updated, error: updateError } = await supabase
                    .from("notification_subscribers")
                    .update({
                        user_id: req.user?.id || existing.user_id,
                        channels,
                        language,
                        district,
                        is_active: true,
                    })
                    .eq("id", existing.id)
                    .select()
                    .single();

                if (updateError) {
                    logger.error({ message: "Failed to update subscriber", error: updateError });
                    res.status(500).json({ error: "Database error" });
                    return;
                }
                result = updated;
            } else {
                const { data: created, error: insertError } = await supabase
                    .from("notification_subscribers")
                    .insert({
                        user_id: req.user?.id || null,
                        phone: formattedPhone,
                        channels,
                        language,
                        district,
                        is_active: true,
                    })
                    .select()
                    .single();

                if (insertError) {
                    logger.error({ message: "Failed to insert subscriber", error: insertError });
                    res.status(500).json({ error: "Database error" });
                    return;
                }
                result = created;
            }
        }

        res.status(201).json({ success: true, subscriber: result });
    } catch (err) {
        logger.error({ message: "Error in /register endpoint", error: err });
        res.status(500).json({ error: "Internal server error" });
    }
});

router.patch("/phone", optionalAuth, async (req: AuthenticatedRequest, res) => {
    const parsed = updatePhoneSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid patch payload", issues: parsed.error.issues });
        return;
    }

    const { phone, newPhone, channels, language, district, is_active } = parsed.data;
    const formattedPhone = formatPhoneNumber(phone);
    const formattedNewPhone = newPhone ? formatPhoneNumber(newPhone) : undefined;

    try {
        let data = null;
        let dbFailed = dbConfig?.isSupabaseOffline;

        if (!dbFailed) {
            try {
                let query = supabase.from("notification_subscribers").update({
                    phone: formattedNewPhone,
                    channels,
                    language,
                    district,
                    is_active,
                });

                if (req.user) {
                    query = query.eq("user_id", req.user.id);
                } else {
                    query = query.eq("phone", formattedPhone);
                }

                const { data: dbData, error } = await query.select();
                if (error) {
                    dbFailed = true;
                    if (
                        error.message?.includes("fetch failed") ||
                        error.message?.includes("refused") ||
                        error.message?.includes("timeout")
                    ) {
                        if (dbConfig) dbConfig.isSupabaseOffline = true;
                    }
                } else {
                    data = dbData;
                }
            } catch (dbError: any) {
                dbFailed = true;
                const msg = dbError?.message || String(dbError);
                if (
                    msg.includes("fetch failed") ||
                    msg.includes("refused") ||
                    msg.includes("timeout")
                ) {
                    if (dbConfig) dbConfig.isSupabaseOffline = true;
                }
            }
        }

        if (dbFailed) {
            logger.warn("Supabase database is offline. Updating subscriber in-memory.");
            let sub = req.user
                ? Array.from(memorySubscribers.values()).find((s) => s.user_id === req.user!.id)
                : memorySubscribers.get(formattedPhone);

            if (sub) {
                if (formattedNewPhone) {
                    memorySubscribers.delete(sub.phone);
                    sub.phone = formattedNewPhone;
                    memorySubscribers.set(formattedNewPhone, sub);
                }
                if (channels) sub.channels = channels;
                if (language) sub.language = language;
                if (district) sub.district = district;
                if (is_active !== undefined) sub.is_active = is_active;
                sub.updated_at = new Date().toISOString();
                data = [sub];
            } else {
                data = [];
            }
        }

        if (!data || data.length === 0) {
            res.status(404).json({ error: "Subscriber not found" });
            return;
        }

        res.json({ success: true, subscriber: data[0] });
    } catch (err) {
        logger.error({ message: "Error in /phone update endpoint", error: err });
        res.status(500).json({ error: "Internal server error" });
    }
});

router.delete("/phone", optionalAuth, async (req: AuthenticatedRequest, res) => {
    const parsed = deletePhoneSchema.safeParse(req.body);
    const phone =
        parsed.success && parsed.data.phone ? formatPhoneNumber(parsed.data.phone) : undefined;

    try {
        let data = null;
        let dbFailed = dbConfig?.isSupabaseOffline;

        if (!dbFailed) {
            try {
                let query = supabase.from("notification_subscribers").delete();

                if (req.user) {
                    query = query.eq("user_id", req.user.id);
                } else if (phone) {
                    query = query.eq("phone", phone);
                } else {
                    res.status(400).json({ error: "Phone number is required for guest opt-out" });
                    return;
                }

                const { data: dbData, error } = await query.select();
                if (error) {
                    dbFailed = true;
                    if (
                        error.message?.includes("fetch failed") ||
                        error.message?.includes("refused") ||
                        error.message?.includes("timeout")
                    ) {
                        if (dbConfig) dbConfig.isSupabaseOffline = true;
                    }
                } else {
                    data = dbData;
                }
            } catch (dbError: any) {
                dbFailed = true;
                const msg = dbError?.message || String(dbError);
                if (
                    msg.includes("fetch failed") ||
                    msg.includes("refused") ||
                    msg.includes("timeout")
                ) {
                    if (dbConfig) dbConfig.isSupabaseOffline = true;
                }
            }
        }

        if (dbFailed) {
            logger.warn("Supabase database is offline. Deleting subscriber in-memory.");
            let sub = req.user
                ? Array.from(memorySubscribers.values()).find((s) => s.user_id === req.user!.id)
                : phone
                  ? memorySubscribers.get(phone)
                  : undefined;

            if (sub) {
                memorySubscribers.delete(sub.phone);
                data = [sub];
            } else {
                data = [];
            }
        }

        if (!data || data.length === 0) {
            res.status(404).json({ error: "Subscriber not found" });
            return;
        }

        res.json({ success: true, message: "Unsubscribed successfully" });
    } catch (err) {
        logger.error({ message: "Error in delete /phone endpoint", error: err });
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/broadcast", requireAuth, requireRole("admin"), async (req, res) => {
    const broadcastSchema = z.object({
        district: z.string().optional(),
        title: z.string().min(2),
        message: z.string().min(5),
        severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    });

    const parsed = broadcastSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid broadcast payload", issues: parsed.error.issues });
        return;
    }

    const { district, title, message } = parsed.data;

    try {
        let sentCount = 0;
        let totalProcessed = 0;
        let hasMore = true;
        const BATCH_SIZE = 500;
        const CONCURRENCY_LIMIT = 50;
        const fullMessage = `${title}\n\n${message}`;

        while (hasMore) {
            let query = supabase
                .from("notification_subscribers")
                .select("*")
                .eq("is_active", true)
                .order("id")
                .range(totalProcessed, totalProcessed + BATCH_SIZE - 1);

            if (district && district.toLowerCase() !== "all") {
                query = query.ilike("district", district);
            }

            const { data: subscribers, error } = await query;

            if (error) {
                logger.error({ message: "Failed to fetch subscribers for broadcast", error });
                res.status(500).json({ error: "Database error" });
                return;
            }

            if (!subscribers || subscribers.length === 0) {
                hasMore = false;
                break;
            }

            for (let i = 0; i < subscribers.length; i += CONCURRENCY_LIMIT) {
                const chunk = subscribers.slice(i, i + CONCURRENCY_LIMIT);

                const chunkResults = await Promise.allSettled(
                    chunk.map(async (sub) => {
                        const subPromises: Promise<boolean>[] = [];
                        if (sub.channels.includes("sms")) {
                            subPromises.push(smsService.send(sub.phone, fullMessage, sub.language));
                        }
                        if (sub.channels.includes("whatsapp")) {
                            subPromises.push(
                                whatsappService.send(sub.phone, fullMessage, sub.language)
                            );
                        }
                        if (subPromises.length === 0) return false;
                        const res = await Promise.allSettled(subPromises);
                        return res.some((r) => r.status === "fulfilled" && r.value === true);
                    })
                );

                sentCount += chunkResults.filter(
                    (r) => r.status === "fulfilled" && r.value === true
                ).length;
            }

            totalProcessed += subscribers.length;
            if (subscribers.length < BATCH_SIZE) {
                hasMore = false;
            }
        }

        if (totalProcessed === 0) {
            res.json({
                success: true,
                sentCount: 0,
                message: "No subscribers found matching criteria",
            });
            return;
        }

        res.json({ success: true, sentCount, message: `Broadcasted to ${sentCount} subscribers` });
    } catch (err) {
        logger.error({ message: "Error in /broadcast endpoint", error: err });
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post(
    "/twilio-webhook",
    express.urlencoded({ extended: true }),
    verifyTwilioSignature,
    async (req, res) => {
        const from = req.body.From;
        const body = req.body.Body ? req.body.Body.trim().toUpperCase() : "";

        if (!from) {
            res.status(400).send("Missing From parameter");
            return;
        }

        const formattedFrom = formatPhoneNumber(from);

        try {
            let replyMessage = "";

            if (["STOP", "UNSUBSCRIBE", "QUIT", "CANCEL"].includes(body)) {
                const { error } = await supabase
                    .from("notification_subscribers")
                    .update({ is_active: false })
                    .eq("phone", formattedFrom);

                if (error) {
                    logger.error({
                        message: "Failed to opt-out via Twilio STOP",
                        error,
                        phone: formattedFrom,
                    });
                    res.status(500).send("Database error");
                    return;
                }

                replyMessage =
                    "You have been unsubscribed from SahiDawa alerts. Reply START to subscribe again.";
            } else if (["START", "SUBSCRIBE", "UNSTOP"].includes(body)) {
                const { error } = await supabase
                    .from("notification_subscribers")
                    .update({ is_active: true })
                    .eq("phone", formattedFrom);

                if (error) {
                    logger.error({
                        message: "Failed to opt-in via Twilio START",
                        error,
                        phone: formattedFrom,
                    });
                    res.status(500).send("Database error");
                    return;
                }

                replyMessage =
                    "Welcome back to SahiDawa alerts! You will receive critical safety alerts for your district.";
            } else {
                replyMessage =
                    "SahiDawa Alerts: Reply STOP to unsubscribe, or START to receive safety alerts.";
            }

            res.setHeader("Content-Type", "text/xml");
            res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${replyMessage}</Message>
</Response>`);
        } catch (err) {
            logger.error({ message: "Error in Twilio webhook", error: err });
            res.status(500).send("Internal server error");
        }
    }
);

export default router;
