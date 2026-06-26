process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";

(global as any).WebSocket = (global as any).WebSocket || class {};

jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
        rpc: jest.fn(),
    },
}));

jest.mock("../src/middleware/auth", () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: "test-user-uuid", role: "user", email: "user@example.com" };
        next();
    },
    optionalAuth: (_req: any, _res: any, next: any) => next(),
    requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

import request from "supertest";
import app from "../src/app";
import { supabase } from "../src/db/client";

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;
const GEOSPATIAL_CACHE_CONTROL = "public, max-age=300, s-maxage=300, stale-while-revalidate=600";

describe("GET /api/pharmacies/nearest", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── Validation tests ─────────────────────────────────────────────────
    it("should return Cache-Control header", async () => {
        const response = await request(app).get("/api/pharmacies/nearest").query({
            lat: 28.6,
            lng: 77.2,
            radius: 5,
        });

        expect(response.headers["cache-control"]).toContain("public");
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

    // ── PostGIS RPC happy path tests ─────────────────────────────────────

    it("returns pharmacies from PostGIS RPC when available", async () => {
        mockedSupabase.rpc.mockResolvedValueOnce({
            data: [
                {
                    id: "11111111-1111-1111-1111-111111111111",
                    name: "PMBJAK - AIIMS",
                    address: "Ansari Nagar, New Delhi",
                    district: "South Delhi",
                    state: "Delhi",
                    phone_number: "011-26588500",
                    is_verified: true,
                    lat: 28.5672,
                    lng: 77.2088,
                    distance: 2.34,
                },
                {
                    id: "22222222-2222-2222-2222-222222222222",
                    name: "PMBJAK - RML Hospital",
                    address: "Baba Kharak Singh Marg, New Delhi",
                    district: "New Delhi",
                    state: "Delhi",
                    phone_number: "011-23404446",
                    is_verified: true,
                    lat: 28.6268,
                    lng: 77.209,
                    distance: 5.12,
                },
            ],
            error: null,
        } as never);

        const response = await request(app).get(
            "/api/pharmacies/nearest?lat=28.6304&lng=77.2177&radius=10"
        );

        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe(GEOSPATIAL_CACHE_CONTROL);
        expect(response.body.pharmacies).toHaveLength(2);
        expect(response.body.pharmacies[0].name).toBe("PMBJAK - AIIMS");
        expect(response.body.pharmacies[0].distance).toBe("2.3 km");
        expect(response.body.pharmacies[1].name).toBe("PMBJAK - RML Hospital");
        expect(response.body.pharmacies[1].distance).toBe("5.1 km");

        // Should NOT fall through to the from() fallback
        expect(mockedSupabase.from).not.toHaveBeenCalled();
    });

    it("passes search_radius_km to the PostGIS RPC call", async () => {
        mockedSupabase.rpc.mockResolvedValueOnce({
            data: [],
            error: null,
        } as never);

        await request(app).get("/api/pharmacies/nearest?lat=28.6304&lng=77.2177&radius=25");

        expect(mockedSupabase.rpc).toHaveBeenCalledWith("get_nearest_pharmacies", {
            query_lat: 28.6304,
            query_lng: 77.2177,
            search_radius_km: 25,
        });
    });

    it("uses default radius of 50 km when not specified", async () => {
        mockedSupabase.rpc.mockResolvedValueOnce({
            data: [],
            error: null,
        } as never);

        await request(app).get("/api/pharmacies/nearest?lat=28.6304&lng=77.2177");

        expect(mockedSupabase.rpc).toHaveBeenCalledWith("get_nearest_pharmacies", {
            query_lat: 28.6304,
            query_lng: 77.2177,
            search_radius_km: 50,
        });
    });

    it("returns empty array when no pharmacies are within radius", async () => {
        mockedSupabase.rpc.mockResolvedValueOnce({
            data: [],
            error: null,
        } as never);

        const response = await request(app).get("/api/pharmacies/nearest?lat=0&lng=0&radius=1");

        expect(response.status).toBe(200);
        expect(response.body.pharmacies).toEqual([]);
    });

    it("does not expose rawDistance in the response", async () => {
        mockedSupabase.rpc.mockResolvedValueOnce({
            data: [
                {
                    id: "11111111-1111-1111-1111-111111111111",
                    name: "Test Pharmacy",
                    address: "Test Address",
                    district: "Test",
                    state: "Test",
                    phone_number: null,
                    is_verified: true,
                    lat: 28.5672,
                    lng: 77.2088,
                    distance: 1.5,
                },
            ],
            error: null,
        } as never);

        const response = await request(app).get("/api/pharmacies/nearest?lat=28.6304&lng=77.2177");

        expect(response.status).toBe(200);
        expect(response.body.pharmacies[0]).not.toHaveProperty("rawDistance");
        expect(response.body.pharmacies[0]).not.toHaveProperty("id");
    });

    // ── Haversine fallback tests ─────────────────────────────────────────

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
                    status: "approved",
                    district: "Bengaluru Urban",
                    state: "Karnataka",
                },
                {
                    name: "Pending Nearby Pharmacy",
                    address: "Needs Review",
                    lat: 12.972,
                    lng: 77.595,
                    phone_number: "2222222222",
                    is_verified: false,
                    status: "pending",
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
                    status: "approved",
                    district: "Bengaluru Urban",
                    state: "Karnataka",
                },
            ],
            error: null,
        });

        const eq = jest.fn().mockReturnValue({
            limit,
        });
        const select = jest.fn().mockReturnValue({ eq });

        mockedSupabase.from.mockReturnValueOnce({ select } as never);

        const response = await request(app).get(
            "/api/pharmacies/nearest?lat=12.9716&lng=77.5946&radius=10"
        );

        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe(GEOSPATIAL_CACHE_CONTROL);

        expect(mockedSupabase.rpc).toHaveBeenCalledWith("get_nearest_pharmacies", {
            query_lat: 12.9716,
            query_lng: 77.5946,
            search_radius_km: 10,
        });

        expect(mockedSupabase.from).toHaveBeenCalledWith("pharmacies");

        expect(select).toHaveBeenCalledWith(
            "name, address, location, phone_number, is_verified, district, state, status"
        );

        expect(eq).toHaveBeenCalledWith("status", "approved");
        expect(limit).toHaveBeenCalled();

        expect(response.body.pharmacies).toHaveLength(2);

        expect(response.body.pharmacies.map((pharmacy: { name: string }) => pharmacy.name)).toEqual(
            ["Nearby Pharmacy", "Mid Pharmacy"]
        );

        expect(response.body.pharmacies[0]).not.toHaveProperty("rawDistance");
    });
});

