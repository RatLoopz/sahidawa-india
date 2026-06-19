import { Request, Response, NextFunction } from "express";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const validateUploadSize = (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers["content-length"];

    if (!contentLength) {
        res.status(411).json({
            error: "Content-Length header required",
        });
        return;
    }

    const size = parseInt(contentLength, 10);

    if (isNaN(size) || size > MAX_FILE_SIZE) {
        res.status(413).json({
            error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
            maxSize: MAX_FILE_SIZE,
            providedSize: size,
        });
        return;
    }

    next();
};
