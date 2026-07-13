process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";

(global as any).WebSocket = (global as any).WebSocket || class {};

jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
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
import { cacheMiddleware } from "../src/middleware/cache";

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

// Derived from the shared middleware (rather than a hardcoded literal) so this
// stays correct if cacheMiddleware's header format ever changes.
function cacheControlFor(durationSeconds: number, staleWhileRevalidateSeconds: number): string {
    let headerValue = "";
    const fakeRes = { setHeader: (name: string, value: string) => (headerValue = value) } as never;
    cacheMiddleware(durationSeconds, staleWhileRevalidateSeconds)({} as never, fakeRes, () => {});
    return headerValue;
}

const GEOSPATIAL_CACHE_CONTROL = cacheControlFor(300, 600);

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
            "name, address, location, phone_number, is_verified, district, state, status, operating_hours, timezone"
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

describe("GET /api/pharmacies/search-by-medicine", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return Cache-Control header", async () => {
        // A too-short query short-circuits with 400 before any DB call, but
        // cacheMiddleware runs upstream of that validation so the header is
        // still present.
        const response = await request(app).get("/api/pharmacies/search-by-medicine?q=a");

        expect(response.headers["cache-control"]).toContain("public");
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

describe("POST /api/pharmacies/bulk-upload — BOM stripping", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("parses CSV with UTF-8 BOM marker correctly", async () => {
        const csvWithBOM =
            "\uFEFFmedicine_name,batch_number,expiry_date,quantity,mrp\n" +
            "Paracetamol 500mg,BATCH001,2027-01-01,100,50\n";

        const selectMock = jest.fn().mockReturnThis();
        const eqMock = jest.fn().mockReturnThis();
        const orderMock = jest.fn().mockReturnThis();
        const thenMock = jest.fn().mockImplementation((resolve) => {
            return resolve({
                data: [{ id: "pharmacy-uuid-123" }],
                error: null,
            });
        });
        const insertMock = jest.fn().mockResolvedValue({ error: null });

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "pharmacies") {
                return {
                    select: selectMock,
                    eq: eqMock,
                    order: orderMock,
                    then: thenMock,
                };
            }
            if (table === "pharmacy_inventory") {
                return { insert: insertMock };
            }
            return {};
        });

        const response = await request(app)
            .post("/api/pharmacies/bulk-upload")
            .send({ fileContent: csvWithBOM });

        expect(response.status).toBe(200);
        const lines = response.text.split("\n\n");
        const doneLine = lines.find((l) => l.startsWith("data: ") && l.includes('"done":true'));
        const body = doneLine ? JSON.parse(doneLine.substring(6)) : {};

        expect(body.successCount).toBe(1);
        expect(body.failedCount).toBe(0);
    });

    it("parses CSV without BOM marker correctly", async () => {
        const csvWithoutBOM =
            "medicine_name,batch_number,expiry_date,quantity,mrp\n" +
            "Ibuprofen 400mg,BATCH002,2027-06-01,50,30\n";

        const selectMock = jest.fn().mockReturnThis();
        const eqMock = jest.fn().mockReturnThis();
        const orderMock = jest.fn().mockReturnThis();
        const thenMock = jest.fn().mockImplementation((resolve) => {
            return resolve({
                data: [{ id: "pharmacy-uuid-123" }],
                error: null,
            });
        });
        const insertMock = jest.fn().mockResolvedValue({ error: null });

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "pharmacies") {
                return {
                    select: selectMock,
                    eq: eqMock,
                    order: orderMock,
                    then: thenMock,
                };
            }
            if (table === "pharmacy_inventory") {
                return { insert: insertMock };
            }
            return {};
        });

        const response = await request(app)
            .post("/api/pharmacies/bulk-upload")
            .send({ fileContent: csvWithoutBOM });

        expect(response.status).toBe(200);
        const lines = response.text.split("\n\n");
        const doneLine = lines.find((l) => l.startsWith("data: ") && l.includes('"done":true'));
        const body = doneLine ? JSON.parse(doneLine.substring(6)) : {};

        expect(body.successCount).toBe(1);
        expect(body.failedCount).toBe(0);
    });

    it("uses specified pharmacyId from body/query and falls back to most recently created", async () => {
        const csvContent =
            "medicine_name,batch_number,expiry_date,quantity,mrp\n" +
            "Ibuprofen 400mg,BATCH002,2027-06-01,50,30\n";

        const selectMock = jest.fn().mockReturnThis();
        const eqMock = jest.fn().mockReturnThis();
        const orderMock = jest.fn().mockReturnThis();
        const thenMock = jest.fn().mockImplementation((resolve) => {
            return resolve({
                data: [{ id: "pharmacy-uuid-456" }, { id: "pharmacy-uuid-123" }],
                error: null,
            });
        });
        const insertMock = jest.fn().mockResolvedValue({ error: null });

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "pharmacies") {
                return {
                    select: selectMock,
                    eq: eqMock,
                    order: orderMock,
                    then: thenMock,
                };
            }
            if (table === "pharmacy_inventory") {
                return { insert: insertMock };
            }
            return {};
        });

        // Test with pharmacyId in body
        const response1 = await request(app)
            .post("/api/pharmacies/bulk-upload")
            .send({ fileContent: csvContent, pharmacyId: "pharmacy-uuid-123" });

        expect(response1.status).toBe(200);
        expect(eqMock).toHaveBeenCalledWith("id", "pharmacy-uuid-123");

        // Test fallback (no pharmacyId) - orders by created_at desc
        const response2 = await request(app)
            .post("/api/pharmacies/bulk-upload")
            .send({ fileContent: csvContent });

        expect(response2.status).toBe(200);
        expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false });
    });
});