describe("GET /api/pharmacies/in-bounds", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return Cache-Control header", async () => {
        const response = await request(app).get("/api/pharmacies/in-bounds").query({
            south: 28.5,
            west: 77.1,
            north: 28.7,
            east: 77.3,
        });

        expect(response.headers["cache-control"]).toContain("public");
    });

    it("returns 400 when bounds are missing", async () => {
        const response = await request(app).get("/api/pharmacies/in-bounds?south=28.5");

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid bounds");
    });

    it("returns 400 for out-of-range bounds", async () => {
        const response = await request(app).get(
            "/api/pharmacies/in-bounds?south=91&west=77&north=29&east=78"
        );

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid bounds");
        expect(response.body.details).toHaveProperty("south");
    });

    it("returns 400 when south >= north or west >= east", async () => {
        const response = await request(app).get(
            "/api/pharmacies/in-bounds?south=30&west=80&north=20&east=70"
        );

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid bounds");
        expect(response.body.details).toHaveProperty("south");
        expect(response.body.details).toHaveProperty("west");
    });

    it("returns pharmacies from PostGIS bounds RPC when available", async () => {
        mockedSupabase.rpc.mockResolvedValueOnce({
            data: [
                {
                    id: "11111111-1111-1111-1111-111111111111",
                    name: "PMBJAK - AIIMS",
                    address: "Ansari Nagar, New Delhi",
                    district: "South Delhi",
                    state: "Delhi",
                    phone_number: "011-26588500",
                    is_verified: true,
                    lat: 28.5672,
                    lng: 77.2088,
                    distance: 3.5,
                },
            ],
            error: null,
        } as never);

        const response = await request(app).get(
            "/api/pharmacies/in-bounds?south=28.5&west=77.0&north=28.8&east=77.4"
        );

        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe(GEOSPATIAL_CACHE_CONTROL);
        expect(response.body.pharmacies).toHaveLength(1);
        expect(response.body.pharmacies[0].name).toBe("PMBJAK - AIIMS");
        expect(response.body.pharmacies[0].distance).toBe("3.5 km");

        expect(mockedSupabase.rpc).toHaveBeenCalledWith("get_pharmacies_in_bounds", {
            bound_south: 28.5,
            bound_west: 77.0,
            bound_north: 28.8,
            bound_east: 77.4,
            query_limit: 200,
            query_offset: 0,
        });

        expect(mockedSupabase.from).not.toHaveBeenCalled();
    });

    it("falls back to in-memory filter when bounds RPC is unavailable", async () => {
        mockedSupabase.rpc.mockResolvedValueOnce({
            data: null,
            error: { message: "RPC unavailable" },
        } as never);

        const limit = jest.fn().mockResolvedValueOnce({
            data: [
                {
                    name: "Inside Bounds Pharmacy",
                    address: "Inside",
                    location: { type: "Point", coordinates: [77.2, 28.6] },
                    phone_number: null,
                    is_verified: true,
                    status: "approved",
                    district: "Delhi",
                    state: "Delhi",
                },
                {
                    name: "Pending Inside Bounds Pharmacy",
                    address: "Inside",
                    location: { type: "Point", coordinates: [77.2, 28.6] },
                    phone_number: null,
                    is_verified: false,
                    status: "pending",
                    district: "Other",
                    state: "Other",
                },
            ],
            error: null,
        });

        const eq = jest.fn().mockReturnValue({ limit });
        const select = jest.fn().mockReturnValue({ eq });
        mockedSupabase.from.mockReturnValueOnce({ select } as never);

        const response = await request(app).get(
            "/api/pharmacies/in-bounds?south=28.5&west=77.0&north=28.8&east=77.4"
        );

        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe(GEOSPATIAL_CACHE_CONTROL);
        expect(response.body.pharmacies).toHaveLength(1);
        expect(response.body.pharmacies[0].name).toBe("Inside Bounds Pharmacy");
        expect(eq).toHaveBeenCalledWith("status", "approved");
    });
});

