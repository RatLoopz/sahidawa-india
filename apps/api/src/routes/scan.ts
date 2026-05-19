import { Router, Request, Response } from "express";
import multer from "multer";
import logger from "../utils/logger";

const router = Router();

// ── Allowed image MIME types ─────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
]);

// Security: reject non-image uploads before they reach the ML container
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter(_req, file, cb) {
        if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
            cb(null, true);
        } else {
            // Pass error — multer will forward it to our error handler below
            cb(
                Object.assign(
                    new Error(
                        `Invalid file type "${file.mimetype}". Only JPEG, PNG, WEBP, GIF, and BMP images are accepted.`
                    ),
                    { code: "INVALID_MIME" }
                )
            );
        }
    },
});

// ── POST /api/v1/scan/extract ────────────────────────────────────────────────
// Receives a multipart image from the Next.js frontend, validates it, and
// proxies it to the FastAPI ML OCR microservice.
// Multer runs as an inner middleware callback so fileFilter errors are caught
// and serialised as structured JSON instead of propagating uncaught.
router.post("/extract", (req: Request, res: Response) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (upload.single("file") as any)(req, res, async (multerErr: unknown) => {
        if (multerErr) {
            const msg = multerErr instanceof Error ? multerErr.message : "File upload error";
            logger.warn(`File upload rejected: ${msg}`);
            res.status(400).json({ error: msg });
            return;
        }

        // After multer runs, req.file is populated by the @types/multer augmentation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const file: Express.Multer.File | undefined = (req as any).file;

        if (!file) {
            res.status(400).json({ error: "No image file provided." });
            return;
        }

        const mlServiceUrl = process.env.ML_SERVICE_URL ?? "http://localhost:8000";
        const targetUrl = `${mlServiceUrl}/ocr/extract`;

        logger.info(
            `Proxying image "${file.originalname}" (${file.size} bytes, ${file.mimetype}) → ${targetUrl}`
        );

        try {
            const formData = new FormData();
            const blob = new Blob([new Uint8Array(file.buffer)], {
                type: file.mimetype,
            });
            formData.append("file", blob, file.originalname);

            const response = await fetch(targetUrl, {
                method: "POST",
                body: formData,
                signal: AbortSignal.timeout(30_000), // 30 s hard timeout
            });

            if (!response.ok) {
                let errorDetail = `ML service returned HTTP ${response.status}`;
                try {
                    const body = (await response.json()) as { detail?: string };
                    if (body.detail) errorDetail = body.detail;
                } catch {
                    // Non-JSON body — keep generic message
                }
                logger.error(`ML OCR error: ${errorDetail}`);
                res.status(response.status).json({ error: errorDetail });
                return;
            }

            const data = await response.json();
            logger.info(`OCR extraction successful for "${file.originalname}"`);
            res.status(200).json(data);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Unknown error";
            logger.error(`Could not reach ML OCR service: ${msg}`);
            res.status(503).json({
                error: "OCR service is currently unavailable. Please verify manually.",
                details: msg,
            });
        }
    });
});

export default router;
