import webPush from "web-push";
import { triggerRecallAlert } from "../src/services/notifications";

var mockOrder: jest.Mock;
var mockInsert: jest.Mock;
var mockDeleteEq: jest.Mock;
var mockSelect: jest.Mock;
var mockDelete: jest.Mock;
var mockFrom: jest.Mock;
var mockRange: jest.Mock;

jest.mock("web-push", () => ({
    __esModule: true,
    default: {
        setVapidDetails: jest.fn(),
        sendNotification: jest.fn(),
    },
}));

jest.mock("../src/db/client", () => ({
    supabase: (() => {
        mockRange = jest.fn();
        mockOrder = jest.fn(() => ({ range: mockRange }));
        mockInsert = jest.fn();
        mockDeleteEq = jest.fn();
        mockSelect = jest.fn(() => ({ order: mockOrder }));
        mockDelete = jest.fn(() => ({ eq: mockDeleteEq }));
        mockFrom = jest.fn((table: string) => {
            if (table === "push_notification_events") {
                return { insert: mockInsert };
            }

            return {
                select: mockSelect,
                delete: mockDelete,
            };
        });

        return {
            from: mockFrom,
        };
    })(),
}));

const mockedWebPush = webPush as jest.Mocked<typeof webPush>;

function pushSubscriptionRow(endpoint: string) {
    return {
        endpoint,
        subscription: {
            endpoint,
            keys: {
                p256dh: "public-key",
                auth: "auth-secret",
            },
        },
        created_at: "2026-06-05T10:00:00.000Z",
        user_id: "user-1",
    };
}

describe("push notification delivery analytics", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.VAPID_PUBLIC_KEY = "test-public-key";
        process.env.VAPID_PRIVATE_KEY = "test-private-key";
        process.env.VAPID_SUBJECT = "mailto:test@sahidawa.local";
        mockDeleteEq.mockResolvedValue({ error: null });
        mockInsert.mockResolvedValue({ error: null });
    });

    it("records sent and failed delivery events when recall pushes are dispatched", async () => {
        const sentEndpoint = "https://push.example.test/subscription/sent";
        const goneEndpoint = "https://push.example.test/subscription/gone";
        mockRange.mockResolvedValueOnce({
            data: [pushSubscriptionRow(sentEndpoint), pushSubscriptionRow(goneEndpoint)],
            error: null,
        });
        mockedWebPush.sendNotification
            .mockResolvedValueOnce({ statusCode: 201 } as never)
            .mockRejectedValueOnce({
                statusCode: 410,
                code: "pushsubscriptionexpired",
                name: "WebPushError",
            });

        const result = await triggerRecallAlert({
            id: "recall-analytics-1",
            medicineName: "Azithromycin 500mg",
            reason: "Batch recalled due to failed dissolution quality checks.",
            severity: "critical",
            source: "CDSCO test feed",
        });

        expect(result).toMatchObject({
            configured: true,
            attempted: 2,
            sent: 1,
            failed: 1,
        });
        expect(mockFrom).toHaveBeenCalledWith("push_notification_events");
        expect(mockInsert).toHaveBeenCalledWith([
            expect.objectContaining({
                alert_id: "recall-analytics-1",
                notification_type: "recall_alert",
                endpoint_host: "push.example.test",
                status: "sent",
                http_status: null,
                failure_reason: null,
                error_code: null,
                error_name: null,
            }),
            expect.objectContaining({
                alert_id: "recall-analytics-1",
                notification_type: "recall_alert",
                endpoint_host: "push.example.test",
                status: "failed",
                http_status: 410,
                failure_reason: "410 Gone",
                error_code: "pushsubscriptionexpired",
                error_name: "WebPushError",
            }),
        ]);
        const insertedRows = mockInsert.mock.calls[0][0];
        expect(insertedRows[0].endpoint_hash).toHaveLength(64);
        expect(insertedRows[0].endpoint_hash).not.toContain(sentEndpoint);
        expect(mockDeleteEq).toHaveBeenCalledWith("endpoint", goneEndpoint);
    });

    it("does not fail dispatch results when analytics persistence throws", async () => {
        mockRange.mockResolvedValueOnce({
            data: [pushSubscriptionRow("https://push.example.test/subscription/sent")],
            error: null,
        });
        mockedWebPush.sendNotification.mockResolvedValueOnce({ statusCode: 201 } as never);
        mockInsert.mockImplementationOnce(() => {
            throw new Error("analytics insert exploded");
        });

        const result = await triggerRecallAlert({
            id: "recall-analytics-2",
            medicineName: "Paracetamol 650mg",
            reason: "Batch recalled due to packaging mismatch across selected strips.",
            severity: "high",
            source: "CDSCO test feed",
        });

        expect(result).toMatchObject({
            configured: true,
            attempted: 1,
            sent: 1,
            failed: 0,
        });
        expect(mockInsert).toHaveBeenCalledTimes(1);
    });
});
