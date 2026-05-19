import { Router, Request, Response } from "express";
import { supabase } from "../db/client";

const alertsRouter = Router();

const PAGE_SIZE = 20;

alertsRouter.get("/", async (req: Request, res: Response) => {
    const page = parseInt((req.query.page as string) ?? "1", 10);
    const pageSize = parseInt((req.query.pageSize as string) ?? String(PAGE_SIZE), 10);

    if (isNaN(page) || page < 1 || isNaN(pageSize) || pageSize < 1) {
        res.status(400).json({ error: "Invalid pagination parameters" });
        return;
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
        .from("drug_alerts")
        .select(
            "id, reported_brand_name, manufacturer, batch_number, alert_type, risk_level, district, state, reported_at, created_at"
        )
        .order("created_at", { ascending: false })
        .range(from, to);

    if (error) {
        res.status(500).json({ error: "Failed to fetch alerts" });
        return;
    }

    res.json({ alerts: data ?? [], page, pageSize });
});

export default alertsRouter;
