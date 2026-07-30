jest.mock("../src/services/sms-service", () => ({
    smsService: { send: jest.fn().mockResolvedValue(true) },
}));

jest.mock("../src/services/whatsapp-service", () => ({
    whatsappService: { send: jest.fn().mockResolvedValue(true) },
}));

// Prevent real Redis connection attempts in CI (no Redis server available)
jest.mock("../src/utils/redis", () => ({
    redisClient: {
        isOpen: false,
        connect: jest.fn().mockResolvedValue(undefined),
        set: jest.fn().mockResolvedValue(null),
        eval: jest.fn().mockResolvedValue(0),
        on: jest.fn(),
    },
}));

// Self-contained mock chain — jest.mock factories are hoisted, so nothing
// outside the factory can be referenced here.
jest.mock("../src/db/client", () => {
    const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        range: jest.fn(),
        update: jest.fn().mockReturnThis(),
    };
    return {
        supabase: { from: jest.fn().mockReturnValue(chain) },
        dbConfig: { isSupabaseOffline: false },
    };
});

import { supabase } from "../src/db/client";
import { smsService } from "../src/services/sms-service";
import { whatsappService } from "../src/services/whatsapp-service";
import {
    broadcastDistrictAlerts,
    broadcastDrugAlerts,
    broadcastExpiryAlerts,
    shouldSendForFrequency,
    broadcastConfig,
} from "../src/cron/alert-broadcaster";

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

function getChain() {
    return mockedSupabase.from() as jest.Mocked<any>;
}

interface SubscriberTableHooks {
    onIlike?: (...args: unknown[]) => void;
    onRange?: () => void;
}

/**
 * Stand-in for the notification_subscribers query builder that actually
 * applies the filters to the seeded rows instead of only recording them.
 * That way a test can seed a mix of rows and assert on who survives the
 * query, rather than asserting that some particular .eq() was called.
 */
function createSubscriberTable(rows: Record<string, unknown>[], hooks: SubscriberTableHooks = {}) {
    const select = () => {
        const predicates: ((row: Record<string, unknown>) => boolean)[] = [];
        const builder: Record<string, unknown> = {
            eq: (column: string, value: unknown) => {
                predicates.push((row) => row[column] === value);
                return builder;
            },
            ilike: (column: string, value: string) => {
                hooks.onIlike?.(column, value);
                predicates.push(
                    (row) => String(row[column] ?? "").toLowerCase() === value.toLowerCase()
                );
                return builder;
            },
            in: (column: string, values: unknown[]) => {
                predicates.push((row) => values.includes(row[column]));
                return builder;
            },
            range: (from: number, to: number) => {
                hooks.onRange?.();
                const matched = rows.filter((row) => predicates.every((match) => match(row)));
                return Promise.resolve({ data: matched.slice(from, to + 1), error: null });
            },
        };
        return builder;
    };

    return { select: jest.fn(select) };
}

/**
 * district_alerts resolves its fetch after .eq().eq() and drug_alerts after a
 * single .eq(), so the chain is made thenable to satisfy both without the
 * test having to care how many filters the caller stacks.
 */
function createAlertTable(alerts: Record<string, unknown>[]) {
    const chain: Record<string, unknown> = {
        eq: jest.fn(() => chain),
        then: (resolve: (value: unknown) => void) => resolve({ data: alerts, error: null }),
    };

    return {
        select: jest.fn(() => chain),
        update: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) })),
    };
}

// ---------------------------------------------------------------------------
// shouldSendForFrequency unit tests
// ---------------------------------------------------------------------------