describe("POST /api/pharmacies", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockPayload = {
        name: "Test Pharmacy",
        licenseId: "LIC-123456",
        address: "123 Main St",
        district: "South Delhi",
        state: "Delhi",
        phone_number: "+919876543210",
        lat: 28.56,
        lng: 77.2,
    };

    it("registers a new pharmacy successfully", async () => {
        const selectMock = jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValueOnce({ data: null, error: null }),
            }),
        });

        const insertMock = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValueOnce({
                    data: { id: "new-pharmacy-uuid", name: "Test Pharmacy" },
                    error: null,
                }),
            }),
        });

        (supabase.from as jest.Mock).mockImplementation((table) => {
            if (table === "pharmacies") {
                return {
                    select: selectMock,
                    insert: insertMock,
                };
            }
            return {};
        });

        const response = await request(app).post("/api/pharmacies").send(mockPayload);

        expect(response.status).toBe(201);
        expect(response.body.pharmacy).toHaveProperty("id", "new-pharmacy-uuid");
        expect(insertMock).toHaveBeenCalledWith({
            name: mockPayload.name,
            license_id: mockPayload.licenseId,
            address: mockPayload.address,
            district: mockPayload.district,
            state: mockPayload.state,
            phone_number: mockPayload.phone_number,
            location: "POINT(77.2 28.56)",
            is_verified: false,
            status: "pending",
            created_by: "test-user-uuid",
        });
    });

    it("returns 409 when the license ID already exists", async () => {
        const selectMock = jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValueOnce({
                    data: { id: "existing-uuid" },
                    error: null,
                }),
            }),
        });

        (supabase.from as jest.Mock).mockImplementation((table) => {
            if (table === "pharmacies") {
                return {
                    select: selectMock,
                };
            }
            return {};
        });

        const response = await request(app).post("/api/pharmacies").send(mockPayload);

        expect(response.status).toBe(409);
        expect(response.body.error).toContain("already registered");
    });

    it("returns 400 for invalid payload", async () => {
        const response = await request(app).post("/api/pharmacies").send({ name: "" });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid pharmacy payload");
    });
});
