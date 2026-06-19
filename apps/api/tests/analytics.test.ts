import request from "supertest";
import app from "../src/app";

jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        gte: jest.fn(),
    },
}));

let mockAuthRole: "admin" | "moderator" | "user" = "admin";

jest.mock("../src/middleware/auth", () => ({
    requireAuth: (req: any, res: any, next: any) => {
        const token = req.headers.authorization?.slice(7);
        if (!token) {
            return res.status(401).json({ error: "Unauthorized: Missing access token" });
        }
        req.user = {
            id: "test-user-id",
            email: "test@example.com",
            role: mockAuthRole,
        };
        return next();
    },
    requireRole:
        (...roles: string[]) =>
        (req: any, res: any, next: any) => {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication is required" });
            }
            if (!roles.includes(req.user.role)) {
                return res.status(403).json({ error: "Insufficient permissions" });
            }
            return next();
        },
    optionalAuth: (_req: any, _res: any, next: any) => next(),
}));

import { supabase } from "../src/db/client";

type MockScan = {
    latitude: string;
    longitude: string;
    created_at: string;
};
type MockPushEvent = {
    status: "sent" | "failed";
    http_status: number | null;
    failure_reason: string | null;
    occurred_at: string;
};

type HeatmapSupabaseMock = {
    from: jest.Mock;
    select: jest.Mock;
    not: jest.Mock;
    gte: jest.Mock;
};

const mockedSupabase = supabase as unknown as HeatmapSupabaseMock;

function mockHeatmapRows(rows: MockScan[]) {
    mockedSupabase.gte.mockResolvedValueOnce({
        data: rows,
        error: null,
    });
}

function mockPushRows(rows: MockPushEvent[]) {
    mockedSupabase.gte.mockResolvedValueOnce({
        data: rows,
        error: null,
    });
}

describe("GET /api/analytics/heatmap", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("returns a GeoJSON FeatureCollection with Point features", async () => {
        mockHeatmapRows([
            {
                latitude: "28.6139",
                longitude: "77.2090",
                created_at: "2026-06-05T10:00:00.000Z",
            },
        ]);

        const response = await request(app)
            .get("/api/analytics/heatmap")
            .set("Authorization", "Bearer admin-token");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [77.21, 28.61],
                    },
                    properties: {
                        intensity: 1,
                    },
                },
            ],
        });
    });

    it("rounds nearby coordinates to two decimals and groups their intensity", async () => {
        mockHeatmapRows([
            {
                latitude: "28.1234567",
                longitude: "77.9876543",
                created_at: "2026-06-05T10:00:00.000Z",
            },
            {
                latitude: "28.1241111",
                longitude: "77.9859999",
                created_at: "2026-06-05T10:05:00.000Z",
            },
        ]);

        const response = await request(app)
            .get("/api/analytics/heatmap?days=7")
            .set("Authorization", "Bearer admin-token");

        expect(response.status).toBe(200);
        expect(response.body.features).toEqual([
            {
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [77.99, 28.12],
                },
                properties: {
                    intensity: 2,
                },
            },
        ]);
    });

    it("returns an empty FeatureCollection when no incidents have coordinates", async () => {
        mockHeatmapRows([]);

        const response = await request(app)
            .get("/api/analytics/heatmap")
            .set("Authorization", "Bearer admin-token");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            type: "FeatureCollection",
            features: [],
        });
    });

    it("transforms multiple coordinate groups into multiple GeoJSON features", async () => {
        mockHeatmapRows([
            {
                latitude: "19.0760",
                longitude: "72.8777",
                created_at: "2026-06-05T10:00:00.000Z",
            },
            {
                latitude: "12.9716",
                longitude: "77.5946",
                created_at: "2026-06-05T11:00:00.000Z",
            },
            {
                latitude: "12.9730",
                longitude: "77.5920",
                created_at: "2026-06-05T12:00:00.000Z",
            },
        ]);

        const response = await request(app)
            .get("/api/analytics/heatmap")
            .set("Authorization", "Bearer admin-token");

        expect(response.status).toBe(200);
        expect(response.body.features).toHaveLength(2);
        expect(response.body.features).toEqual([
            {
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [72.88, 19.08],
                },
                properties: {
                    intensity: 1,
                },
            },
            {
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [77.59, 12.97],
                },
                properties: {
                    intensity: 2,
                },
            },
        ]);
    });

    it("queries recent scan coordinates and excludes null latitude or longitude values", async () => {
        jest.spyOn(Date, "now").mockReturnValue(new Date("2026-06-05T12:00:00.000Z").getTime());
        mockHeatmapRows([]);

        const response = await request(app)
            .get("/api/analytics/heatmap?days=3")
            .set("Authorization", "Bearer admin-token");

        expect(response.status).toBe(200);
        expect(mockedSupabase.from).toHaveBeenCalledWith("scan_history");
        expect(mockedSupabase.select).toHaveBeenCalledWith("latitude, longitude, created_at");
        expect(mockedSupabase.not).toHaveBeenCalledWith("latitude", "is", null);
        expect(mockedSupabase.not).toHaveBeenCalledWith("longitude", "is", null);
        expect(mockedSupabase.gte).toHaveBeenCalledWith("created_at", "2026-06-02T12:00:00.000Z");
    });
});

