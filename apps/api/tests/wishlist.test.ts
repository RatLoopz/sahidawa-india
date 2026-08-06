import express from "express";
import request, { Response as SuperTestResponse } from "supertest";
import wishlistRouter, { mergeGuestWishlist } from "../src/routes/wishlist";

jest.mock("../src/middleware/auth", () => ({
    requireAuth: (
        req: { user?: { id: string; role: string } },
        _res: unknown,
        next: () => void
    ) => {
        req.user = { id: "user-1", role: "user" };
        next();
    },
}));

jest.mock("../src/middleware/rateLimit", () => ({
    limiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock("../src/db/client", () => {
    const mockSupabase = {
        from: jest.fn(),
    };
    return { supabase: mockSupabase };
});

import { supabase } from "../src/db/client";

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use("/api/v1/wishlist", wishlistRouter);
    return app;
}

function expectUnavailableMerge(response: SuperTestResponse) {
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
        success: false,
        error: "Wishlist sync is temporarily unavailable. Please try again.",
        code: "WISHLIST_MERGE_UNAVAILABLE",
    });
}

describe("GET /api/v1/wishlist — pagination", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    function buildItems(n: number) {
        return Array.from({ length: n }, (_, i) => ({
            id: `item-${i + 1}`,
            product_id: `product-${i + 1}`,
            created_at: new Date().toISOString(),
        }));
    }

    function mockWishlistPage(
        items: object[],
        totalCount: number,
        error: object | null = null
    ) {
        const rangeMock = jest.fn().mockResolvedValue({
            data: error ? null : items,
            error,
            count: error ? null : totalCount,
        });
        const orderMock = jest.fn().mockReturnValue({ range: rangeMock });
        const eqMock = jest.fn().mockReturnValue({ order: orderMock });
        const selectMock = jest.fn().mockReturnValue({ eq: eqMock });

        mockedSupabase.from.mockImplementation((table: string) => {
            if (table === "wishlists") {
                return { select: selectMock } as never;
            }
            return {} as never;
        });

        return { rangeMock, orderMock, eqMock, selectMock };
    }

    it("returns the correct pagination schema on a populated page", async () => {
        mockWishlistPage(buildItems(20), 45);

        const res = await request(createTestApp()).get("/api/v1/wishlist?page=1&limit=20");

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            page: 1,
            limit: 20,
            count: 45,
            totalPages: 3,
        });
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body.items).toHaveLength(20);
    });

    it("defaults to page=1 and limit=20 when no query params given", async () => {
        mockWishlistPage(buildItems(20), 50);

        const res = await request(createTestApp()).get("/api/v1/wishlist");

        expect(res.status).toBe(200);
        expect(res.body.page).toBe(1);
        expect(res.body.limit).toBe(20);
        expect(res.body.totalPages).toBe(3);
    });

    it("returns correct page when requesting page 2", async () => {
        mockWishlistPage(buildItems(20), 45);

        const res = await request(createTestApp()).get("/api/v1/wishlist?page=2&limit=20");

        expect(res.status).toBe(200);
        expect(res.body.page).toBe(2);
    });

    it("returns the remaining items on the last page", async () => {
        mockWishlistPage(buildItems(5), 45);

        const res = await request(createTestApp()).get("/api/v1/wishlist?page=3&limit=20");

        expect(res.status).toBe(200);
        expect(res.body.page).toBe(3);
        expect(res.body.items).toHaveLength(5);
        expect(res.body.totalPages).toBe(3);
    });

    it("falls back to page=1 when page param is invalid (string)", async () => {
        mockWishlistPage(buildItems(20), 30);

        const res = await request(createTestApp()).get("/api/v1/wishlist?page=abc&limit=20");

        expect(res.status).toBe(200);
        expect(res.body.page).toBe(1);
    });

    it("falls back to page=1 when page param is zero", async () => {
        mockWishlistPage(buildItems(20), 30);

        const res = await request(createTestApp()).get("/api/v1/wishlist?page=0&limit=20");

        expect(res.status).toBe(200);
        expect(res.body.page).toBe(1);
    });

    it("falls back to limit=20 when limit param is invalid", async () => {
        mockWishlistPage(buildItems(20), 30);

        const res = await request(createTestApp()).get("/api/v1/wishlist?page=1&limit=xyz");

        expect(res.status).toBe(200);
        expect(res.body.limit).toBe(20);
    });

    it("caps limit at 100 when limit param exceeds maximum", async () => {
        mockWishlistPage(buildItems(100), 500);

        const res = await request(createTestApp()).get("/api/v1/wishlist?page=1&limit=999");

        expect(res.status).toBe(200);
        expect(res.body.limit).toBe(100);
        expect(res.body.totalPages).toBe(5);
    });

    it("returns empty items and zero counts when the wishlist is empty", async () => {
        mockWishlistPage([], 0);

        const res = await request(createTestApp()).get("/api/v1/wishlist?page=1&limit=20");

        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
        expect(res.body.count).toBe(0);
        expect(res.body.totalPages).toBe(0);
    });

    it("uses count from the full wishlist, not just the current page size", async () => {
        mockWishlistPage(buildItems(5), 45);

        const res = await request(createTestApp()).get("/api/v1/wishlist?page=3&limit=20");

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(5);
        expect(res.body.count).toBe(45);
    });

    it("calls next(err) when the database returns an error", async () => {
        mockWishlistPage([], 0, { message: "DB connection failed" });

        const res = await request(createTestApp()).get("/api/v1/wishlist?page=1&limit=20");

        expect(res.status).toBeGreaterThanOrEqual(500);
    });
});

