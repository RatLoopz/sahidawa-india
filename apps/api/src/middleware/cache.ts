import { Request, Response, NextFunction } from "express";

export function cacheMiddleware(durationSeconds: number, staleWhileRevalidateSeconds: number) {
    return (_req: Request, res: Response, next: NextFunction) => {
        res.setHeader(
            "Cache-Control",
            `public, max-age=${durationSeconds}, s-maxage=${durationSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`
        );

        next();
    };
}
