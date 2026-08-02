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
    onRange?: (from: number, to: number) => void;
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
                hooks.onRange?.(from, to);
                const matched = rows.filter((row) => predicates.every((match) => match(row)));
                return Promise.resolve({ data: matched.slice(from, to + 1), error: null });
            },
        };
        return builder;
    };

    return { select: jest.fn(select) };
}

function createSubscriberQueryMock(capturedEqArgs: string[]) {
    const builder: any = {
        eq: jest.fn().mockImplementation((col: string, value: any) => {
            if (col === "preference_frequency") {
                capturedEqArgs.push(value);
            }
            return builder;
        }),
        range: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    return {
        select: jest.fn(() => builder),
    };
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

/**
 * Mocks a `batches` query that supports the immediate chain
 * (.select().gte().lte().eq("expiry_broadcasted", false)) and the digest
 * chains (.select().gte().lte() with optional .not("id","in",delivered)).
 * The terminal .lte() value is a thenable that also exposes .eq/.not so
 * both query shapes resolve to the same "rows" result.
 */
function mockBatchesQuery(batches: any[], opts: { gte?: jest.Mock } = {}) {
    const gteSpy = opts.gte || jest.fn();
    const result = (rows: any[]) => ({ data: rows, error: null });
    const thenable = {
        then: (resolve: (value: unknown) => void) => resolve(result(batches)),
        eq: jest.fn().mockImplementation((col: string, value: boolean) => {
            if (col === "expiry_broadcasted") {
                return Promise.resolve(
                    result(
                        value
                            ? batches.filter((b) => b.expiry_broadcasted === true)
                            : batches.filter((b) => b.expiry_broadcasted !== true)
                    )
                );
            }
            return Promise.resolve(result(batches));
        }),
        not: jest
            .fn()
            .mockImplementation((_col: string, _op: string, ids: string[]) =>
                Promise.resolve(result(batches.filter((b) => !ids.includes(b.id))))
            ),
    };
    return {
        in: jest.fn().mockResolvedValue(result(batches)),
        select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue(result(batches)),
            gte: jest.fn().mockImplementation((...args: unknown[]) => {
                gteSpy(...args);
                return {
                    lte: jest.fn().mockReturnValue(thenable),
                };
            }),
        }),
    };
}

/**
 * Build a notification_subscribers mock that supports the
 * .eq("is_active", true).eq("status", "active").eq("preference_frequency", [...]).range() chain.
 */
function mockSubscribersQuery(subscribers: any[]) {
    const mapped = subscribers.map((s) => ({
        status: "active",
        is_active: true,
        preference_frequency: s.preference_frequency ?? "immediate",
        ...s,
    }));
    return createSubscriberTable(mapped);
}

/** Mocks expiry_digest_deliveries reads (and optionally the upsert). */
function mockDeliveredQuery(delivered: any[] = [], opts: { upsert?: jest.Mock } = {}) {
    return {
        select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockResolvedValue({ data: delivered, error: null }),
            }),
        }),
        upsert: opts.upsert || jest.fn().mockResolvedValue({ data: null, error: null }),
    };
}

/**
 * Subscriber mock that returns a different page per preference_frequency,
 * mirroring the real query filter.
 */
function mockSubscribersByFrequency(subscribersByFreq: Record<string, any[]>) {
    const allSubs = Object.entries(subscribersByFreq).flatMap(([freq, subs]) =>
        subs.map((s) => ({
            status: "active",
            is_active: true,
            ...s,
            preference_frequency: freq,
        }))
    );
    return createSubscriberTable(allSubs);
}

// ---------------------------------------------------------------------------
// shouldSendForFrequency unit tests
// ---------------------------------------------------------------------------

