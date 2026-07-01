import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import { requireAuth } from "../middleware/auth";
import type { AuthenticatedRequest } from "../middleware/auth";
import logger from "../utils/logger";
import { redisClient } from "../utils/redis";
import { scheduleLimiter } from "../middleware/rateLimit";

const router = Router();
router.use(scheduleLimiter);
const invalidateUserSummaryCaches = async (userId: string) => {
    if (!redisClient.isOpen) return;

    const matchPattern = `schedules:summary:${userId}:*`;

    try {
        for await (const key of redisClient.scanIterator({ MATCH: matchPattern, COUNT: 100 })) {
            await redisClient.del(key);
        }
    } catch (redisErr) {
        logger.error("Failed to invalidate user summary caches", {
            error: redisErr,
            userId,
        });
    }
};
const createScheduleSchema = z.object({
    medicine_name: z.string().min(1, "Medicine name is required"),
    dosage: z.string().min(1, "Dosage is required").default("1 tablet"),
    frequency: z.number().int().positive("Frequency must be at least 1"),
    times: z
        .array(z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"))
        .min(1, "At least one time is required"),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    end_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
        .nullable()
        .optional(),
    notes: z.string().optional(),
    medicine_id: z.string().uuid().nullable().optional(),
});

const updateScheduleSchema = createScheduleSchema.partial();

const doseSchema = z.object({
    log_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    log_time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
    status: z.enum(["taken", "skipped"]),
    taken_at: z.string().datetime().nullable().optional(),
});

const statsSchema = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

const summaryQuerySchema = z.object({
    date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
        .optional(),
    time: z
        .string()
        .regex(/^\d{2}:\d{2}$/, "Time must be HH:MM")
        .optional(),
});

/**
 * Returns the current date (YYYY-MM-DD) and time (HH:MM) in Indian Standard Time (IST).
 * Used for matching medicine schedules which are stored against Indian calendar days.
 */
const getIstDateTime = () => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(now);

    const dateMap: Record<string, string> = {};
    parts.forEach((p) => (dateMap[p.type] = p.value));

    const today = `${dateMap.year}-${dateMap.month}-${dateMap.day}`;
    const nowTime = `${dateMap.hour}:${dateMap.minute}`;

    return { today, nowTime };
};

