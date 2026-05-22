import { Router, Request, Response } from "express";
import { supabase } from "../db/client";

const alertsRouter = Router();

/**
 * GET /api/v1/alerts
 * Paginated alerts endpoint.
 *
 * Query params:
 *   page  — 1-based page index (default: 1)
 *   limit — items per page (default: 10, max: 100)
 *
 * Response schema:
 *   {
 *     data:           Alert[],
 *     pageIndex:      number,   // current page (1-based)
 *     pageSize:       number,   // items returned on this page
 *     totalCount:     number,   // total rows in the table
 *     totalPageCount: number,   // ceil(totalCount / limit)
 *   }
 */
alertsRouter.get("/", async (req: Request, res: Response) => {
    const rawPage = parseInt(req.query.page as string, 10);
    const rawLimit = parseInt(req.query.limit as string, 10);

    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 100);

    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
        .from("drug_alerts")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        res.status(500).json({ error: "Failed to fetch alerts" });
        return;
    }

    const totalCount = count ?? 0;
    const totalPageCount = Math.ceil(totalCount / limit);

    res.json({
        data: data ?? [],
        pageIndex: page,
        pageSize: (data ?? []).length,
        totalCount,
        totalPageCount,
    });
});

export default alertsRouter;