describe("GET /api/analytics/push-notifications", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthRole = "admin";
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("summarizes push delivery rate and failure reasons for the requested window", async () => {
        jest.spyOn(Date, "now").mockReturnValue(new Date("2026-06-05T12:00:00.000Z").getTime());
        mockPushRows([
            {
                status: "sent",
                http_status: null,
                failure_reason: null,
                occurred_at: "2026-06-05T10:00:00.000Z",
            },
            {
                status: "sent",
                http_status: null,
                failure_reason: null,
                occurred_at: "2026-06-05T10:01:00.000Z",
            },
            {
                status: "failed",
                http_status: 410,
                failure_reason: "410 Gone",
                occurred_at: "2026-06-05T10:02:00.000Z",
            },
            {
                status: "failed",
                http_status: 404,
                failure_reason: "404 Not Found",
                occurred_at: "2026-06-05T10:03:00.000Z",
            },
            {
                status: "failed",
                http_status: 410,
                failure_reason: "410 Gone",
                occurred_at: "2026-06-05T10:04:00.000Z",
            },
        ]);

        const response = await request(app)
            .get("/api/v1/admin/push-notifications/analytics?days=7")
            .set("Authorization", "Bearer admin-token");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            days: 7,
            since: "2026-05-29T12:00:00.000Z",
            attempted: 5,
            sent: 2,
            failed: 3,
            deliveryRate: 0.4,
            failureReasons: [
                {
                    reason: "410 Gone",
                    httpStatus: 410,
                    count: 2,
                    rate: 0.667,
                },
                {
                    reason: "404 Not Found",
                    httpStatus: 404,
                    count: 1,
                    rate: 0.333,
                },
            ],
        });
        expect(mockedSupabase.from).toHaveBeenCalledWith("push_notification_events");
        expect(mockedSupabase.select).toHaveBeenCalledWith(
            "status, http_status, failure_reason, occurred_at"
        );
        expect(mockedSupabase.gte).toHaveBeenCalledWith("occurred_at", "2026-05-29T12:00:00.000Z");
    });

    it("returns zeroed push analytics when no delivery events exist", async () => {
        mockPushRows([]);

        const response = await request(app)
            .get("/api/v1/admin/push-notifications/analytics")
            .set("Authorization", "Bearer admin-token");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            attempted: 0,
            sent: 0,
            failed: 0,
            deliveryRate: 0,
            failureReasons: [],
        });
    });

    it("returns 500 when push analytics cannot be fetched", async () => {
        mockedSupabase.gte.mockResolvedValueOnce({
            data: null,
            error: { message: "missing push_notification_events table" },
        });

        const response = await request(app)
            .get("/api/v1/admin/push-notifications/analytics")
            .set("Authorization", "Bearer admin-token");

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Failed to fetch push notification analytics" });
    });

    it("rejects unauthenticated push analytics requests", async () => {
        const response = await request(app).get("/api/v1/admin/push-notifications/analytics");

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: "Unauthorized: Missing access token" });
    });

    it("rejects non-admin push analytics requests", async () => {
        mockAuthRole = "user";

        const response = await request(app)
            .get("/api/v1/admin/push-notifications/analytics")
            .set("Authorization", "Bearer user-token");

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: "Insufficient permissions" });
    });

    it("does not expose push analytics on the public analytics router", async () => {
        const response = await request(app).get("/api/analytics/push-notifications");

        expect(response.status).toBe(401);
    });
});
