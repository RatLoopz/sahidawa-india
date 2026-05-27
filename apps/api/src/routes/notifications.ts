import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
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

router.post("/subscriptions", async (req, res) => {
    const parsed = pushSubscriptionSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid push subscription",
            issues: parsed.error.issues,
        });
        return;
    }

    const result = await savePushSubscription(parsed.data);

    res.status(201).json({
        endpoint: result.stored.endpoint,
        persisted: result.persisted,
        warning: result.persisted
            ? undefined
            : "Stored in memory because push_subscriptions table is unavailable.",
    });
});

router.delete("/subscriptions", async (req, res) => {
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

router.post(
    "/recalls/mock/trigger",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
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

export default router;
