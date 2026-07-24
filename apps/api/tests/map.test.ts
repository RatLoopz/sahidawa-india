import express from "express";
import request from "supertest";
import mapRouter from "../src/routes/map";
import { supabase } from "../src/db/client";

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockLimit = jest.fn();
const mockFrom = jest.fn();

jest.mock("../src/db/client", () => ({
    supabase: {
        rpc: jest.fn(),
        from: (table: string) => mockFrom(table),
    },
}));

jest.mock("../src/utils/logger", () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

import logger from "../src/utils/logger";

const rpcMock = supabase.rpc as jest.Mock;

function buildApp() {
    const app = express();
    app.use("/api/map", mapRouter);
    return app;
}

describe("GET /api/map/nearby", () => {
    const app = buildApp();

    beforeEach(() => {
        jest.clearAllMocks();
        mockFrom.mockReturnValue({
            select: mockSelect,
        });
        mockSelect.mockReturnValue({
            eq: mockEq,
            limit: mockLimit,
        });
        mockEq.mockReturnValue({
            eq: mockEq,
            limit: mockLimit,
        });
        mockLimit.mockResolvedValue({ data: [], error: null });
    });

    it("should return Cache-Control header", async () => {
        const response = await request(app).get("/api/map/nearby?lat=north&lng=east");

        expect(response.headers["cache-control"]).toContain("public");
    });

    it.each([
        ["lat", "/api/map/nearby?lng=73.8567"],
        ["lng", "/api/map/nearby?lat=18.5204"],
        ["lat and lng", "/api/map/nearby"],
    ])("returns 400 when %s query params are missing", async (_missing, path) => {
        const response = await request(app).get(path);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "lat and lng are required query params" });
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it("returns 400 when coordinates are non-numeric", async () => {
        const response = await request(app).get("/api/map/nearby?lat=north&lng=east");

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "lat and lng are required query params" });
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it("returns canonical PostGIS pharmacies and preserves an empty ASHA key", async () => {
        const rpcPharmacies = [
            {
                id: "9cb1ba95-ae3c-4c8b-a6f8-c02d1b447b94",
                name: "Jan Aushadhi Kendra Pune",
                address: "Shivajinagar",
                district: "Pune",
                state: "Maharashtra",
                phone_number: "+912012345678",
                is_verified: true,
                lat: 18.521,
                lng: 73.855,
                distance: 1.24,
            },
        ];

        rpcMock
            .mockResolvedValueOnce({ data: rpcPharmacies, error: null })
            .mockResolvedValueOnce({ data: [], error: null });

        const response = await request(app).get(
            "/api/map/nearby?lat=18.5204&lng=73.8567&radius_km=5"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            pharmacies: [
                {
                    id: "9cb1ba95-ae3c-4c8b-a6f8-c02d1b447b94",
                    name: "Jan Aushadhi Kendra Pune",
                    type: "Jan Aushadhi",
                    lat: 18.521,
                    lng: 73.855,
                    address: "Shivajinagar",
                    district: "Pune",
                    state: "Maharashtra",
                    phone_number: "+912012345678",
                    is_verified: true,
                    verified: true,
                    distance: 1.24,
                    distance_km: 1.24,
                },
            ],
            asha_workers: [],
        });
        expect(rpcMock).toHaveBeenCalledTimes(2);
        expect(rpcMock).toHaveBeenCalledWith("get_nearest_pharmacies", {
            query_lat: 18.5204,
            query_lng: 73.8567,
            search_radius_km: 5,
        });
        expect(rpcMock).toHaveBeenCalledWith("get_nearest_asha_workers", {
            query_lat: 18.5204,
            query_lng: 73.8567,
            search_radius_km: 5,
        });
    });

    it("uses a default 10 km radius when radius_km is omitted", async () => {
        rpcMock
            .mockResolvedValueOnce({ data: [], error: null })
            .mockResolvedValueOnce({ data: [], error: null });

        const response = await request(app).get("/api/map/nearby?lat=18.5204&lng=73.8567");

        expect(response.status).toBe(200);
        expect(rpcMock).toHaveBeenCalledTimes(2);
        expect(rpcMock).toHaveBeenCalledWith("get_nearest_pharmacies", {
            query_lat: 18.5204,
            query_lng: 73.8567,
            search_radius_km: 10,
        });
        expect(rpcMock).toHaveBeenCalledWith("get_nearest_asha_workers", {
            query_lat: 18.5204,
            query_lng: 73.8567,
            search_radius_km: 10,
        });
    });

    it("returns fallback pharmacies and ASHA workers when Supabase RPC reports an error", async () => {
        try {
            rpcMock.mockResolvedValueOnce({
                data: null,
                error: { message: "PostGIS function unavailable" },
            }).mockResolvedValueOnce({
                data: null,
                error: { message: "PostGIS function unavailable" },
            });

            mockLimit.mockResolvedValueOnce({
                data: [
                    {
                        id: "9cb1ba95-ae3c-4c8b-a6f8-c02d1b447b94",
                        name: "Jan Aushadhi Kendra Pune",
                        address: "Shivajinagar",
                        district: "Pune",
                        state: "Maharashtra",
                        phone_number: "+912012345678",
                        is_verified: true,
                        location: { type: "Point", coordinates: [73.855, 18.521] },
                        status: "approved",
                        is_active: true,
                    },
                ],
                error: null,
            }).mockResolvedValueOnce({
                data: [
                    {
                        id: "asha-worker-1",
                        name: "Asha Worker Pune",
                        district: "Pune",
                        state: "Maharashtra",
                        phone_number: "+912087654321",
                        location: { type: "Point", coordinates: [73.855, 18.521] },
                    },
                ],
                error: null,
            });

            const response = await request(app).get(
                "/api/map/nearby?lat=18.5204&lng=73.8567&radius_km=5"
            );

            expect(response.status).toBe(200);
            expect(response.body.pharmacies).toHaveLength(1);
            expect(response.body.pharmacies[0].name).toBe("Jan Aushadhi Kendra Pune");
            expect(response.body.asha_workers).toHaveLength(1);
            expect(response.body.asha_workers[0].name).toBe("Asha Worker Pune");
            expect(mockFrom).toHaveBeenCalledWith("pharmacies");
            expect(mockFrom).toHaveBeenCalledWith("asha_workers");
            expect(logger.warn).toHaveBeenCalledTimes(2);
        } finally {
            (logger.warn as jest.Mock).mockClear();
        }
    });
});
