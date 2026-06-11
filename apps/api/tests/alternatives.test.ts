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
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return generic alternative mapping and nearest store information", async () => {
        // Mock medicine lookup
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
            // Mock alternative lookup
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

        // Mock nearest store RPC call
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({
            data: [
                {
                    name: "PMBJP Store 1",
                    lat: 12.97,
                    lng: 77.59,
                    distance: 2.5,
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
        expect(res.body.nearest_store.name).toBe("PMBJP Store 1");
    });
});
