const mockSchedule = jest.fn();
const mockFrom = jest.fn();
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

jest.mock("node-cron", () => ({
    schedule: mockSchedule,
}));

jest.mock("../src/db/client", () => ({
    supabase: {
        from: mockFrom,
    },
}));

jest.mock("../src/utils/logger", () => ({
    __esModule: true,
    default: mockLogger,
}));

import { syncDistrictAlertTallies } from "../src/cron/districtAlertSync";

type QueryResult<T> = {
    data: T;
    error: { message: string } | null;
};

type ReportRow = {
    district: string | null;
    reported_brand_name: string | null;
};

type AlertRow = {
    id: string;
    district: string;
    medicine_name: string | null;
    alert_level: "low" | "medium" | "high" | null;
};

function resolved<T>(data: T, error: QueryResult<T>["error"] = null): Promise<QueryResult<T>> {
    return Promise.resolve({ data, error });
}

function createReportsQuery(result: Promise<QueryResult<ReportRow[]>>) {
    const or = jest.fn().mockReturnValue(result);
    const not = jest.fn().mockReturnValue({ or });
    const secondEq = jest.fn().mockReturnValue({ not });
    const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
    const select = jest.fn().mockReturnValue({ eq: firstEq });

    return { query: { select }, select, firstEq, secondEq, not, or };
}

function createActiveAlertsQuery(result: Promise<QueryResult<AlertRow[]>>) {
    const eq = jest.fn().mockReturnValue(result);
    const select = jest.fn().mockReturnValue({ eq });

    return { query: { select }, select, eq };
}

function createUpsertQuery(result: Promise<QueryResult<null>>) {
    const upsert = jest.fn().mockReturnValue(result);

    return { query: { upsert }, upsert };
}

function createStaleUpdateQuery(result: Promise<QueryResult<null>>) {
    const inFilter = jest.fn().mockReturnValue(result);
    const update = jest.fn().mockReturnValue({ in: inFilter });

    return { query: { update }, update, inFilter };
}

describe("syncDistrictAlertTallies", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers().setSystemTime(new Date("2026-07-11T10:30:00.000Z"));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("uses constant batched queries for alert upserts and stale deactivation", async () => {
        const reports = [
            ...Array.from({ length: 10 }, () => ({
                district: "Pune",
                reported_brand_name: "Med A",
            })),
            ...Array.from({ length: 5 }, () => ({
                district: "Pune",
                reported_brand_name: "Med B",
            })),
            { district: "Mumbai", reported_brand_name: "Med C" },
        ];
        const activeAlerts = [
            { id: "alert-1", district: "Pune", medicine_name: "Med A", alert_level: "medium" },
            { id: "alert-2", district: "Nagpur", medicine_name: "Old Med", alert_level: "low" },
        ] satisfies AlertRow[];

        const reportsQuery = createReportsQuery(resolved(reports));
        const activeAlertsQuery = createActiveAlertsQuery(resolved(activeAlerts));
        const upsertQuery = createUpsertQuery(resolved(null));
        const staleUpdateQuery = createStaleUpdateQuery(resolved(null));
        const districtAlertQueries = [
            activeAlertsQuery.query,
            upsertQuery.query,
            staleUpdateQuery.query,
        ];

        mockFrom.mockImplementation((table: string) => {
            if (table === "counterfeit_reports") return reportsQuery.query;
            if (table === "district_alerts") return districtAlertQueries.shift();
            throw new Error(`Unexpected table: ${table}`);
        });

        await syncDistrictAlertTallies();

        expect(mockFrom).toHaveBeenCalledTimes(4);
        expect(reportsQuery.select).toHaveBeenCalledTimes(1);
        expect(activeAlertsQuery.select).toHaveBeenCalledTimes(1);
        expect(upsertQuery.upsert).toHaveBeenCalledTimes(1);
        expect(staleUpdateQuery.update).toHaveBeenCalledTimes(1);
        expect(staleUpdateQuery.inFilter).toHaveBeenCalledWith("id", ["alert-2"]);
        expect(upsertQuery.upsert).toHaveBeenCalledWith(
            [
                {
                    district: "Pune",
                    medicine_name: "Med A",
                    alert_level: "high",
                    previous_alert_level: "medium",
                    is_active: true,
                    updated_at: "2026-07-11T10:30:00.000Z",
                },
                {
                    district: "Pune",
                    medicine_name: "Med B",
                    alert_level: "medium",
                    previous_alert_level: null,
                    is_active: true,
                    updated_at: "2026-07-11T10:30:00.000Z",
                },
                {
                    district: "Mumbai",
                    medicine_name: "Med C",
                    alert_level: "low",
                    previous_alert_level: null,
                    is_active: true,
                    updated_at: "2026-07-11T10:30:00.000Z",
                },
            ],
            { onConflict: "district,medicine_name" }
        );
    });

    it("stops before mutating alerts when the active-alert bulk select fails", async () => {
        const reportsQuery = createReportsQuery(
            resolved([{ district: "Pune", reported_brand_name: "Med A" }])
        );
        const activeAlertsQuery = createActiveAlertsQuery(
            resolved([], { message: "database unavailable" })
        );
        const upsertQuery = createUpsertQuery(resolved(null));

        const districtAlertQueries = [activeAlertsQuery.query, upsertQuery.query];
        mockFrom.mockImplementation((table: string) => {
            if (table === "counterfeit_reports") return reportsQuery.query;
            if (table === "district_alerts") return districtAlertQueries.shift();
            throw new Error(`Unexpected table: ${table}`);
        });

        await syncDistrictAlertTallies();

        expect(mockFrom).toHaveBeenCalledTimes(2);
        expect(upsertQuery.upsert).not.toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalledWith(
            "District alert sync: failed to fetch active alerts",
            { error: "database unavailable" }
        );
    });
});
