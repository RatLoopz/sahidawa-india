import express, { Router } from "express";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { requireAuth, requireRole, optionalAuth, AuthenticatedRequest } from "../middleware/auth";
import { notificationRegisterLimiter, authTargetLimiter, limiter } from "../middleware/rateLimit";
import { cacheMiddleware } from "../middleware/cache";
import { verifyTwilioSignature } from "../middleware/twilioSignature";
import { supabase, dbConfig } from "../db/client";
import { smsService } from "../services/sms-service";
import { whatsappService } from "../services/whatsapp-service";
import { memorySubscriberStore, InMemorySubscriber } from "../services/memorySubscriberStore";
import { otpStore } from "../services/otpStore";
import { formatPhoneNumber, maskPhone } from "../utils/phone";
import { escapeIlike } from "@sahidawa/shared";
import logger from "../utils/logger";
import { redisClient } from "../utils/redis";
import { signGuestToken, verifyGuestPhone, isGuestTokenConfigured } from "../utils/guestToken";
import { safeCompare } from "../utils/cryptoUtils";
import { markOfflineOnConnectionError, withDbFallback } from "../utils/withDbFallback";
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

// ── OTP brute-force protection ─────────────────────────────────────────────────
// Tracks failed OTP verification attempts per phone number using Redis.
// Implements exponential backoff: lockout duration doubles with each failure.
const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCKOUT_BASE_MS = 5 * 60 * 1000; // 5 minutes

function getOtpFailKey(phone: string): string {
    return `otp_fails:${phone}`;
}

function getOtpLockoutKey(phone: string): string {
    return `otp_lockout:${phone}`;
}

function getOtpLockoutDuration(attempts: number): number {
    return Math.min(OTP_LOCKOUT_BASE_MS * Math.pow(2, attempts - 1), 4 * 60 * 60 * 1000); // cap at 4 hours
}

async function checkOtpLockout(phone: string): Promise<number | null> {
    if (!redisClient.isOpen) return null;
    try {
        const ttl = await redisClient.ttl(getOtpLockoutKey(phone));
        if (ttl > 0) return ttl;
    } catch (err) {
        logger.warn({
            message: "Redis TTL check error in OTP lockout",
            error: String(err),
        });
    }
    return null;
}

async function recordFailedOtpAttempt(phone: string): Promise<void> {
    if (!redisClient.isOpen) return;
    try {
        const key = getOtpFailKey(phone);
        const attempts = await redisClient.incr(key);
        if (attempts === 1) {
            await redisClient.expire(key, 600);
        }
        if (attempts >= MAX_OTP_ATTEMPTS) {
            const lockDuration = getOtpLockoutDuration(attempts);
            await redisClient.setEx(getOtpLockoutKey(phone), Math.ceil(lockDuration / 1000), "1");
            await redisClient.del(key);
        }
    } catch (err) {
        logger.warn({
            message: "Redis error recording failed OTP attempt",
            error: String(err),
        });
    }
}

async function clearOtpAttempts(phone: string): Promise<void> {
    if (!redisClient.isOpen) return;
    try {
        await redisClient.del(getOtpFailKey(phone));
        await redisClient.del(getOtpLockoutKey(phone));
    } catch (err) {
        logger.warn({
            message: "Redis error clearing OTP attempts",
            error: String(err),
        });
    }
}

// ── Web Push Notifications (Existing) ──────────────────────────────────────────

const unsubscribeSchema = z
    .object({
        endpoint: z.string().url(),
    })
    .strict();

router.get("/vapid-public-key", limiter, cacheMiddleware(3600, 7200), (_req, res) => {
    const publicKey = getVapidPublicKey();
    res.json({
        publicKey,
        configured: isWebPushConfigured(),
    });
});