describe("shouldSendForFrequency", () => {
    it("always returns true for 'immediate'", () => {
        expect(shouldSendForFrequency("immediate", new Date("2026-06-25T10:00:00Z"))).toBe(true);
    });

    it("returns true for 'daily' only during the daily digest hour", () => {
        const atDigestHour = new Date(2026, 5, 25, 8, 0, 0); // local 08:00
        const offHour = new Date(2026, 5, 25, 15, 0, 0); // local 15:00
        expect(shouldSendForFrequency("daily", atDigestHour)).toBe(true);
        expect(shouldSendForFrequency("daily", offHour)).toBe(false);
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

    it("skips pending subscribers when broadcasting an expiry alert", async () => {
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
                        in: jest.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                };
            }
            if (table === "notification_subscribers") {
                const subs = seedSubscribers("pending").map((s) => ({
                    ...s,
                    preference_frequency: "immediate",
                }));
                return createSubscriberTable(subs);
            }
            return {};
        });

        await broadcastExpiryAlerts(new Date(2026, 5, 25, 15, 0, 0));

        expect(notifiedPhones()).toEqual([VERIFIED_PHONE]);
    });

    it("starts sending expiry alerts once a pending subscriber verifies", async () => {
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
                        in: jest.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                };
            }
            if (table === "notification_subscribers") {
                const subs = seedSubscribers("active").map((s) => ({
                    ...s,
                    preference_frequency: "immediate",
                }));
                return createSubscriberTable(subs);
            }
            return {};
        });

        await broadcastExpiryAlerts(new Date(2026, 5, 25, 15, 0, 0));

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

        // Non-Monday, non-1st, off the daily digest hour — only "immediate" active.
        await broadcastExpiryAlerts(new Date(2026, 5, 25, 15, 0, 0));

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
                return createSubscriberTable(
                    [
                        {
                            id: "sub-1",
                            phone: "+910000000001",
                            language: "en",
                            channels: ["sms"],
                            is_active: true,
                            status: "active",
                            preference_frequency: "immediate",
                        },
                    ],
                    {
                        onRange: (from, to) => {
                            if (to > 0) callOrder.push("fetch_subscribers");
                        },
                    }
                );
            }
            return {};
        });

        // Non-Monday, non-1st, off the daily digest hour — only "immediate" active.
        await broadcastExpiryAlerts(new Date(2026, 5, 25, 15, 0, 0));

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

        // Non-Monday, non-1st, off the daily digest hour — only "immediate" active.
        await broadcastExpiryAlerts(new Date(2026, 5, 25, 15, 0, 0));

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

        // Non-Monday, non-1st, off the daily digest hour — only "immediate" active.
        await broadcastExpiryAlerts(new Date(2026, 5, 25, 15, 0, 0));

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

        // Non-Monday, non-1st, off the daily digest hour — only "immediate" active.
        await broadcastExpiryAlerts(new Date(2026, 5, 25, 15, 0, 0));

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

        // Non-Monday, non-1st, off the daily digest hour — only "immediate" active.
        await broadcastExpiryAlerts(new Date(2026, 5, 25, 15, 0, 0));

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
            // Non-Monday, non-1st, off the daily digest hour — only "immediate" active.
            await broadcastExpiryAlerts(new Date(2026, 5, 25, 15, 0, 0));
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

    it("only processes 'immediate' subscribers when run outside every digest window", async () => {
        // Thursday June 25 2026, 15:00 local — not Monday, not 1st, off digest hour
        const thursday = new Date(2026, 5, 25, 15, 0, 0);
        const capturedEqArgs: string[] = [];

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
            if (table === "expiry_digest_deliveries") return mockDeliveredQuery([]);
            if (table === "notification_subscribers") {
                return createSubscriberQueryMock(capturedEqArgs);
            }
            return {};
        });

        await broadcastExpiryAlerts(thursday);

        // Outside every digest window only "immediate" should be queried.
        expect(capturedEqArgs).toEqual(["immediate"]);
    });

    it("includes 'weekly' subscribers when run on a Monday", async () => {
        const monday = new Date(2026, 5, 22, 15, 0, 0); // Monday, off digest hour
        const capturedEqArgs: string[] = [];

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
            if (table === "expiry_digest_deliveries") return mockDeliveredQuery([]);
            if (table === "notification_subscribers") {
                return createSubscriberQueryMock(capturedEqArgs);
            }
            return {};
        });

        await broadcastExpiryAlerts(monday);

        expect(capturedEqArgs).toContain("weekly");
    });

    it("includes 'monthly' subscribers when run on the 1st of a month", async () => {
        const firstOfMonth = new Date(2026, 6, 1, 15, 0, 0); // 1st, off digest hour
        const capturedEqArgs: string[] = [];

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
            if (table === "expiry_digest_deliveries") return mockDeliveredQuery([]);
            if (table === "notification_subscribers") {
                return createSubscriberQueryMock(capturedEqArgs);
            }
            return {};
        });

        await broadcastExpiryAlerts(firstOfMonth);

        expect(capturedEqArgs).toContain("monthly");
    });

    it("does not send expiry alerts to 'weekly' subscribers on a non-Monday", async () => {
        const thursday = new Date(2026, 5, 25, 15, 0, 0);

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
            if (table === "expiry_digest_deliveries") return mockDeliveredQuery([]);
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
        const tuesday = new Date(2026, 5, 23, 15, 0, 0);
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
            if (table === "expiry_digest_deliveries") return mockDeliveredQuery([]);
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

    // -------------------------------------------------------------------------
    // per-frequency independence tests
    // -------------------------------------------------------------------------

    it("sends to weekly subscribers on Monday even when the batch was already delivered immediately", async () => {
        const monday = new Date(2026, 5, 22, 15, 0, 0); // Monday, off digest hour
        const batches = [
            {
                id: "batch-1",
                batch_number: "B1",
                expiry_date: "2026-07-01",
                expiry_broadcasted: true, // already delivered to immediate subscribers
                medicine: { brand_name: "Aspirin" },
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
            if (table === "expiry_digest_deliveries") return mockDeliveredQuery([]);
            if (table === "notification_subscribers") {
                return mockSubscribersByFrequency({
                    immediate: [],
                    weekly: [
                        {
                            id: "sub-weekly",
                            phone: "+910000000004",
                            language: "en",
                            channels: ["sms"],
                            is_active: true,
                            preference_frequency: "weekly",
                        },
                    ],
                });
            }
            return {};
        });

        await broadcastExpiryAlerts(monday);

        const sendMock = smsService.send as jest.Mock;
        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(sendMock.mock.calls[0][0]).toBe("+910000000004");
    });

    it("sends a daily digest at most once per calendar day", async () => {
        let deliveredRows: { batch_id: string }[] = [];
        const upsertSpy = jest.fn().mockImplementation((rows: any[]) => {
            deliveredRows = rows.map((r: any) => ({ batch_id: r.batch_id }));
            return Promise.resolve({ data: null, error: null });
        });

        const batches = [
            {
                id: "batch-1",
                batch_number: "B1",
                expiry_date: "2026-07-01",
                medicine: { brand_name: "Aspirin" },
            },
        ];
        const digestTime = new Date(2026, 5, 25, 8, 0, 0); // local 08:00 (daily digest hour)

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "batches") {
                return {
                    ...mockBatchesQuery(batches),
                    update: jest.fn().mockReturnValue({
                        in: jest.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                };
            }
            if (table === "expiry_digest_deliveries") {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            gte: jest.fn().mockResolvedValue({ data: deliveredRows, error: null }),
                        }),
                    }),
                    upsert: upsertSpy,
                };
            }
            if (table === "notification_subscribers") {
                return mockSubscribersByFrequency({
                    immediate: [],
                    daily: [
                        {
                            id: "sub-daily",
                            phone: "+910000000003",
                            language: "en",
                            channels: ["sms"],
                            is_active: true,
                            preference_frequency: "daily",
                        },
                    ],
                });
            }
            return {};
        });

        await broadcastExpiryAlerts(digestTime);
        expect(smsService.send).toHaveBeenCalledTimes(1);
        expect(upsertSpy).toHaveBeenCalledTimes(1);

        (smsService.send as jest.Mock).mockClear();

        // A second run inside the same day must not re-deliver the digest.
        await broadcastExpiryAlerts(digestTime);
        expect(smsService.send).not.toHaveBeenCalled();
    });
});
