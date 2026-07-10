import { mergeGuestWishlist } from "../src/routes/wishlist";

jest.mock("../src/db/client", () => {
    const mockSupabase = {
        from: jest.fn(),
    };
    return { supabase: mockSupabase };
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
});
