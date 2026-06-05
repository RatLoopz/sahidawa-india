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

import { supabase } from "../src/db/client";

type MockScan = {
    latitude: string;
    longitude: string;
    created_at: string;
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

        const response = await request(app).get("/api/analytics/heatmap");

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

        const response = await request(app).get("/api/analytics/heatmap?days=7");

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

        const response = await request(app).get("/api/analytics/heatmap");

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

        const response = await request(app).get("/api/analytics/heatmap");

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

        const response = await request(app).get("/api/analytics/heatmap?days=3");

        expect(response.status).toBe(200);
        expect(mockedSupabase.from).toHaveBeenCalledWith("scan_history");
        expect(mockedSupabase.select).toHaveBeenCalledWith("latitude, longitude, created_at");
        expect(mockedSupabase.not).toHaveBeenCalledWith("latitude", "is", null);
        expect(mockedSupabase.not).toHaveBeenCalledWith("longitude", "is", null);
        expect(mockedSupabase.gte).toHaveBeenCalledWith("created_at", "2026-06-02T12:00:00.000Z");
    });
});
