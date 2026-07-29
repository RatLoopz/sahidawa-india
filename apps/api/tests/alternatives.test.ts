import request from "supertest";
import app from "../src/app";

// Mocks the supabase client so it doesn't depend on a live database
jest.mock("../src/db/client", () => {
    return {
        supabase: {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            ilike: jest.fn().mockReturnThis(),
            or: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn(),
            rpc: jest.fn(),
        },
    };
});

import { supabase } from "../src/db/client";

describe("GET /api/v1/alternatives/:medicine_id", () => {
    const mockAlternativeLookup = () => {
        ((supabase.from as jest.Mock)().maybeSingle as jest.Mock)
            .mockResolvedValueOnce({
                data: {
                    id: "med-123",
                    brand_name: "Lipitor",
                    generic_name: "Atorvastatin 10mg",
                    mrp: 120.0,
                    jan_aushadhi_price: 15.0,
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    brand_medicine_id: "med-123",
                    generic_medicine_id: "gen-456",
                    brand_name: "Lipitor",
                    generic_name: "Atorvastatin 10mg (Generic)",
                    brand_price: 120.0,
                    jan_aushadhi_price: 15.0,
                    savings_percentage: 88,
                },
                error: null,
            });
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return Cache-Control header", async () => {
        // Out-of-range coordinates short-circuit with 400 before any DB call,
        // but cacheMiddleware runs upstream of that validation.
        const res = await request(app)
            .get("/api/v1/alternatives/Lipitor")
            .query({ lat: 999, lng: 999 });

        expect(res.headers["cache-control"]).toContain("public");
    });

    it("returns null nearest_store without coordinates and skips pharmacy lookup", async () => {
        mockAlternativeLookup();

        const res = await request(app).get("/api/v1/alternatives/Lipitor");

        expect(res.status).toBe(200);
        expect(res.body.nearest_store).toBeNull();
        expect(supabase.rpc).not.toHaveBeenCalled();
        expect(supabase.from).not.toHaveBeenCalledWith("pharmacies");
    });

    it("returns the nearest store from a successful coordinate lookup", async () => {
        mockAlternativeLookup();

        (supabase.rpc as jest.Mock).mockResolvedValueOnce({
            data: [
                {
                    name: "PMBJP Store 1",
                    lat: "12.97",
                    lng: "77.59",
                    distance: "2.54",
                },
            ],
            error: null,
        });

        const res = await request(app)
            .get("/api/v1/alternatives/Lipitor")
            .query({ lat: 12.97, lng: 77.59 });

        expect(res.status).toBe(200);
        expect(res.body.brand_name).toBe("Lipitor");
        expect(res.body.savings_percentage).toBe(88);
        expect(res.body.nearest_store).toEqual({
            name: "PMBJP Store 1",
            lat: 12.97,
            lng: 77.59,
            distance: "2.5 km",
        });
        expect(supabase.from).not.toHaveBeenCalledWith("pharmacies");
    });

    it("returns null nearest_store when the coordinate lookup is empty", async () => {
        mockAlternativeLookup();
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

        const res = await request(app)
            .get("/api/v1/alternatives/Lipitor")
            .query({ lat: 12.97, lng: 77.59 });

        expect(res.status).toBe(200);
        expect(res.body.nearest_store).toBeNull();
        expect(supabase.from).not.toHaveBeenCalledWith("pharmacies");
    });

    it("preserves the alternative response when the coordinate lookup fails", async () => {
        mockAlternativeLookup();
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({
            data: null,
            error: { message: "RPC unavailable" },
        });

        const res = await request(app)
            .get("/api/v1/alternatives/Lipitor")
            .query({ lat: 12.97, lng: 77.59 });

        expect(res.status).toBe(200);
        expect(res.body.brand_name).toBe("Lipitor");
        expect(res.body.nearest_store).toBeNull();
        expect(supabase.from).not.toHaveBeenCalledWith("pharmacies");
    });

    it("keeps the existing 404 response when no generic alternative exists", async () => {
        ((supabase.from as jest.Mock)().maybeSingle as jest.Mock)
            .mockResolvedValueOnce({ data: null, error: null })
            .mockResolvedValueOnce({ data: null, error: null })
            .mockResolvedValueOnce({ data: null, error: null });

        const res = await request(app).get("/api/v1/alternatives/UnknownMedicine");

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("No generic alternative found for this medicine");
        expect(supabase.rpc).not.toHaveBeenCalled();
        expect(supabase.from).not.toHaveBeenCalledWith("pharmacies");
    });
});
