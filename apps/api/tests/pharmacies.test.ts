process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";

(global as any).WebSocket = (global as any).WebSocket || class {};

jest.mock("../src/db/supabase", () => ({
    __esModule: true,
    default: {
        rpc: jest.fn(),
        from: jest.fn(),
    },
}));

import request from "supertest";
import app from "../src/app";
import supabase from "../src/db/supabase";

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

describe("GET /api/pharmacies/nearest", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns 400 when latitude or longitude is missing", async () => {
        const missingLatitude = await request(app).get("/api/pharmacies/nearest?lng=77.5946");
        const missingLongitude = await request(app).get("/api/pharmacies/nearest?lat=12.9716");

        expect(missingLatitude.status).toBe(400);
        expect(missingLatitude.body.error).toBe("Invalid coordinates");
        expect(missingLatitude.body.details).toHaveProperty("lat");

        expect(missingLongitude.status).toBe(400);
        expect(missingLongitude.body.error).toBe("Invalid coordinates");
        expect(missingLongitude.body.details).toHaveProperty("lng");
    });

    it("returns 400 for out-of-bounds coordinates", async () => {
        const response = await request(app).get("/api/pharmacies/nearest?lat=91&lng=181");

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid coordinates");
        expect(response.body.details).toHaveProperty("lat");
        expect(response.body.details).toHaveProperty("lng");
    });

    it("returns 400 when non-numeric coordinates are provided", async () => {
        const response = await request(app).get("/api/pharmacies/nearest?lat=north&lng=east");

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid coordinates");
        expect(response.body.details).toHaveProperty("lat");
        expect(response.body.details).toHaveProperty("lng");
    });

    it("falls back to Haversine distance filtering and sorts nearby pharmacies", async () => {
        mockedSupabase.rpc.mockResolvedValueOnce({
            data: null,
            error: { message: "RPC unavailable" },
        } as never);

        const limit = jest.fn().mockResolvedValueOnce({
            data: [
                {
                    name: "Nearby Pharmacy",
                    address: "MG Road",
                    lat: 12.972,
                    lng: 77.595,
                    phone_number: "1111111111",
                    is_verified: true,
                    district: "Bengaluru Urban",
                    state: "Karnataka",
                },
                {
                    name: "Far Pharmacy",
                    address: "Far Away",
                    lat: 13.5,
                    lng: 78.2,
                    phone_number: "2222222222",
                    is_verified: false,
                    district: "Bengaluru Rural",
                    state: "Karnataka",
                },
                {
                    name: "Mid Pharmacy",
                    address: "Indiranagar",
                    location: {
                        type: "Point",
                        coordinates: [77.64, 12.98],
                    },
                    phone_number: null,
                    is_verified: true,
                    district: "Bengaluru Urban",
                    state: "Karnataka",
                },
            ],
            error: null,
        });

        const select = jest.fn().mockReturnValue({
            limit,
        });

        mockedSupabase.from.mockReturnValueOnce({ select } as never);

        const response = await request(app).get(
            "/api/pharmacies/nearest?lat=12.9716&lng=77.5946&radius=10"
        );

        expect(response.status).toBe(200);

        expect(mockedSupabase.rpc).toHaveBeenCalledWith(
            "get_nearest_pharmacies",
            {
                query_lat: 12.9716,
                query_lng: 77.5946,
            }
        );

        expect(mockedSupabase.from).toHaveBeenCalledWith("pharmacies");

     expect(select).toHaveBeenCalledWith(
    "name, address, location, phone_number, is_verified, district, state"
);

        expect(limit).toHaveBeenCalled();

        expect(response.body.pharmacies).toHaveLength(2);

        expect(
            response.body.pharmacies.map(
                (pharmacy: { name: string }) => pharmacy.name
            )
        ).toEqual([
            "Nearby Pharmacy",
            "Mid Pharmacy",
        ]);

        expect(response.body.pharmacies[0]).not.toHaveProperty("rawDistance");
    });
});