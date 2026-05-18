// Fix: Mock WebSocket for Node.js versions < 22 to prevent Supabase Realtime client crash during test imports
if (typeof globalThis.WebSocket === "undefined") {
    globalThis.WebSocket = class {} as any;
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    buildRecallPayload,
    getMockRecallFeed,
    pushSubscriptionSchema,
    recallAlertSchema,
} from "./notifications";

describe("notification service", () => {
    it("validates browser push subscriptions", () => {
        const parsed = pushSubscriptionSchema.safeParse({
            endpoint: "https://push.example.test/subscription/1",
            keys: {
                p256dh: "public-key",
                auth: "auth-secret",
            },
        });

        assert.equal(parsed.success, true);
    });

    it("rejects subscriptions without key material", () => {
        const parsed = pushSubscriptionSchema.safeParse({
            endpoint: "https://push.example.test/subscription/1",
            keys: {
                p256dh: "",
                auth: "",
            },
        });

        assert.equal(parsed.success, false);
    });

    it("builds recall push payloads with medicine name and reason", () => {
        const alert = recallAlertSchema.parse({
            id: "recall-1",
            medicineName: "Azithromycin 500mg",
            reason: "Batch recalled due to failed dissolution quality checks.",
            severity: "critical",
        });

        const payload = buildRecallPayload(alert);

        assert.equal(payload.title, "Azithromycin 500mg recalled");
        assert.equal(payload.medicineName, "Azithromycin 500mg");
        assert.equal(
            payload.recallReason,
            "Batch recalled due to failed dissolution quality checks."
        );
        assert.equal(payload.severity, "critical");
    });

    it("exposes a mock CDSCO recall feed", () => {
        const feed = getMockRecallFeed();

        assert.ok(feed.length >= 1);
        assert.ok(feed[0].medicineName);
        assert.ok(feed[0].reason);
    });
});