describe("POST /api/pharmacies/bulk-upload — Robust CSV Parsing", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const selectMock = jest.fn().mockReturnThis();
        const eqMock = jest.fn().mockReturnThis();
        const orderMock = jest.fn().mockReturnThis();
        const thenMock = jest.fn().mockImplementation((resolve) => {
            return resolve({
                data: [{ id: "pharmacy-uuid-123" }],
                error: null,
            });
        });
        const maybeSingleMock = jest.fn().mockResolvedValue({
            data: { id: "pharmacy-uuid-123" },
            error: null,
        });
        const insertMock = jest.fn().mockResolvedValue({ error: null });

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "pharmacies") {
                return {
                    select: selectMock,
                    eq: eqMock,
                    order: orderMock,
                    maybeSingle: maybeSingleMock,
                    then: thenMock,
                };
            }
            if (table === "pharmacy_inventory") {
                return { insert: insertMock };
            }
            return {};
        });
    });

    it("handles quoted commas, escaped quotes, and embedded newlines", async () => {
        const csv =
            "medicine_name,batch_number,expiry_date,quantity,mrp\n" +
            '"Complex ""Name"", with comma",BATCH001,2027-01-01,100,50\n' +
            '"Multiline\nMedicine",BATCH002,2027-02-01,200,60';

        const response = await request(app)
            .post("/api/pharmacies/bulk-upload")
            .send({ fileContent: csv });

        expect(response.status).toBe(200);
        const lines = response.text.split("\n\n");
        const doneLine = lines.find((l) => l.startsWith("data: ") && l.includes('"done":true'));
        const body = doneLine ? JSON.parse(doneLine.substring(6)) : {};

        expect(body.successCount).toBe(2);
        expect(body.failedCount).toBe(0);
        expect(body.totalRows).toBe(2);
    });

    it("maintains correct row numbering with empty records and captures validation failures", async () => {
        const csv =
            "medicine_name,batch_number,expiry_date,quantity,mrp\n" +
            "Valid Med,BATCH001,2027-01-01,100,50\n" +
            "\n" + // Empty row (logical row 3)
            "Invalid Med,,2027-01-01,100,50\n"; // Missing batch (logical row 4)

        const response = await request(app)
            .post("/api/pharmacies/bulk-upload")
            .send({ fileContent: csv });

        expect(response.status).toBe(200);
        const lines = response.text.split("\n\n");
        const doneLine = lines.find((l) => l.startsWith("data: ") && l.includes('"done":true'));
        const body = doneLine ? JSON.parse(doneLine.substring(6)) : {};

        expect(body.successCount).toBe(1); // Valid Med
        expect(body.failedCount).toBe(1); // Invalid Med
        expect(body.errors[0].row).toBe(4); // Physical logical row
        expect(body.errors[0].reason).toContain("expected string");
    });

    it("catches parser-level malformed records", async () => {
        const csv =
            "medicine_name,batch_number,expiry_date,quantity,mrp\n" +
            "Normal Med,BATCH1,2027-01-01,10,10\n" +
            '"Unclosed quote Med,BATCH2,2027-01-01,20,20\n';

        const response = await request(app)
            .post("/api/pharmacies/bulk-upload")
            .send({ fileContent: csv });

        expect(response.status).toBe(200);
        const lines = response.text.split("\n\n");
        const doneLine = lines.find((l) => l.startsWith("data: ") && l.includes('"done":true'));
        const body = doneLine ? JSON.parse(doneLine.substring(6)) : {};

        expect(body.failedCount).toBeGreaterThan(0);
        expect(body.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    row: 3,
                    reason: expect.stringMatching(/quote/i),
                }),
            ])
        );
    });
});