describe("shouldSendForFrequency", () => {
    it("always returns true for 'immediate'", () => {
        expect(shouldSendForFrequency("immediate", new Date("2026-06-25T10:00:00Z"))).toBe(true);
    });

    it("always returns true for 'daily'", () => {
        expect(shouldSendForFrequency("daily", new Date("2026-06-25T10:00:00Z"))).toBe(true);
    });

    it("returns true for 'weekly' only on Monday", () => {
        const monday = new Date("2026-06-22T08:00:00Z"); // Monday
        const tuesday = new Date("2026-06-23T08:00:00Z"); // Tuesday
        expect(shouldSendForFrequency("weekly", monday)).toBe(true);
        expect(shouldSendForFrequency("weekly", tuesday)).toBe(false);
    });

    it("returns true for 'monthly' only on the 1st of the month", () => {
        const first = new Date("2026-06-01T08:00:00Z");
        const second = new Date("2026-06-02T08:00:00Z");
        expect(shouldSendForFrequency("monthly", first)).toBe(true);
        expect(shouldSendForFrequency("monthly", second)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// broadcastDistrictAlerts (unchanged behaviour — always immediate)
// ---------------------------------------------------------------------------

describe("broadcastDistrictAlerts", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("marks the alert as broadcasted before paginating subscribers (not after)", async () => {
        const callOrder: string[] = [];
        const chain = getChain();

        chain.select.mockReturnThis();
        chain.eq.mockReturnThis();
        chain.ilike.mockReturnThis();

        // First select(...).eq(...).eq(...) call: fetch unbroadcasted alerts
        let selectCallCount = 0;
        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "district_alerts") {
                return {
                    select: jest.fn().mockImplementation(() => ({
                        eq: jest.fn().mockImplementation(() => ({
                            eq: jest.fn().mockResolvedValue({
                                data: [
                                    {
                                        id: "alert-1",
                                        district: "Delhi",
                                        medicine_name: "Aspirin 500mg",
                                        alert_level: "medium",
                                        is_active: true,
                                        broadcasted: false,
                                    },
                                ],
                                error: null,
                            }),
                        })),
                    })),
                    update: jest.fn().mockImplementation(() => {
                        callOrder.push("mark_broadcasted");
                        return {
                            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                        };
                    }),
                };
            }
            if (table === "notification_subscribers") {
                selectCallCount += 1;
                return createSubscriberTable([], {
                    onRange: () => callOrder.push("fetch_subscribers"),
                });
            }
            return chain;
        });

        await broadcastDistrictAlerts();

        expect(callOrder[0]).toBe("mark_broadcasted");
        expect(callOrder).toContain("fetch_subscribers");
    });

    it("does not send notifications when marking broadcasted=true fails", async () => {
        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "district_alerts") {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({
                                data: [
                                    {
                                        id: "alert-1",
                                        district: "Mumbai",
                                        medicine_name: "Paracetamol",
                                        alert_level: "high",
                                        is_active: true,
                                        broadcasted: false,
                                    },
                                ],
                                error: null,
                            }),
                        }),
                    }),
                    update: jest.fn().mockReturnValue({
                        eq: jest.fn().mockResolvedValue({
                            data: null,
                            error: { message: "DB write failed" },
                        }),
                    }),
                };
            }
            if (table === "notification_subscribers") {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            ilike: jest.fn().mockReturnValue({
                                range: jest.fn().mockResolvedValue({
                                    data: [
                                        {
                                            id: "sub-1",
                                            phone: "+911234567890",
                                            language: "en",
                                            channels: ["sms"],
                                            district: "Mumbai",
                                            is_active: true,
                                        },
                                    ],
                                    error: null,
                                }),
                            }),
                        }),
                    }),
                };
            }
            return {};
        });

        await broadcastDistrictAlerts();

        expect(smsService.send).not.toHaveBeenCalled();
    });

    it("does not re-notify already-broadcasted alerts on the next tick", async () => {
        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "district_alerts") {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
                        }),
                    }),
                };
            }
            return {};
        });

        await broadcastDistrictAlerts();

        expect(smsService.send).not.toHaveBeenCalled();
    });

    it("matches subscribers via .ilike('district', ...) when the alert is keyed on a real administrative district (#2307)", async () => {
        let ilikeArgs: unknown[] = [];

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "district_alerts") {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({
                                data: [
                                    {
                                        id: "alert-1",
                                        district: "Pune District",
                                        medicine_name: "Aspirin 500mg",
                                        alert_level: "medium",
                                        is_active: true,
                                        broadcasted: false,
                                    },
                                ],
                                error: null,
                            }),
                        }),
                    }),
                    update: jest.fn().mockReturnValue({
                        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                };
            }
            if (table === "notification_subscribers") {
                return createSubscriberTable(
                    [
                        {
                            id: "sub-1",
                            phone: "+910000000001",
                            language: "en",
                            channels: ["sms"],
                            district: "Pune District",
                            is_active: true,
                            status: "active",
                        },
                    ],
                    {
                        onIlike: (...args) => {
                            ilikeArgs = args;
                        },
                    }
                );
            }
            return {};
        });

        await broadcastDistrictAlerts();

        expect(ilikeArgs).toEqual(["district", "Pune District"]);
        expect(smsService.send).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// Verification gating (#3957)
