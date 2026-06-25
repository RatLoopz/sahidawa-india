process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";

(global as any).WebSocket = (global as any).WebSocket || class {};

jest.mock("csrf-csrf", () => ({
    doubleCsrf: () => ({
        doubleCsrfProtection: (_req: any, _res: any, next: any) => next(),
        generateToken: () => "mocked-csrf-token",
    }),
}));

const mockSupabaseChain = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    error: null,
    data: null,
};

jest.mock("../src/db/client", () => ({
    supabase: mockSupabaseChain,
}));

jest.mock("../src/middleware/auth", () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: "test-user-id", email: "test@example.com", role: "user" };
        next();
    },
    optionalAuth: (_req: any, _res: any, next: any) => next(),
    requireRole:
        (..._roles: string[]) =>
        (_req: any, _res: any, next: any) =>
            next(),
    AuthenticatedRequest: Object,
}));

import request from "supertest";
import app from "../src/app";

const mockedSupabase = mockSupabaseChain as jest.Mocked<typeof mockSupabaseChain>;

beforeEach(() => {
    jest.clearAllMocks();
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("GET /api/v1/watchlist", () => {
    it("returns empty list when no watched medicines", async () => {
        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.order as jest.Mock).mockResolvedValue({ data: [], error: null });

        const res = await request(app)
            .get("/api/v1/watchlist")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(200);
        expect(res.body.watchlist).toEqual([]);
    });

    it("returns watched medicines with joined medicine details", async () => {
        const mockWatchlist = [
            {
                id: "watch-1",
                user_id: "test-user-id",
                medicine_id: "med-1",
                notify_price_change: true,
                notify_recall: true,
                notify_new_alternative: true,
                notify_stock_availability: false,
                created_at: "2026-06-14T00:00:00Z",
                medicine: {
                    id: "med-1",
                    brand_name: "Dolo 650",
                    generic_name: "Paracetamol",
                    manufacturer: "Micro Labs",
                    mrp: 30.5,
                    jan_aushadhi_price: 10.0,
                    cdsco_approval_status: "approved",
                    is_counterfeit_alert: false,
                },
            },
        ];

        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.order as jest.Mock).mockResolvedValue({ data: mockWatchlist, error: null });

        const res = await request(app)
            .get("/api/v1/watchlist")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(200);
        expect(res.body.watchlist).toHaveLength(1);
        expect(res.body.watchlist[0].medicine.brand_name).toBe("Dolo 650");
    });
});

describe("POST /api/v1/watchlist", () => {
    const medId = "11111111-1111-4111-8111-111111111111";

    it("returns 400 for invalid body params", async () => {
        const res = await request(app)
            .post("/api/v1/watchlist")
            .set("Authorization", "Bearer test-token")
            .send({ medicine_id: "invalid-uuid" });

        expect(res.status).toBe(400);
    });

    it("returns 404 if medicine does not exist", async () => {
        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);
        mockedSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });

        const res = await request(app)
            .post("/api/v1/watchlist")
            .set("Authorization", "Bearer test-token")
            .send({ medicine_id: medId });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Medicine not found");
    });

    it("saves medicine to watchlist", async () => {
        const watchItem = {
            id: "watch-new",
            user_id: "test-user-id",
            medicine_id: medId,
            notify_price_change: true,
            notify_recall: true,
            notify_new_alternative: true,
            notify_stock_availability: true,
        };

        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);

        // Mock medicine check
        mockedSupabase.maybeSingle.mockResolvedValueOnce({ data: { id: medId }, error: null });

        // Mock upsert
        (mockedSupabase.upsert as jest.Mock).mockReturnValue(mockedSupabase);
        mockedSupabase.single.mockResolvedValueOnce({ data: watchItem, error: null });

        const res = await request(app)
            .post("/api/v1/watchlist")
            .set("Authorization", "Bearer test-token")
            .send({ medicine_id: medId });

        expect(res.status).toBe(201);
        expect(res.body.item.medicine_id).toBe(medId);
        expect(res.body.item.notify_price_change).toBe(true);
    });
});

describe("PATCH /api/v1/watchlist/:id", () => {
    it("updates preferences for a watchlist item", async () => {
        const updatedItem = {
            id: "watch-1",
            user_id: "test-user-id",
            medicine_id: "med-1",
            notify_price_change: false,
            notify_recall: true,
        };

        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.update as jest.Mock).mockReturnValue(mockedSupabase);
        mockedSupabase.maybeSingle.mockResolvedValue({ data: updatedItem, error: null });

        const res = await request(app)
            .patch("/api/v1/watchlist/watch-1")
            .set("Authorization", "Bearer test-token")
            .send({ notify_price_change: false });

        expect(res.status).toBe(200);
        expect(res.body.item.notify_price_change).toBe(false);
    });
});

describe("DELETE /api/v1/watchlist/:id", () => {
    it("removes medicine from watchlist by watchlist id", async () => {
        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.delete as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);
        mockedSupabase.maybeSingle.mockResolvedValue({ data: { id: "watch-1" }, error: null });

        const res = await request(app)
            .delete("/api/v1/watchlist/watch-1")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe("DELETE /api/v1/watchlist/medicine/:medicineId", () => {
    it("removes medicine from watchlist by medicine id", async () => {
        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.delete as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);
        mockedSupabase.select.mockResolvedValue({ data: [{ id: "watch-1" }], error: null });

        const res = await request(app)
            .delete("/api/v1/watchlist/medicine/med-1")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
