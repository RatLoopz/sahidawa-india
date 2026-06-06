import webPush, { PushSubscription } from "web-push";
import { z } from "zod";
import { supabase } from "../db/client";
import logger from "../utils/logger";

export const pushSubscriptionSchema = z.object({
    endpoint: z.string().url(),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
    }),
});

export const recallAlertSchema = z.object({
    id: z.string().min(1),
    medicineName: z.string().min(2),
    batchNumber: z.string().optional(),
    manufacturer: z.string().optional(),
    reason: z.string().min(8),
    severity: z.enum(["medium", "high", "critical"]).default("high"),
    source: z.string().default("CDSCO mock feed"),
    recalledAt: z.string().datetime().optional(),
});

export type RecallAlert = z.infer<typeof recallAlertSchema>;
export type StoredSubscription = {
    endpoint: string;
    subscription: PushSubscription;
    createdAt: string;
    userId: string;
};

const memorySubscriptions = new Map<string, StoredSubscription>();

const mockRecallFeed: RecallAlert[] = [
    {
        id: "cdsco-mock-azithro-001",
        medicineName: "Azithromycin 500mg",
        batchNumber: "BATCH-CIPLA-001",
        manufacturer: "Cipla Ltd.",
        reason: "Mock CDSCO feed: batch recalled due to failed dissolution quality checks.",
        severity: "critical",
        source: "CDSCO mock feed",
        recalledAt: new Date().toISOString(),
    },
    {
        id: "cdsco-mock-para-002",
        medicineName: "Paracetamol 650mg",
        batchNumber: "BATCH-SUN-002",
        manufacturer: "Sun Pharmaceuticals",
        reason: "Mock CDSCO feed: packaging mismatch reported for selected strips.",
        severity: "high",
        source: "CDSCO mock feed",
        recalledAt: new Date().toISOString(),
    },
];

function configureWebPush() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:security@sahidawa.local";

    if (!publicKey || !privateKey) {
        return false;
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);
    return true;
}

export function isWebPushConfigured() {
    return configureWebPush();
}

export function getVapidPublicKey() {
    return process.env.VAPID_PUBLIC_KEY ?? null;
}

export function getMockRecallFeed() {
    return mockRecallFeed;
}

export async function savePushSubscription(subscription: PushSubscription, userId: string) {
    const stored: StoredSubscription = {
        endpoint: subscription.endpoint,
        subscription,
        createdAt: new Date().toISOString(),
        userId,
    };
    memorySubscriptions.set(subscription.endpoint, stored);

    const { error } = await supabase.from("push_subscriptions").upsert(
        {
            endpoint: subscription.endpoint,
            subscription,
            updated_at: stored.createdAt,
            user_id: userId,
        },
        { onConflict: "endpoint" }
    );

    return { stored, persisted: !error, error };
}

export async function removePushSubscription(endpoint: string) {
    memorySubscriptions.delete(endpoint);
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

async function listPersistedSubscriptions(): Promise<StoredSubscription[]> {
    const { data, error } = await supabase
        .from("push_subscriptions")
        .select("endpoint, subscription, created_at, user_id")
        .order("created_at", { ascending: false });

    if (error || !data) {
        return [];
    }

    const results: StoredSubscription[] = [];

    for (const row of data) {
        const parsed = pushSubscriptionSchema.safeParse(row.subscription);
        if (!parsed.success) continue;

        results.push({
            endpoint: row.endpoint as string,
            subscription: parsed.data as PushSubscription,
            createdAt: (row.created_at as string | null) ?? new Date().toISOString(),
            userId: row.user_id as string,
        });
    }

    return results;
}

export async function listPushSubscriptions() {
    const persisted = await listPersistedSubscriptions();
    if (persisted.length > 0) {
        return persisted;
    }

    return [...memorySubscriptions.values()];
}

export function buildRecallPayload(alert: RecallAlert) {
    return {
        title: `${alert.medicineName} recalled`,
        body: alert.reason,
        medicineName: alert.medicineName,
        recallReason: alert.reason,
        severity: alert.severity,
        batchNumber: alert.batchNumber,
        manufacturer: alert.manufacturer,
        source: alert.source,
        url: "/alerts",
        recalledAt: alert.recalledAt ?? new Date().toISOString(),
    };
}

function getPushErrorStatusCode(reason: unknown): number | null {
    if (!reason || typeof reason !== "object") {
        return null;
    }

    const error = reason as Record<string, unknown>;
    const rawStatus = error.statusCode ?? error.status;

    if (typeof rawStatus === "number" && Number.isInteger(rawStatus)) {
        return rawStatus;
    }

    if (typeof rawStatus === "string" && /^\d{3}$/.test(rawStatus)) {
        return Number(rawStatus);
    }

    return null;
}

function getPushErrorLabel(reason: unknown, key: "code" | "name") {
    if (!reason || typeof reason !== "object") {
        return "unknown";
    }

    const value = (reason as Record<string, unknown>)[key];
    return typeof value === "string" && value.length > 0 ? value : "unknown";
}

function getPushEndpointHost(endpoint: string) {
    try {
        return new URL(endpoint).hostname;
    } catch {
        return "unknown";
    }
}

function shouldRemovePushSubscription(reason: unknown) {
    const statusCode = getPushErrorStatusCode(reason);
    return statusCode === 404 || statusCode === 410;
}

function logRetainedPushFailure(endpoint: string, reason: unknown) {
    const statusCode = getPushErrorStatusCode(reason);
    const statusLabel = statusCode === null ? "none" : statusCode;

    logger.warn(
        "Retaining push subscription after non-terminal push delivery failure " +
            `(host=${getPushEndpointHost(endpoint)}, status=${statusLabel}, ` +
            `code=${getPushErrorLabel(reason, "code")}, ` +
            `name=${getPushErrorLabel(reason, "name")})`
    );
}

export async function triggerRecallAlert(alert: RecallAlert) {
    const configured = configureWebPush();
    const subscriptions = await listPushSubscriptions();
    const payload = buildRecallPayload(alert);

    if (!configured) {
        return {
            configured: false,
            attempted: 0,
            sent: 0,
            failed: 0,
            payload,
        };
    }

    const BATCH_SIZE = 50;
    const results: PromiseSettledResult<any>[] = [];
    const expiredEndpoints: string[] = [];

    for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
        const chunk = subscriptions.slice(i, i + BATCH_SIZE);
        const chunkResults = await Promise.allSettled(
            chunk.map((item) =>
                webPush.sendNotification(item.subscription, JSON.stringify(payload))
            )
        );

        chunkResults.forEach((result, index) => {
            results.push(result);
            if (result.status === "rejected") {
                const endpoint = chunk[index].endpoint;
                if (shouldRemovePushSubscription(result.reason)) {
                    expiredEndpoints.push(endpoint);
                } else {
                    logRetainedPushFailure(endpoint, result.reason);
                }
            }
        });

        if (i + BATCH_SIZE < subscriptions.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    await Promise.all(expiredEndpoints.map(removePushSubscription));

    return {
        configured: true,
        attempted: subscriptions.length,
        sent: results.filter((result) => result.status === "fulfilled").length,
        failed: results.filter((result) => result.status === "rejected").length,
        payload,
    };
}