// ── HTTP-level regression test: POST /:id/inventory/upload (Multer path) ─────

describe("POST /api/pharmacies/:id/inventory/upload — Multer file-buffer path", () => {
    const PHARMACY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock auth middleware already injects req.user = { id: "test-user-uuid", role: "user" }
        // Pharmacy ownership: created_by matches test-user-uuid
        const selectMock = jest.fn().mockReturnThis();
        const eqMock = jest.fn().mockReturnThis();
        const maybeSingleMock = jest.fn().mockResolvedValue({
            data: { id: PHARMACY_ID, created_by: "test-user-uuid", status: "active" },
            error: null,
        });
        const insertMock = jest.fn().mockResolvedValue({ error: null });

        (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === "pharmacies") {
                return { select: selectMock, eq: eqMock, maybeSingle: maybeSingleMock };
            }
            if (table === "pharmacy_inventory") {
                return { insert: insertMock };
            }
            return {};
        });
    });

    it("parses a valid CSV uploaded as a multipart file and returns correct counts", async () => {
        const csv =
            "medicine_name,batch_number,expiry_date,quantity,mrp\n" +
            "Paracetamol 500mg,BATCH001,2027-12-01,200,15\n" +
            "Ibuprofen 400mg,BATCH002,2027-06-01,100,25\n";

        const response = await request(app)
            .post(`/api/pharmacies/${PHARMACY_ID}/inventory/upload`)
            .attach("file", Buffer.from(csv, "utf-8"), {
                filename: "inventory.csv",
                contentType: "text/csv",
            });

        expect(response.status).toBe(200);
        expect(response.body.totalRows).toBe(2);
        expect(response.body.successCount).toBe(2);
        expect(response.body.failedCount).toBe(0);
        expect(response.body.errors).toHaveLength(0);
    });

    it("correctly excludes empty rows from totalRows and the 500-row limit", async () => {
        const csv =
            "medicine_name,batch_number,expiry_date,quantity,mrp\n" +
            "Paracetamol 500mg,BATCH001,2027-12-01,200,15\n" +
            "\n" + // empty row — must not count toward totalRows
            "Ibuprofen 400mg,BATCH002,2027-06-01,100,25\n";

        const response = await request(app)
            .post(`/api/pharmacies/${PHARMACY_ID}/inventory/upload`)
            .attach("file", Buffer.from(csv, "utf-8"), {
                filename: "inventory.csv",
                contentType: "text/csv",
            });

        expect(response.status).toBe(200);
        expect(response.body.totalRows).toBe(2); // empty row excluded
        expect(response.body.successCount).toBe(2);
        expect(response.body.failedCount).toBe(0);
    });

    it("reports validation failures with correct logical row numbers via Multer path", async () => {
        const csv =
            "medicine_name,batch_number,expiry_date,quantity,mrp\n" +
            "Valid Med,BATCH001,2027-01-01,100,50\n" +
            "\n" + // empty row — logical row 3, skipped
            "Bad Med,,2027-01-01,100,50\n"; // missing batch_number — logical row 4

        const response = await request(app)
            .post(`/api/pharmacies/${PHARMACY_ID}/inventory/upload`)
            .attach("file", Buffer.from(csv, "utf-8"), {
                filename: "inventory.csv",
                contentType: "text/csv",
            });

        expect(response.status).toBe(200);
        expect(response.body.totalRows).toBe(2); // 2 non-empty rows
        expect(response.body.successCount).toBe(1);
        expect(response.body.failedCount).toBe(1);
        expect(response.body.errors[0].row).toBe(4); // logical row 4 (header=1, valid=2, empty=3, bad=4)
    });
});