// List user's active schedules
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from("medicine_schedules")
            .select("*")
            .eq("user_id", req.user!.id)
            .order("created_at", { ascending: false });

        if (error) {
            res.status(500).json({ error: "Failed to fetch schedules" });
            return;
        }

        res.json({ schedules: data ?? [] });
    } catch (err) {
        logger.error("Error listing schedules", { error: err });
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

// Get single schedule by id
router.get("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from("medicine_schedules")
            .select("*")
            .eq("id", req.params.id)
            .eq("user_id", req.user!.id)
            .maybeSingle();

        if (error) {
            res.status(500).json({ error: "Failed to fetch schedule" });
            return;
        }

        if (!data) {
            res.status(404).json({ error: "Schedule not found" });
            return;
        }
        res.json({ schedule: data });
    } catch (err) {
        logger.error("Error fetching schedule", { error: err, scheduleId: req.params.id });
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

// Create schedule
router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const parsed = createScheduleSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid request body",
            details: parsed.error.flatten().fieldErrors,
        });
        return;
    }

    try {
        const { data, error } = await supabase
            .from("medicine_schedules")
            .insert({
                user_id: req.user!.id,
                ...parsed.data,
            })
            .select()
            .single();

        if (error) {
            res.status(500).json({ error: "Failed to create schedule" });
            return;
        }
        await invalidateUserSummaryCaches(req.user!.id);
        res.status(201).json({ schedule: data });
    } catch (err) {
        logger.error("Error creating schedule", { error: err });
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

// Update schedule
router.put("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const parsed = updateScheduleSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid request body",
            details: parsed.error.flatten().fieldErrors,
        });
        return;
    }

    try {
        const { data, error } = await supabase
            .from("medicine_schedules")
            .update({ ...parsed.data, updated_at: new Date().toISOString() })
            .eq("id", req.params.id)
            .eq("user_id", req.user!.id)
            .select()
            .single();

        if (error) {
            res.status(500).json({ error: "Failed to update schedule" });
            return;
        }

        if (!data) {
            res.status(404).json({ error: "Schedule not found" });
            return;
        }
        await invalidateUserSummaryCaches(req.user!.id);
        res.json({ schedule: data });
    } catch (err) {
        logger.error("Error updating schedule", { error: err, scheduleId: req.params.id });
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

// Delete schedule
router.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { error } = await supabase
            .from("medicine_schedules")
            .delete()
            .eq("id", req.params.id)
            .eq("user_id", req.user!.id);

        if (error) {
            res.status(500).json({ error: "Failed to delete schedule" });
            return;
        }
        await invalidateUserSummaryCaches(req.user!.id);
        res.json({ success: true });
    } catch (err) {
        logger.error("Error deleting schedule", { error: err, scheduleId: req.params.id });
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

// Log a dose (taken/skipped) - upsert to handle re-marking
router.post("/:id/doses", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const parsed = doseSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid request body",
            details: parsed.error.flatten().fieldErrors,
        });
        return;
    }

    try {
        const { data: schedule, error: fetchError } = await supabase
            .from("medicine_schedules")
            .select("id")
            .eq("id", req.params.id)
            .eq("user_id", req.user!.id)
            .maybeSingle();

        if (fetchError || !schedule) {
            res.status(404).json({ error: "Schedule not found" });
            return;
        }

        const { data, error } = await supabase
            .from("dose_logs")
            .upsert(
                {
                    schedule_id: req.params.id,
                    user_id: req.user!.id,
                    log_date: parsed.data.log_date,
                    log_time: parsed.data.log_time,
                    status: parsed.data.status,
                    taken_at: parsed.data.taken_at ?? null,
                },
                {
                    onConflict: "schedule_id, log_date, log_time",
                    ignoreDuplicates: false,
                }
            )
            .select()
            .single();

        if (error) {
            res.status(500).json({ error: "Failed to log dose" });
            return;
        }

        if (redisClient.isOpen) {
            const cacheKey = `schedules:summary:${req.user!.id}:${parsed.data.log_date}`;
            try {
                await redisClient.del(cacheKey);
            } catch (redisErr) {
                logger.error("Failed to invalidate cache", { error: redisErr, cacheKey });
            }
        }

        res.json({ dose: data });
    } catch (err) {
        logger.error("Error logging dose", { error: err, scheduleId: req.params.id });
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

// Get dose logs for a schedule
router.get("/:id/doses", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from("dose_logs")
            .select("*")
            .eq("schedule_id", req.params.id)
            .eq("user_id", req.user!.id)
            .order("log_date", { ascending: false })
            .order("log_time", { ascending: false });

        if (error) {
            res.status(500).json({ error: "Failed to fetch dose logs" });
            return;
        }

        res.json({ doses: data ?? [] });
    } catch (err) {
        logger.error("Error fetching dose logs", { error: err, scheduleId: req.params.id });
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

// Get adherence statistics for a schedule
router.get("/:id/stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const queryParsed = statsSchema.safeParse(req.query);
    if (!queryParsed.success) {
        res.status(400).json({
            error: "Invalid query parameters. Use from=YYYY-MM-DD&to=YYYY-MM-DD",
        });
        return;
    }

    try {
        const { data: schedule, error: fetchError } = await supabase
            .from("medicine_schedules")
            .select("*")
            .eq("id", req.params.id)
            .eq("user_id", req.user!.id)
            .maybeSingle();

        if (fetchError || !schedule) {
            res.status(404).json({ error: "Schedule not found" });
            return;
        }

        const { from, to } = queryParsed.data;
        const fromDate = new Date(from);
        const toDate = new Date(to);

        if (fromDate > toDate) {
            res.status(400).json({ error: "from date must be before to date" });
            return;
        }

        const dayCount = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;

        if (dayCount > 365) {
            res.status(400).json({ error: "Date range cannot exceed 365 days" });
            return;
        }

        const expectedDoses = dayCount * schedule.frequency;

        const { data: doseLogs, error: doseError } = await supabase
            .from("dose_logs")
            .select("*")
            .eq("schedule_id", req.params.id)
            .eq("user_id", req.user!.id)
            .gte("log_date", from)
            .lte("log_date", to)
            .limit(500);

        if (doseError) {
            res.status(500).json({ error: "Failed to fetch adherence data" });
            return;
        }

        const takenCount = (doseLogs ?? []).filter((d) => d.status === "taken").length;
        const skippedCount = (doseLogs ?? []).filter((d) => d.status === "skipped").length;
        const adherencePercent =
            expectedDoses > 0 ? Math.round((takenCount / expectedDoses) * 100) : 100;

        res.json({
            stats: {
                expected_doses: expectedDoses,
                taken: takenCount,
                skipped: skippedCount,
                adherence_percent: adherencePercent,
                period: { from, to },
            },
            doses: doseLogs ?? [],
        });
    } catch (err) {
        logger.error("Error fetching adherence stats", { error: err, scheduleId: req.params.id });
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

// Get today's pending doses for all user's active schedules
router.get("/today/summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const queryResult = summaryQuerySchema.safeParse(req.query);
        if (!queryResult.success) {
            res.status(400).json({
                error: "Invalid query parameters",
                details: queryResult.error.flatten().fieldErrors,
            });
            return;
        }

        const { today: istToday, nowTime: istNowTime } = getIstDateTime();

        const today = queryResult.data.date || istToday;
        const nowTime = queryResult.data.time || istNowTime;

        const cacheKey = `schedules:summary:${req.user!.id}:${today}`;
        if (redisClient.isOpen) {
            try {
                const cached = await redisClient.get(cacheKey);
                if (cached) {
                    res.json(JSON.parse(cached));
                    return;
                }
            } catch (redisErr) {
                logger.error("Redis get error for today/summary", { error: redisErr, cacheKey });
            }
        }

        const { data: schedules, error: schedError } = await supabase
            .from("medicine_schedules")
            .select("*")
            .eq("user_id", req.user!.id)
            .eq("is_active", true)
            .lte("start_date", today)
            .or(`end_date.is.null,end_date.gte.${today}`);

        if (schedError) {
            res.status(500).json({ error: "Failed to fetch schedules" });
            return;
        }

        const scheduleIds = (schedules ?? []).map((s) => s.id);
        let allDoseLogs: any[] = [];

        if (scheduleIds.length > 0) {
            const { data: doseLogsData, error: doseLogsError } = await supabase
                .from("dose_logs")
                .select("*")
                .in("schedule_id", scheduleIds)
                .eq("user_id", req.user!.id)
                .eq("log_date", today);

            if (!doseLogsError && doseLogsData) {
                allDoseLogs = doseLogsData;
            }
        }

        const doseLogsBySchedule = new Map<string, any[]>();
        for (const log of allDoseLogs) {
            if (!doseLogsBySchedule.has(log.schedule_id)) {
                doseLogsBySchedule.set(log.schedule_id, []);
            }
            doseLogsBySchedule.get(log.schedule_id)!.push(log);
        }

        const todaySchedules = (schedules ?? []).map((schedule) => {
            const times = (schedule.times as string[]) ?? [];
            const loggedDoses = doseLogsBySchedule.get(schedule.id) ?? [];

            const loggedMap = new Map(loggedDoses.map((d) => [d.log_time.slice(0, 5), d.status]));

            const doses = times.map((time: string) => {
                const status = loggedMap.get(time);
                const isPast = time < nowTime;
                return {
                    time,
                    status: status ?? (isPast ? "pending" : "upcoming"),
                };
            });

            const allTaken = doses.every((d: { status: string }) => d.status === "taken");

            return {
                id: schedule.id,
                medicine_name: schedule.medicine_name,
                dosage: schedule.dosage,
                times: schedule.times,
                doses,
                completed: allTaken,
            };
        });

        const responseData = {
            date: today,
            schedules: todaySchedules,
        };

        if (redisClient.isOpen) {
            try {
                await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 86400 });
            } catch (redisErr) {
                logger.error("Redis set error for today/summary", { error: redisErr, cacheKey });
            }
        }

        res.json(responseData);
    } catch (err) {
        logger.error("Error fetching today's summary", { error: err });
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

export default router;