describe("mergeGuestWishlist", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("merges only the valid product IDs when one guest product ID is invalid/deleted", async () => {
        const userId = "user-1";
        const validId = "11111111-1111-1111-1111-111111111111";
        const invalidId = "22222222-2222-2222-2222-222222222222";

        const wishlistsSelectEqMock = jest.fn().mockResolvedValue({ data: [], error: null });
        const wishlistsInsertSelectMock = jest.fn().mockResolvedValue({
            data: [{ product_id: validId }],
            error: null,
        });

        const medicinesInMock = jest.fn().mockResolvedValue({
            data: [{ id: validId }],
            error: null,
        });

        mockedSupabase.from.mockImplementation((table: string) => {
            if (table === "wishlists") {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: wishlistsSelectEqMock,
                    }),
                    insert: jest.fn().mockReturnValue({
                        select: wishlistsInsertSelectMock,
                    }),
                };
            }
            if (table === "medicines") {
                return {
                    select: jest.fn().mockReturnValue({
                        in: medicinesInMock,
                    }),
                };
            }
            return {};
        });

        const result = await mergeGuestWishlist(userId, [validId, invalidId]);

        expect(result).toEqual([validId]);
        expect(wishlistsSelectEqMock).toHaveBeenCalledWith("user_id", userId);
        expect(medicinesInMock).toHaveBeenCalledWith("id", [validId, invalidId]);
    });

    it("returns an empty array when all guest product IDs are invalid", async () => {
        const userId = "user-1";
        const invalidId = "33333333-3333-3333-3333-333333333333";

        const wishlistsSelectEqMock = jest.fn().mockResolvedValue({ data: [], error: null });
        const medicinesInMock = jest.fn().mockResolvedValue({ data: [], error: null });

        mockedSupabase.from.mockImplementation((table: string) => {
            if (table === "wishlists") {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: wishlistsSelectEqMock,
                    }),
                };
            }
            if (table === "medicines") {
                return {
                    select: jest.fn().mockReturnValue({
                        in: medicinesInMock,
                    }),
                };
            }
            return {};
        });

        const result = await mergeGuestWishlist(userId, [invalidId]);

        expect(result).toEqual([]);
        expect(wishlistsSelectEqMock).toHaveBeenCalledWith("user_id", userId);
        expect(medicinesInMock).toHaveBeenCalledWith("id", [invalidId]);
    });

    it("returns an empty array when every guest item is already wishlisted", async () => {
        const productId = "44444444-4444-4444-8444-444444444444";
        const wishlistsSelectEqMock = jest.fn().mockResolvedValue({
            data: [{ product_id: productId }],
            error: null,
        });
        mockedSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({ eq: wishlistsSelectEqMock }),
        } as never);

        await expect(mergeGuestWishlist("user-1", [productId])).resolves.toEqual([]);
        expect(mockedSupabase.from).toHaveBeenCalledTimes(1);
    });

    it("returns 503 when fetching the existing wishlist fails", async () => {
        const fetchError = { message: "database unavailable" };
        const productIds = ["55555555-5555-4555-8555-555555555555"];
        mockedSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: null, error: fetchError }),
            }),
        } as never);

        const response = await request(createTestApp())
            .post("/api/v1/wishlist/merge-guest")
            .send({ product_ids: productIds });

        expectUnavailableMerge(response);
        expect(response.text).not.toContain("database unavailable");
    });

    it("returns 503 when medicine lookup fails", async () => {
        const productId = "66666666-6666-4666-8666-666666666666";
        mockedSupabase.from.mockImplementation((table: string) => {
            if (table === "wishlists") {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                };
            }
            return {
                select: jest.fn().mockReturnValue({
                    in: jest.fn().mockResolvedValue({
                        data: null,
                        error: { message: "medicine lookup failed" },
                    }),
                }),
            };
        });

        const response = await request(createTestApp())
            .post("/api/v1/wishlist/merge-guest")
            .send({ product_ids: [productId] });

        expectUnavailableMerge(response);
    });

    it("returns 503 when wishlist insertion fails", async () => {
        const productId = "77777777-7777-4777-8777-777777777777";
        mockedSupabase.from.mockImplementation((table: string) => {
            if (table === "medicines") {
                return {
                    select: jest.fn().mockReturnValue({
                        in: jest.fn().mockResolvedValue({
                            data: [{ id: productId }],
                            error: null,
                        }),
                    }),
                };
            }
            return {
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
                insert: jest.fn().mockReturnValue({
                    select: jest.fn().mockResolvedValue({
                        data: null,
                        error: { message: "insert failed" },
                    }),
                }),
            };
        });

        const response = await request(createTestApp())
            .post("/api/v1/wishlist/merge-guest")
            .send({ product_ids: [productId] });

        expectUnavailableMerge(response);
    });

    it("returns 503 for an unexpected merge exception", async () => {
        const productId = "88888888-8888-4888-8888-888888888888";
        mockedSupabase.from.mockImplementation(() => {
            throw new Error("unexpected internal details");
        });

        const response = await request(createTestApp())
            .post("/api/v1/wishlist/merge-guest")
            .send({ product_ids: [productId] });

        expectUnavailableMerge(response);
        expect(response.text).not.toContain("unexpected internal details");
    });
});
