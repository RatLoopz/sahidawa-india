import express from "express";
import request from "supertest";
import mapRouter from "../src/routes/map";
import { supabase } from "../src/db/client";

jest.mock("../src/db/client", () => ({
    supabase: {
        rpc: jest.fn(),
    },
}));

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

    it("returns nearby pharmacies and ASHA workers from PostGIS RPC responses", async () => {
        const pharmacies = [
            {
                id: 1,
                name: "Jan Aushadhi Kendra Pune",
                type: "Jan Aushadhi",
                lat: 18.5204,
                lng: 73.8567,
                address: "Shivajinagar",
                district: "Pune",
                state: "Maharashtra",
                verified: true,
                distance_km: 1.24,
            },
        ];
        const ashaWorkers = [
            {
                id: 11,
                name: "Meera Patil",
                district: "Pune",
                lat: 18.521,
                lng: 73.855,
                contact: "+919876543210",
                distance_km: 0.72,
            },
        ];

        rpcMock
            .mockResolvedValueOnce({ data: pharmacies, error: null })
            .mockResolvedValueOnce({ data: ashaWorkers, error: null });

        const response = await request(app).get(
            "/api/map/nearby?lat=18.5204&lng=73.8567&radius_km=5"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            pharmacies,
            asha_workers: ashaWorkers,
        });
        expect(rpcMock).toHaveBeenNthCalledWith(1, "get_nearby_pharmacies", {
            user_lat: 18.5204,
            user_lng: 73.8567,
            radius_m: 5000,
        });
        expect(rpcMock).toHaveBeenNthCalledWith(2, "get_nearby_asha_workers", {
            user_lat: 18.5204,
            user_lng: 73.8567,
            radius_m: 5000,
        });
    });

    it("uses a default 10 km radius when radius_km is omitted", async () => {
        rpcMock.mockResolvedValue({ data: [], error: null });

        const response = await request(app).get("/api/map/nearby?lat=18.5204&lng=73.8567");

        expect(response.status).toBe(200);
        expect(rpcMock).toHaveBeenNthCalledWith(1, "get_nearby_pharmacies", {
            user_lat: 18.5204,
            user_lng: 73.8567,
            radius_m: 10000,
        });
        expect(rpcMock).toHaveBeenNthCalledWith(2, "get_nearby_asha_workers", {
            user_lat: 18.5204,
            user_lng: 73.8567,
            radius_m: 10000,
        });
    });

    it("returns 500 when a Supabase RPC reports an error", async () => {
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

        try {
            rpcMock
                .mockResolvedValueOnce({
                    data: null,
                    error: { message: "PostGIS function unavailable" },
                })
                .mockResolvedValueOnce({ data: [], error: null });

            const response = await request(app).get(
                "/api/map/nearby?lat=18.5204&lng=73.8567&radius_km=5"
            );

            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: "Internal server error" });
            expect(consoleErrorSpy).toHaveBeenCalledWith({
                message: "PostGIS function unavailable",
            });
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });
});
