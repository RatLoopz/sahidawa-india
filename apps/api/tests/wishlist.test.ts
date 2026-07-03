import { mergeGuestWishlist } from "../src/routes/wishlist";

jest.mock("../src/db/client", () => {
    const mock = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
    };

    return { supabase: mock };
});

import { supabase } from "../src/db/client";

const mockedSupabase = supabase as any;

describe("mergeGuestWishlist", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("merges only the valid product IDs when one guest product ID is invalid/deleted", async () => {
        const userId = "user-1";
        const validId = "11111111-1111-1111-1111-111111111111";
        const invalidId = "22222222-2222-2222-2222-222222222222";

        // 1st call: fetch existing wishlist for user (empty — nothing merged yet)
        mockedSupabase.eq.mockResolvedValueOnce({ data: [], error: null });

        // 2nd call: query medicines table for which of the newProductIds exist
        mockedSupabase.in.mockResolvedValueOnce({
            data: [{ id: validId }],
            error: null,
        });

        // 3rd call: insert filtered product IDs
        mockedSupabase.select.mockResolvedValueOnce({
            data: [{ product_id: validId }],
            error: null,
        });

        const result = await mergeGuestWishlist(userId, [validId, invalidId]);

        expect(result).toEqual([validId]);
    });

    it("returns an empty array when all guest product IDs are invalid", async () => {
        const userId = "user-1";
        const invalidId = "33333333-3333-3333-3333-333333333333";

        mockedSupabase.eq.mockResolvedValueOnce({ data: [], error: null });
        mockedSupabase.in.mockResolvedValueOnce({ data: [], error: null });

        const result = await mergeGuestWishlist(userId, [invalidId]);

        expect(result).toEqual([]);
    });
});