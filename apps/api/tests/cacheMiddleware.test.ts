import { cacheMiddleware } from "../src/middleware/cache";

describe("cacheMiddleware", () => {
    it("sets Cache-Control header and calls next()", () => {
        const setHeader = jest.fn();
        const next = jest.fn();

        const req = {} as any;

        const res = {
            setHeader,
        } as any;

        cacheMiddleware(300, 600)(req, res, next);

        expect(setHeader).toHaveBeenCalledWith(
            "Cache-Control",
            "public, max-age=300, s-maxage=300, stale-while-revalidate=600"
        );

        expect(next).toHaveBeenCalled();
    });
});