// ---------------------------------------------------------------------------

describe("broadcast verification gating", () => {
    const VERIFIED_PHONE = "+919000000001";
    const UNVERIFIED_PHONE = "+919000000002";

    const DISTRICT_ALERT = {
        id: "alert-1",
        district: "Delhi",
        medicine_name: "Aspirin 500mg",
        alert_level: "high",
        is_active: true,
        broadcasted: false,
    };

    const DRUG_ALERT = {
        id: "drug-alert-1",
        district: "Delhi",
        reported_brand_name: "Paracetamol",
        batch_number: "B1",
        broadcasted: false,
    };

    /**
     * Two subscribers in the same district: one that completed OTP
     * verification and one that stopped at the pending step. The second
     * row's status is what each test varies.
     */
    function seedSubscribers(secondStatus: "pending" | "active") {
        return [
            {
                id: "sub-verified",
                phone: VERIFIED_PHONE,
                language: "en",
                channels: ["sms"],
                district: "Delhi",
                is_active: true,
                status: "active",
            },
            {
                id: "sub-unverified",
                phone: UNVERIFIED_PHONE,
                language: "en",
                channels: ["sms"],
                district: "Delhi",
                is_active: true,
                status: secondStatus,
            },
        ];
    }

    function mockTables(alertTable: string, alerts: Record<string, unknown>[], subscribers: any[]) {
        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === alertTable) return createAlertTable(alerts);
            if (table === "notification_subscribers") return createSubscriberTable(subscribers);
            return {};
        });
    }

    function notifiedPhones() {
        return (smsService.send as jest.Mock).mock.calls.map((call) => call[0]);
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (smsService.send as jest.Mock).mockResolvedValue(true);
    });

    it("skips pending subscribers when broadcasting a district alert", async () => {
        mockTables("district_alerts", [DISTRICT_ALERT], seedSubscribers("pending"));

        await broadcastDistrictAlerts();

        expect(notifiedPhones()).toEqual([VERIFIED_PHONE]);
    });

    it("starts sending district alerts once a pending subscriber verifies", async () => {
        mockTables("district_alerts", [DISTRICT_ALERT], seedSubscribers("active"));

        await broadcastDistrictAlerts();

        expect(notifiedPhones()).toEqual([VERIFIED_PHONE, UNVERIFIED_PHONE]);
    });

    it("skips pending subscribers when broadcasting a drug recall", async () => {
        mockTables("drug_alerts", [DRUG_ALERT], seedSubscribers("pending"));

        await broadcastDrugAlerts();

        expect(notifiedPhones()).toEqual([VERIFIED_PHONE]);
    });

    it("starts sending drug recalls once a pending subscriber verifies", async () => {
        mockTables("drug_alerts", [DRUG_ALERT], seedSubscribers("active"));

        await broadcastDrugAlerts();

        expect(notifiedPhones()).toEqual([VERIFIED_PHONE, UNVERIFIED_PHONE]);
    });
});

// ---------------------------------------------------------------------------
// broadcastExpiryAlerts
// ---------------------------------------------------------------------------

