import { Router, Request, Response } from "express";
import { z } from "zod";
import { searchProducts, searchProductsFull, isSafeSearchQuery } from "../utils/productSearch";
import logger from "../utils/logger";

const router = Router();

// Validation schema for search endpoint
const searchQuerySchema = z.object({
    q: z.string().min(1).max(255),
    category: z.string().max(100).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    minRating: z.coerce.number().nonnegative().max(5).optional(),
    skip: z.coerce.number().nonnegative().optional(),
    limit: z.coerce.number().positive().max(100).optional(),
});

// ============================================================================
// GET /api/products/search
// Search products by title (safe, parameterized query)
// ============================================================================
router.get("/", async (req: Request, res: Response) => {
    try {
        const validation = searchQuerySchema.safeParse(req.query);

        if (!validation.success) {
            return res.status(400).json({
                error: "Invalid search parameters",
                issues: validation.error.issues,
            });
        }

        const { q, category, minPrice, maxPrice, minRating, skip, limit } = validation.data;

        // Additional client-side validation (defense in depth)
        if (!isSafeSearchQuery(q)) {
            logger.warn("Rejected potentially malicious search query", { q: q.substring(0, 50) });
            return res.status(400).json({
                error: "Invalid search query",
                message: "Search query contains invalid characters",
            });
        }

        // Execute safe, parameterized search
        const results = await searchProducts({
            query: q,
            category,
            minPrice,
            maxPrice,
            minRating,
            skip,
            limit,
        });

        res.json({
            query: q,
            results,
            count: results.length,
        });
    } catch (err) {
        logger.error("Error in GET /api/products/search", { error: err });
        res.status(500).json({ error: "Search failed" });
    }
});

// ============================================================================
// GET /api/products/search/advanced
// Advanced search across title and description (safe, parameterized query)
// ============================================================================
router.get("/advanced", async (req: Request, res: Response) => {
    try {
        const validation = searchQuerySchema.safeParse(req.query);

        if (!validation.success) {
            return res.status(400).json({
                error: "Invalid search parameters",
                issues: validation.error.issues,
            });
        }

        const { q, category, minPrice, maxPrice, minRating, skip, limit } = validation.data;

        // Validate search query
        if (!isSafeSearchQuery(q)) {
            logger.warn("Rejected potentially malicious advanced search query", {
                q: q.substring(0, 50),
            });
            return res.status(400).json({
                error: "Invalid search query",
                message: "Search query contains invalid characters",
            });
        }

        // Execute safe, parameterized full-text search
        const results = await searchProductsFull({
            query: q,
            category,
            minPrice,
            maxPrice,
            minRating,
            skip,
            limit,
        });

        res.json({
            query: q,
            searchType: "advanced",
            results,
            count: results.length,
        });
    } catch (err) {
        logger.error("Error in GET /api/products/search/advanced", { error: err });
        res.status(500).json({ error: "Search failed" });
    }
});

export default router;