router.post("/subscriptions", limiter, requireAuth, async (req: AuthenticatedRequest, res) => {
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

router.delete("/subscriptions", limiter, requireAuth, async (req: AuthenticatedRequest, res) => {
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

const registerSchema = z
    .object({
        phone: z.string().min(10, "Phone number too short").max(20, "Phone number too long"),
        channels: z.array(z.enum(["sms", "whatsapp"])).min(1, "At least one channel is required"),
        language: z.string().default("en"),
        district: z.string().min(2, "District is required"),
    })
    .strict();

const updatePhoneSchema = z
    .object({
        phone: z.string().min(10).max(20),
        newPhone: z.string().min(10).max(20).optional(),
        channels: z.array(z.enum(["sms", "whatsapp"])).optional(),
        language: z.string().optional(),
        district: z.string().optional(),
        is_active: z.boolean().optional(),
    })
    .strict();

export function escapeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

const twilioWebhookSchema = z.object({
    From: z
        .string()
        .min(10, "From number too short")
        .max(20, "From number too long")
        .regex(/^\+?\d+$/, "From must contain only digits and an optional leading +"),
    Body: z.string().optional(),
});

// The only subscriber fields any client is allowed to receive. Everything else on
// a row is either a secret (otp_store) or account-linkage
// PII (user_id) and must never be serialized into a response. Returning the raw
// row from /status let an unauthenticated caller read another subscriber's OTP and
// Supabase user_id just by knowing their phone number, so every subscriber we hand
// back — from the DB or the in-memory fallback — goes through this projection.
type PublicSubscriber = Pick<
    InMemorySubscriber,
    "phone" | "channels" | "language" | "district" | "is_active"
>;

function toPublicSubscriber(sub: PublicSubscriber): PublicSubscriber {
    return {
        phone: sub.phone,
        channels: sub.channels,
        language: sub.language,
        district: sub.district,
        is_active: sub.is_active,
    };
}

// Guests carry their proof-of-ownership token in a dedicated header rather than
// Authorization: Bearer. optionalAuth runs first and validates any Bearer token
// against Supabase, so a guest JWT in that header would be rejected with a 401
// before the handler ever runs. A separate header keeps the two schemes apart.
const GUEST_TOKEN_HEADER = "x-guest-token";

function getGuestToken(req: AuthenticatedRequest): string | undefined {
    const header = req.headers[GUEST_TOKEN_HEADER];
    return typeof header === "string" ? header : undefined;
}

// ── Pending phone-change state (authenticated users) ───────────────────────────
// When an authenticated user requests a phone number change, we don't write it
// immediately. Instead we generate an OTP, send it to the new number, and store
// the pending change in Redis.  Only after the user presents a valid OTP through
// POST /verify-otp do we apply the change.
const PENDING_PHONE_CHANGE_PREFIX = "pending_phone_change:";
const PENDING_PHONE_CHANGE_TTL_SECONDS = 10 * 60; // 10 minutes

interface PendingPhoneChange {
    userId: string;
    oldPhone: string;
    newPhone: string;
    expiresAt: string;
}

function getPendingPhoneChangeKey(userId: string): string {
    return `${PENDING_PHONE_CHANGE_PREFIX}${userId}`;
}

async function storePendingPhoneChange(
    userId: string,
    oldPhone: string,
    newPhone: string
): Promise<void> {
    const data: PendingPhoneChange = {
        userId,
        oldPhone,
        newPhone,
        expiresAt: new Date(Date.now() + PENDING_PHONE_CHANGE_TTL_SECONDS * 1000).toISOString(),
    };
    if (redisClient.isOpen) {
        try {
            await redisClient.setEx(
                getPendingPhoneChangeKey(userId),
                PENDING_PHONE_CHANGE_TTL_SECONDS,
                JSON.stringify(data)
            );
        } catch (err) {
            logger.warn({
                message: "Redis error storing pending phone change",
                error: String(err),
            });
        }
    }
}

async function getPendingPhoneChange(userId: string): Promise<PendingPhoneChange | null> {
    if (!redisClient.isOpen) return null;
    try {
        const raw = await redisClient.get(getPendingPhoneChangeKey(userId));
        if (!raw) return null;
        const data: PendingPhoneChange = JSON.parse(raw);
        if (new Date(data.expiresAt) < new Date()) {
            await clearPendingPhoneChange(userId);
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

async function clearPendingPhoneChange(userId: string): Promise<void> {
    if (!redisClient.isOpen) return;
    try {
        await redisClient.del(getPendingPhoneChangeKey(userId));
    } catch (err) {
        logger.warn("Failed to clear pending phone change", { err, userId });
    }
}

router.get("/status", limiter, optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
        // Guests have no account, so they prove ownership of the number with a
        // token minted at OTP verification. A bare ?phone= is no longer trusted,
        // which stops one guest from reading another's subscription just by
        // knowing their number.
        let guestPhone: string | undefined;
        const client = req.supabase || supabase;
        if (!req.user) {
            const verified = verifyGuestPhone(getGuestToken(req));
            if (!verified) {
                res.status(401).json({
                    error: "A valid guest token is required to check status without signing in.",
                });
                return;
            }
            guestPhone = verified;
        }

        let query = client
            .from("notification_subscribers")
            .select("phone, channels, language, district, is_active");

        if (req.user) {
            query = query.eq("user_id", req.user.id);
        } else {
            query = query.eq("phone", guestPhone!);
        }

        let subscriber = null;

        subscriber = await withDbFallback(
            async () => {
                const { data, error } = await query.maybeSingle();
                if (error) {
                    markOfflineOnConnectionError(error);
                    throw error;
                }
                return data;
            },
            () => {
                logger.warn(
                    "Supabase database is offline. Falling back to in-memory subscription store."
                );
                if (req.user) {
                    return memorySubscriberStore.find((s) => s.user_id === req.user!.id) ?? null;
                }
                return memorySubscriberStore.get(guestPhone!) ?? null;
            }
        );

        if (!subscriber) {
            res.json({ registered: false });
            return;
        }

        res.json({ registered: true, subscriber: toPublicSubscriber(subscriber) });
    } catch (err) {
        logger.error({ message: "Error in /status endpoint", error: err });
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post(
    "/register",
    notificationRegisterLimiter,
    authTargetLimiter,
    optionalAuth,
    async (req: AuthenticatedRequest, res) => {
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
        if (!formattedPhone) {
            res.status(400).json({ error: "Invalid phone number format" });
            return;
        }

        const isOwner =
            req.user &&
            (req.user.raw?.phone === formattedPhone ||
                req.user.raw?.user_metadata?.phone === formattedPhone);

        // /register runs under optionalAuth and finds the row by phone number
        // alone, so "this number already exists" tells us nothing about who is
        // asking. Rewriting the row is only allowed for a caller who has proven
        // a claim to it: a session whose own verified number this is, a guest
        // holding a token minted for this number, or a session the row is
        // already linked to (that account can already read and edit it through
        // /status and PATCH /phone). Everyone else gets an OTP and nothing
        // more. See #3956, where an unauthenticated caller could knock a
        // verified subscriber back to "pending" and out of the admin broadcast.
        const guestTokenPhone = verifyGuestPhone(getGuestToken(req));
        const provedThisNumber = Boolean(isOwner) || guestTokenPhone === formattedPhone;
        const mayEditExisting = (row: { user_id?: string | null }): boolean =>
            provedThisNumber || (req.user != null && row.user_id === req.user.id);

        const targetStatus = isOwner ? "active" : "pending";
        const otp = isOwner ? null : randomInt(100000, 1000000).toString();
        const otpExpires = isOwner ? null : new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const client = req.supabase || supabase;

        try {
            let existing = null;
            let dbFailed = dbConfig?.isSupabaseOffline;

            if (!dbFailed) {
                try {
                    const { data, error: findError } = await client
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
                            if (dbConfig) dbConfig.setOffline();
                        }
                    } else {
                        existing = data;
                    }
                } catch (dbError: unknown) {
                    dbFailed = true;
                    const msg = dbError instanceof Error ? dbError.message : String(dbError);
                    if (
                        msg.includes("fetch failed") ||
                        msg.includes("refused") ||
                        msg.includes("timeout")
                    ) {
                        if (dbConfig) dbConfig.setOffline();
                    }
                }
            }

            // True when the requested settings were withheld pending verification,
            // which changes the response the client gets. The only thing written
            // to the row in that case is the OTP challenge that lets whoever
            // actually holds the number claim it.
            let heldForVerification = false;

            let result;
            if (dbFailed) {
                logger.warn("Supabase database is offline. Registering subscriber in-memory.");
                existing = memorySubscriberStore.get(formattedPhone);

                if (existing && !mayEditExisting(existing)) {
                    if (otp && otpExpires) {
                        await otpStore.store(formattedPhone, otp, otpExpires);
                    }
                    heldForVerification = true;
                } else if (existing) {
                    existing.user_id = req.user?.id || existing.user_id;
                    existing.channels = channels;
                    existing.language = language;
                    existing.district = district;
                    existing.is_active = true;
                    if (!isOwner && otp && otpExpires) {
                        existing.status = "pending";
                        await otpStore.store(formattedPhone, otp, otpExpires);
                    } else {
                        existing.status = "active";
                    }
                    existing.updated_at = new Date().toISOString();
                    result = existing;
                } else {
                    if (!isOwner && otp && otpExpires) {
                        await otpStore.store(formattedPhone, otp, otpExpires);
                    }
                    result = {
                        id: `mem-${Date.now()}`,
                        user_id: req.user?.id || null,
                        phone: formattedPhone,
                        channels,
                        language,
                        district,
                        is_active: true,
                        status: targetStatus,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    };
                    memorySubscriberStore.set(formattedPhone, result);
                }
            } else if (existing && !mayEditExisting(existing)) {
                // Hold the requested settings back. The row keeps its status,
                // district, language, channels and user_id, so the subscriber
                // stays in the broadcast audience for their own district while
                // the challenge is outstanding.
                if (!isOwner && otp && otpExpires) {
                    await otpStore.store(formattedPhone, otp, otpExpires);
                }
                heldForVerification = true;
            } else if (existing) {
                // user_id only moves for a caller who proved this number is
                // theirs, which is what linking an existing number to an
                // account is supposed to require.
                const updatePayload: any = {
                    user_id: req.user?.id || existing.user_id,
                    channels,
                    language,
                    district,
                    is_active: true,
                };
                if (!isOwner) {
                    updatePayload.status = "pending";
                    if (otp && otpExpires) {
                        await otpStore.store(formattedPhone, otp, otpExpires);
                    }
                } else {
                    updatePayload.status = "active";
                }

                const { data: updated, error: updateError } = await client
                    .from("notification_subscribers")
                    .update(updatePayload)
                    .eq("id", existing.id)
                    .select()
                    .single();

                if (updateError) {
                    logger.error({
                        message: "Failed to update subscriber",
                        error: updateError,
                    });
                    res.status(500).json({ error: "Database error" });
                    return;
                }
                result = updated;
            } else {
                if (!isOwner && otp && otpExpires) {
                    await otpStore.store(formattedPhone, otp, otpExpires);
                }
                const { data: created, error: insertError } = await client
                    .from("notification_subscribers")
                    .insert({
                        user_id: req.user?.id || null,
                        phone: formattedPhone,
                        channels,
                        language,
                        district,
                        is_active: true,
                        status: targetStatus,
                    })
                    .select()
                    .single();

                if (insertError) {
                    logger.error({
                        message: "Failed to insert subscriber",
                        error: insertError,
                    });
                    res.status(500).json({ error: "Database error" });
                    return;
                }
                result = created;
            }

            if (!isOwner && otp) {
                const sends: Promise<unknown>[] = [];
                if (channels.includes("sms")) {
                    sends.push(
                        smsService
                            .sendOtp(formattedPhone, otp, language)
                            .catch((e) => logger.error("SMS failed", e))
                    );
                }
                if (channels.includes("whatsapp")) {
                    sends.push(
                        whatsappService
                            .sendOtp(formattedPhone, otp, language)
                            .catch((e) => logger.error("WhatsApp failed", e))
                    );
                }
                await Promise.allSettled(sends);
            }

            if (heldForVerification) {
                // No subscriber object here: the caller hasn't proven the number,
                // so reading the stored row back to them would hand out the very
                // settings this branch exists to protect.
                res.status(202).json({
                    success: true,
                    preferencesApplied: false,
                    verificationRequired: true,
                    phone: formattedPhone,
                    message:
                        "Verify the code sent to this number, then apply your alert preferences with PATCH /api/notifications/phone.",
                });
                return;
            }

            res.status(201).json({
                success: true,
                preferencesApplied: true,
                subscriber: toPublicSubscriber(result),
            });
        } catch (err) {
            logger.error({ message: "Error in /register endpoint", error: err });
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

const verifyOtpSchema = z
    .object({
        phone: z.string().min(10, "Phone number too short").max(20, "Phone number too long"),
        otp: z.string().length(6, "OTP must be exactly 6 digits"),
    })
    .strict();

router.post(
    "/verify-otp",
    authTargetLimiter,
    optionalAuth,
    async (req: AuthenticatedRequest, res) => {
        const parsed = verifyOtpSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
            return;
        }

        const { phone, otp } = parsed.data;
        const formattedPhone = formatPhoneNumber(phone);
        if (!formattedPhone) {
            res.status(400).json({ error: "Invalid phone number format" });
            return;
        }

        const lockoutTtl = await checkOtpLockout(formattedPhone);
        if (lockoutTtl !== null) {
            res.status(429).json({
                error: "Too many failed OTP attempts. Please try again later.",
                retryAfterSeconds: lockoutTtl,
            });
            return;
        }

        try {
            let dbFailed = dbConfig?.isSupabaseOffline;
            let subscriber = null;
            const client = req.supabase || supabase;

            if (!dbFailed) {
                try {
                    const { data, error } = await client
                        .from("notification_subscribers")
                        .select("*")
                        .eq("phone", formattedPhone)
                        .maybeSingle();

                    if (error) {
                        dbFailed = true;
                        if (
                            error.message?.includes("fetch failed") ||
                            error.message?.includes("refused") ||
                            error.message?.includes("timeout")
                        ) {
                            if (dbConfig) dbConfig.setOffline();
                        }
                    } else {
                        subscriber = data;
                    }
                } catch (dbError: unknown) {
                    dbFailed = true;
                    const msg = dbError instanceof Error ? dbError.message : String(dbError);
                    if (
                        msg.includes("fetch failed") ||
                        msg.includes("refused") ||
                        msg.includes("timeout")
                    ) {
                        if (dbConfig) dbConfig.setOffline();
                    }
                }
            }

            if (dbFailed) {
                subscriber = memorySubscriberStore.get(formattedPhone);
            }

            if (!subscriber) {
                res.status(404).json({ error: "Subscriber not found" });
                return;
            }

            // An active row can still carry an outstanding challenge: /register
            // now issues one without demoting the row when the caller hasn't
            // proven the number (#3956). Since PR #3928 OTPs are stored in
            // otpStore (Redis/in-memory), not in the subscriber DB row. We ask
            // otpStore whether a challenge is outstanding for this number; if
            // there is none AND the subscriber is already active, the caller
            // has nothing to prove and we return early without consuming a token.
            const hasPendingChallenge = await otpStore.hasPending(formattedPhone);
            if (subscriber.status === "active" && !hasPendingChallenge) {
                res.json({ success: true, message: "Phone is already verified and active" });
                return;
            }

            const isValid = await otpStore.verify(formattedPhone, otp);
            if (!isValid) {
                await recordFailedOtpAttempt(formattedPhone);
                res.status(400).json({ error: "Invalid or expired OTP" });
                return;
            }

            await clearOtpAttempts(formattedPhone);
            await otpStore.clear(formattedPhone);

            // Check if this OTP verification is for a pending phone change
            // (authenticated user changing their notification phone number).
            if (req.user) {
                const pendingChange = await getPendingPhoneChange(req.user.id);
                if (pendingChange && pendingChange.newPhone === formattedPhone) {
                    await clearPendingPhoneChange(req.user.id);

                    if (!dbFailed) {
                        const { error: updateError } = await client
                            .from("notification_subscribers")
                            .update({ phone: formattedPhone })
                            .eq("user_id", req.user.id);

                        if (updateError) {
                            logger.error({
                                message: "Failed to update phone number",
                                error: updateError,
                            });
                            res.status(500).json({ error: "Database error" });
                            return;
                        }
                    } else {
                        const sub = memorySubscriberStore.find((s) => s.user_id === req.user!.id);
                        if (sub) {
                            memorySubscriberStore.delete(sub.phone);
                            sub.phone = formattedPhone;
                            memorySubscriberStore.set(formattedPhone, sub);
                            sub.updated_at = new Date().toISOString();
                        }
                    }

                    res.json({ success: true, message: "Phone number changed successfully" });
                    return;
                }
            }

            if (!dbFailed) {
                const { error: updateError } = await client
                    .from("notification_subscribers")
                    .update({ status: "active" })
                    .eq("id", subscriber.id);

                if (updateError) {
                    logger.error({ message: "Failed to activate subscriber", error: updateError });
                    res.status(500).json({ error: "Database error" });
                    return;
                }
            } else {
                subscriber.status = "active";
                subscriber.updated_at = new Date().toISOString();
            }

            // The OTP matched, so the caller has proven control of this number. Mint
            // a short-lived token they can present to the guest read/write endpoints
            // instead of a bare phone number. Only this success path issues a token —
            // the "already active" short-circuit above never verifies an OTP, so it
            // must not hand one out.
            const responseBody: { success: true; message: string; guestToken?: string } = {
                success: true,
                message: "Phone verified successfully",
            };
            if (isGuestTokenConfigured()) {
                responseBody.guestToken = signGuestToken(formattedPhone);
            } else {
                logger.error(
                    "JWT_SECRET is not set; a verified guest cannot be issued a session token."
                );
            }

            res.json(responseBody);
        } catch (err) {
            logger.error({ message: "Error in /verify-otp endpoint", error: err });
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

router.patch(
    "/phone",
    notificationRegisterLimiter,
    optionalAuth,
    async (req: AuthenticatedRequest, res) => {
        const parsed = updatePhoneSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Invalid patch payload", issues: parsed.error.issues });
            return;
        }

        const { phone, newPhone, channels, language, district, is_active } = parsed.data;
        const formattedPhone = formatPhoneNumber(phone);
        if (!formattedPhone) {
            res.status(400).json({ error: "Invalid phone number format" });
            return;
        }
        let formattedNewPhone: string | undefined = undefined;
        if (newPhone) {
            const fNew = formatPhoneNumber(newPhone);
            if (!fNew) {
                res.status(400).json({ error: "Invalid new phone number format" });
                return;
            }
            formattedNewPhone = fNew;
        }

        // Resolve who is making the change: a signed-in user (scoped by user_id)
        // or a guest who proved ownership of their number with a token (scoped by
        // that number). Neither guests nor authenticated users may move their
        // subscription to a different number without proving ownership of the
        // new number via OTP.
        let guestPhone: string | undefined;
        if (!req.user) {
            const verified = verifyGuestPhone(getGuestToken(req));
            if (!verified) {
                res.status(401).json({
                    error: "A valid guest token is required to update settings without signing in.",
                });
                return;
            }
            if (formattedNewPhone) {
                res.status(400).json({
                    error: "Changing your number requires verifying the new number first.",
                });
                return;
            }
            guestPhone = verified;
        }

        // Authenticated users who want to change their phone number must verify
        // ownership of the new number via OTP. Generate the OTP, send it, store
        // the pending change, and return the current subscriber state. The actual
        // phone update happens only after the user presents the OTP through
        // POST /verify-otp. The response is 200 (not 202) to preserve backward
        // compatibility with existing clients that expect subscriber in the body.
        if (req.user && formattedNewPhone) {
            let currentSubscriber = null;
            const client = req.supabase || supabase;
            if (!dbConfig?.isSupabaseOffline) {
                try {
                    const { data } = await client
                        .from("notification_subscribers")
                        .select("phone, channels, language, district, is_active")
                        .eq("user_id", req.user.id)
                        .maybeSingle();
                    currentSubscriber = data;
                } catch (err) {
                    logger.warn("Failed to load notification subscriber", { err });
                }
            }
            if (!currentSubscriber) {
                currentSubscriber = memorySubscriberStore.find((s) => s.user_id === req.user!.id);
            }

            if (!currentSubscriber) {
                res.status(404).json({ error: "Subscriber not found" });
                return;
            }

            if (formattedNewPhone === currentSubscriber.phone) {
                res.status(400).json({ error: "New phone number is the same as the current one." });
                return;
            }

            const otp = randomInt(100000, 1000000).toString();
            const otpExpires = new Date(
                Date.now() + PENDING_PHONE_CHANGE_TTL_SECONDS * 1000
            ).toISOString();

            await otpStore.store(formattedNewPhone, otp, otpExpires);
            await storePendingPhoneChange(req.user.id, currentSubscriber.phone, formattedNewPhone);

            const sends: Promise<unknown>[] = [];
            const channelsForOtp =
                channels ?? (currentSubscriber.channels as ("sms" | "whatsapp")[]);
            if (channelsForOtp.includes("sms")) {
                sends.push(
                    smsService
                        .sendOtp(
                            formattedNewPhone,
                            otp,
                            language ?? (currentSubscriber.language as string)
                        )
                        .catch((e) => logger.error("SMS OTP failed", e))
                );
            }
            if (channelsForOtp.includes("whatsapp")) {
                sends.push(
                    whatsappService
                        .sendOtp(
                            formattedNewPhone,
                            otp,
                            language ?? (currentSubscriber.language as string)
                        )
                        .catch((e) => logger.error("WhatsApp OTP failed", e))
                );
            }
            await Promise.allSettled(sends);

            res.json({
                success: true,
                verificationRequired: true,
                subscriber: toPublicSubscriber(currentSubscriber),
            });
            return;
        }

        // Build the set of columns to change up front. With nothing to change the
        // request is a no-op, and issuing an empty PostgREST UPDATE is undefined
        // behaviour, so reject it before touching the database.
        const updateData: Record<string, unknown> = {};
        if (channels !== undefined) updateData.channels = channels;
        if (language !== undefined) updateData.language = language;
        if (district !== undefined) updateData.district = district;
        if (is_active !== undefined) updateData.is_active = is_active;

        if (Object.keys(updateData).length === 0) {
            res.status(400).json({ error: "No changes were provided to update." });
            return;
        }

        try {
            let data = null;
            let dbFailed = dbConfig?.isSupabaseOffline;
            const client = req.supabase || supabase;

            if (!dbFailed) {
                try {
                    let query = client.from("notification_subscribers").update(updateData);
                    query = req.user
                        ? query.eq("user_id", req.user.id)
                        : query.eq("phone", guestPhone!);

                    const { data: dbData, error } = await query.select();
                    if (error) {
                        dbFailed = true;
                        if (
                            error.message?.includes("fetch failed") ||
                            error.message?.includes("refused") ||
                            error.message?.includes("timeout")
                        ) {
                            if (dbConfig) dbConfig.setOffline();
                        }
                    } else {
                        data = dbData;
                    }
                } catch (dbError: unknown) {
                    dbFailed = true;
                    const msg = dbError instanceof Error ? dbError.message : String(dbError);
                    if (
                        msg.includes("fetch failed") ||
                        msg.includes("refused") ||
                        msg.includes("timeout")
                    ) {
                        if (dbConfig) dbConfig.setOffline();
                    }
                }
            }

            if (dbFailed) {
                logger.warn("Supabase database is offline. Updating subscriber in-memory.");
                let sub = req.user
                    ? memorySubscriberStore.find((s) => s.user_id === req.user!.id)
                    : memorySubscriberStore.get(guestPhone!);

                if (sub) {
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

            res.json({ success: true, subscriber: toPublicSubscriber(data[0]) });
        } catch (err) {
            logger.error({ message: "Error in /phone update endpoint", error: err });
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

router.delete("/phone", limiter, optionalAuth, async (req: AuthenticatedRequest, res) => {
    // Identity comes from the session or a valid guest token, never from the
    // request body. A guest can only opt out the number they proved they own.
    let guestPhone: string | undefined;
    if (!req.user) {
        const verified = verifyGuestPhone(getGuestToken(req));
        if (!verified) {
            res.status(401).json({
                error: "A valid guest token is required to opt out without signing in.",
            });
            return;
        }
        guestPhone = verified;
    }

    try {
        let data = null;
        let dbFailed = dbConfig?.isSupabaseOffline;
        const client = req.supabase || supabase;

        if (!dbFailed) {
            try {
                let query = client.from("notification_subscribers").delete();
                query = req.user
                    ? query.eq("user_id", req.user.id)
                    : query.eq("phone", guestPhone!);

                const { data: dbData, error } = await query.select();
                if (error) {
                    dbFailed = true;
                    if (
                        error.message?.includes("fetch failed") ||
                        error.message?.includes("refused") ||
                        error.message?.includes("timeout")
                    ) {
                        if (dbConfig) dbConfig.setOffline();
                    }
                } else {
                    data = dbData;
                }
            } catch (dbError: unknown) {
                dbFailed = true;
                const msg = dbError instanceof Error ? dbError.message : String(dbError);
                if (
                    msg.includes("fetch failed") ||
                    msg.includes("refused") ||
                    msg.includes("timeout")
                ) {
                    if (dbConfig) dbConfig.setOffline();
                }
            }
        }

        if (dbFailed) {
            logger.warn("Supabase database is offline. Deleting subscriber in-memory.");
            let sub = req.user
                ? memorySubscriberStore.find((s) => s.user_id === req.user!.id)
                : memorySubscriberStore.get(guestPhone!);

            if (sub) {
                memorySubscriberStore.delete(sub.phone);
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
    const broadcastSchema = z
        .object({
            district: z.string().optional(),
            title: z.string().min(2),
            message: z.string().min(5),
            severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        })
        .strict();

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
                .eq("status", "active")
                .order("id")
                .range(totalProcessed, totalProcessed + BATCH_SIZE - 1);

            if (district && district.toLowerCase() !== "all") {
                query = query.ilike("district", escapeIlike(district));
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
        const parsed = twilioWebhookSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).send("Invalid webhook payload");
            return;
        }
        const from = parsed.data.From;
        const body = parsed.data.Body ? parsed.data.Body.trim().toUpperCase() : "";
        const formattedFrom = formatPhoneNumber(from);
        if (!formattedFrom) {
            res.status(400).send("Invalid phone number format");
            return;
        }

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
                        phone: maskPhone(formattedFrom),
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
                        phone: maskPhone(formattedFrom),
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
    <Message>${escapeXml(replyMessage)}</Message>
</Response>`);
        } catch (err) {
            logger.error({ message: "Error in Twilio webhook", error: err });
            res.status(500).send("Internal server error");
        }
    }
);

export default router;