describe("broadcastExpiryAlerts", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    function mockBatchesQuery(batches: any[], opts: { gte?: jest.Mock } = {}) {
        const gteSpy = opts.gte || jest.fn();
        return {
            in: jest.fn().mockResolvedValue({ data: batches, error: null }),
            select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({ data: batches, error: null }),
                gte: jest.fn().mockImplementation((...args) => {
                    gteSpy(...args);
                    return {
                        lte: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ data: batches, error: null }),
                        }),
                    };
                }),
            }),
        };
    }

    /**
     * Build a notification_subscribers mock that supports the
     * .eq("is_active", true).in("preference_frequency", [...]).range() chain.
     */
    function mockSubscribersQuery(subscribers: any[]) {
        return {
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    in: jest.fn().mockReturnValue({
                        range: jest.fn().mockResolvedValue({ data: subscribers, error: null }),
                    }),
                }),
            }),
        };
    }

    it("sends exactly one consolidated notification per subscriber, not one per batch", async () => {
        const batches = [
            {
                id: "batch-1",
                batch_number: "B1",
                expiry_date: "2026-07-01",
                medicine: { brand_name: "Aspirin" },
            },
            {
                id: "batch-2",
                batch_number: "B2",
                expiry_date: "2026-07-05",
                medicine: { brand_name: "Paracetamol" },
            },
            {
                id: "batch-3",
                batch_number: "B3",
                expiry_date: "2026-07-10",
                medicine: { brand_name: "Ibuprofen" },
            },
        ];

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "batches") {
                return {
                    ...mockBatchesQuery(batches),
                    update: jest.fn().mockReturnValue({
                        in: jest.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                };
            }
            if (table === "notification_subscribers") {
                return mockSubscribersQuery([
                    {
                        id: "sub-1",
                        phone: "+910000000001",
                        language: "en",
                        channels: ["sms"],
                        is_active: true,
                        preference_frequency: "immediate",
                    },
                    {
                        id: "sub-2",
                        phone: "+910000000002",
                        language: "en",
                        channels: ["sms"],
                        is_active: true,
                        preference_frequency: "immediate",
                    },
                ]);
            }
            return {};
        });

        await broadcastExpiryAlerts();

        // 2 subscribers × 1 consolidated message each = 2 sends total,
        // not 2 subscribers × 3 batches = 6 sends.
        expect(smsService.send).toHaveBeenCalledTimes(2);

        const [, fullMessage] = (smsService.send as jest.Mock).mock.calls[0];
        expect(fullMessage).toContain("B1");
        expect(fullMessage).toContain("B2");
        expect(fullMessage).toContain("B3");
    });

    it("marks batches as broadcasted after successful expiry notification delivery", async () => {
        const callOrder: string[] = [];
        const batches = [
            {
                id: "batch-1",
                batch_number: "B1",
                expiry_date: "2026-07-01",
                medicine: { brand_name: "Aspirin" },
            },
        ];

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "batches") {
                return {
                    ...mockBatchesQuery(batches),
                    update: jest.fn().mockImplementation(() => {
                        callOrder.push("mark_batch_broadcasted");
                        return {
                            in: jest.fn().mockResolvedValue({ data: null, error: null }),
                        };
                    }),
                };
            }
            if (table === "notification_subscribers") {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            in: jest.fn().mockReturnValue({
                                range: jest.fn().mockImplementation((from: number, to: number) => {
                                    if (from === 0 && to === 0) {
                                        return Promise.resolve({
                                            data: [{ id: "mock" }],
                                            error: null,
                                        });
                                    }
                                    callOrder.push("fetch_subscribers");
                                    return Promise.resolve({
                                        data: [
                                            {
                                                id: "sub-1",
                                                phone: "+910000000001",
                                                language: "en",
                                                channels: ["sms"],
                                            },
                                        ],
                                        error: null,
                                    });
                                }),
                            }),
                        }),
                    }),
                };
            }
            return {};
        });

        await broadcastExpiryAlerts();

        expect(callOrder).toEqual(["fetch_subscribers", "mark_batch_broadcasted"]);
    });

    it("keeps batches eligible for retry when every expiry delivery fails", async () => {
        const markBatchSpy = jest.fn();
        (smsService.send as jest.Mock).mockResolvedValue(false);

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "batches") {
                return {
                    ...mockBatchesQuery([
                        {
                            id: "batch-1",
                            batch_number: "B1",
                            expiry_date: "2026-07-01",
                            medicine: { brand_name: "Aspirin" },
                        },
                    ]),
                    update: markBatchSpy,
                };
            }
            if (table === "notification_subscribers") {
                return mockSubscribersQuery([
                    {
                        id: "sub-1",
                        phone: "+910000000001",
                        language: "en",
                        channels: ["sms"],
                    },
                ]);
            }
            return {};
        });

        await broadcastExpiryAlerts();

        expect(smsService.send).toHaveBeenCalledTimes(1);
        expect(markBatchSpy).not.toHaveBeenCalled();
    });

    it("marks batches as broadcasted after a partial expiry delivery success", async () => {
        const markBatchSpy = jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ data: null, error: null }),
        });
        (smsService.send as jest.Mock).mockResolvedValue(true);
        (whatsappService.send as jest.Mock).mockResolvedValue(false);

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "batches") {
                return {
                    ...mockBatchesQuery([
                        {
                            id: "batch-1",
                            batch_number: "B1",
                            expiry_date: "2026-07-01",
                            medicine: { brand_name: "Aspirin" },
                        },
                    ]),
                    update: markBatchSpy,
                };
            }
            if (table === "notification_subscribers") {
                return mockSubscribersQuery([
                    {
                        id: "sub-1",
                        phone: "+910000000001",
                        language: "en",
                        channels: ["sms", "whatsapp"],
                    },
                ]);
            }
            return {};
        });

        await broadcastExpiryAlerts();

        expect(smsService.send).toHaveBeenCalledTimes(1);
        expect(whatsappService.send).toHaveBeenCalledTimes(1);
        expect(markBatchSpy).toHaveBeenCalledWith({ expiry_broadcasted: true });
    });

    it("does not re-send to a batch already marked expiry_broadcasted=true", async () => {
        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "batches") {
                return mockBatchesQuery([]);
            }
            return {};
        });

        await broadcastExpiryAlerts();

        expect(smsService.send).not.toHaveBeenCalled();
    });

    it("excludes already-expired batches via the lower-bound date filter", async () => {
        const gteSpy = jest.fn();

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "batches") {
                return mockBatchesQuery([], { gte: gteSpy });
            }
            return {};
        });

        await broadcastExpiryAlerts();

        expect(gteSpy).toHaveBeenCalledWith("expiry_date", expect.any(String));
        expect(smsService.send).not.toHaveBeenCalled();
    });

    it("keeps delivery behavior when marking broadcasted batches fails", async () => {
        const batches = [
            {
                id: "batch-1",
                batch_number: "B1",
                expiry_date: "2026-07-01",
                medicine: { brand_name: "Aspirin" },
            },
            {
                id: "batch-2",
                batch_number: "B2",
                expiry_date: "2026-07-05",
                medicine: { brand_name: "Paracetamol" },
            },
        ];

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "batches") {
                return {
                    ...mockBatchesQuery(batches),
                    update: jest.fn().mockImplementation((payload: Record<string, unknown>) => ({
                        in: jest.fn().mockImplementation((_col: string, ids: string[]) => {
                            if (ids.includes("batch-1")) {
                                return Promise.resolve({
                                    data: null,
                                    error: { message: "DB write failed" },
                                });
                            }
                            return Promise.resolve({ data: null, error: null });
                        }),
                    })),
                };
            }
            if (table === "notification_subscribers") {
                return mockSubscribersQuery([
                    {
                        id: "sub-1",
                        phone: "+910000000001",
                        language: "en",
                        channels: ["sms"],
                        is_active: true,
                        preference_frequency: "immediate",
                    },
                ]);
            }
            return {};
        });

        broadcastConfig.MARK_BROADCASTED_CHUNK_SIZE = 1;
        try {
            await broadcastExpiryAlerts();
        } finally {
            broadcastConfig.MARK_BROADCASTED_CHUNK_SIZE = 500;
        }

        expect(smsService.send).toHaveBeenCalledTimes(1);
        const [, fullMessage] = (smsService.send as jest.Mock).mock.calls[0];
        expect(fullMessage).toContain("B1");
        expect(fullMessage).toContain("B2");
    });

    // -------------------------------------------------------------------------
    // preference_frequency filtering tests
    // -------------------------------------------------------------------------

    it("only sends to 'immediate' subscribers when run on a non-Monday, non-1st day", async () => {
        // Wednesday June 25 2026 — not Monday, not 1st
        const wednesday = new Date("2026-06-25T08:00:00Z");
        let capturedInArgs: string[] = [];

        const batches = [
            {
                id: "batch-1",
                batch_number: "B1",
                expiry_date: "2026-07-01",
                medicine: { brand_name: "Aspirin" },
            },
        ];

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "batches") {
                return {
                    ...mockBatchesQuery(batches),
                    update: jest.fn().mockReturnValue({
                        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                };
            }
            if (table === "notification_subscribers") {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            in: jest.fn().mockImplementation((_col: string, values: string[]) => {
                                capturedInArgs = values;
                                return {
                                    range: jest.fn().mockResolvedValue({ data: [], error: null }),
                                };
                            }),
                        }),
                    }),
                };
            }
            return {};
        });

        await broadcastExpiryAlerts(wednesday);

        // On a Wednesday only "immediate" and "daily" should be queried
        expect(capturedInArgs).toContain("immediate");
        expect(capturedInArgs).toContain("daily");
        expect(capturedInArgs).not.toContain("weekly");
        expect(capturedInArgs).not.toContain("monthly");
    });

    it("includes 'weekly' subscribers when run on a Monday", async () => {
        const monday = new Date("2026-06-22T08:00:00Z");
        let capturedInArgs: string[] = [];

        const batches = [
            {
                id: "batch-1",
                batch_number: "B1",
                expiry_date: "2026-07-01",
                medicine: { brand_name: "Aspirin" },
            },
        ];

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "batches") {
                return {
                    ...mockBatchesQuery(batches),
                    update: jest.fn().mockReturnValue({
                        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                };
            }
            if (table === "notification_subscribers") {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            in: jest.fn().mockImplementation((_col: string, values: string[]) => {
                                capturedInArgs = values;
                                return {
                                    range: jest.fn().mockResolvedValue({ data: [], error: null }),
                                };
                            }),
                        }),
                    }),
                };
            }
            return {};
        });

        await broadcastExpiryAlerts(monday);

        expect(capturedInArgs).toContain("weekly");
    });

    it("includes 'monthly' subscribers when run on the 1st of a month", async () => {
        const firstOfMonth = new Date("2026-07-01T08:00:00Z");
        let capturedInArgs: string[] = [];

        const batches = [
            {
                id: "batch-1",
                batch_number: "B1",
                expiry_date: "2026-07-15",
                medicine: { brand_name: "Aspirin" },
            },
        ];

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "batches") {
                return {
                    ...mockBatchesQuery(batches),
                    update: jest.fn().mockReturnValue({
                        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                };
            }
            if (table === "notification_subscribers") {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            in: jest.fn().mockImplementation((_col: string, values: string[]) => {
                                capturedInArgs = values;
                                return {
                                    range: jest.fn().mockResolvedValue({ data: [], error: null }),
                                };
                            }),
                        }),
                    }),
                };
            }
            return {};
        });

        await broadcastExpiryAlerts(firstOfMonth);

        expect(capturedInArgs).toContain("monthly");
    });

    it("does not send expiry alerts to 'weekly' subscribers on a non-Monday", async () => {
        const thursday = new Date("2026-06-25T08:00:00Z");

        const batches = [
            {
                id: "batch-1",
                batch_number: "B1",
                expiry_date: "2026-07-01",
                medicine: { brand_name: "Aspirin" },
            },
        ];

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "batches") {
                return {
                    ...mockBatchesQuery(batches),
                    update: jest.fn().mockReturnValue({
                        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                };
            }
            if (table === "notification_subscribers") {
                return mockSubscribersQuery([]);
            }
            return {};
        });

        await broadcastExpiryAlerts(thursday);

        expect(smsService.send).not.toHaveBeenCalled();
    });

    it("does NOT mark batches as expiry_broadcasted when no subscribers match the active frequency", async () => {
        // If there are zero eligible subscribers for this run's frequency
        // window, the batch must stay unmarked so weekly/monthly subscribers
        // can still receive it on their scheduled day.
        const tuesday = new Date("2026-06-23T08:00:00Z");
        const markBatchSpy = jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        const batches = [
            {
                id: "batch-1",
                batch_number: "B1",
                expiry_date: "2026-07-01",
                medicine: { brand_name: "Aspirin" },
            },
        ];

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "batches") {
                return {
                    ...mockBatchesQuery(batches),
                    update: markBatchSpy,
                };
            }
            if (table === "notification_subscribers") {
                // No subscribers match — empty result
                return mockSubscribersQuery([]);
            }
            return {};
        });

        await broadcastExpiryAlerts(tuesday);

        expect(markBatchSpy).not.toHaveBeenCalled();
        expect(smsService.send).not.toHaveBeenCalled();
    });
});
