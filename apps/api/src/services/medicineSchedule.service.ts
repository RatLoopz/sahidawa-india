import { z } from "zod";
import { uuidSchema } from "../utils/validation";
import { redisClient } from "../utils/redis";
import logger from "../utils/logger";
import { medicineScheduleRepository } from "../repositories/medicineSchedule.repository";

/**
 * Error carrying the HTTP status (and optional validation details) the route
 * layer should respond with. Anything the service throws that is NOT an
 * HttpError is treated by the route as an unexpected 500.
 */
export class HttpError extends Error {
    status: number;
    details?: unknown;
    constructor(status: number, message: string, details?: unknown) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

const SUMMARY_CACHE_BUCKET_MINUTES = 5;
const SUMMARY_CACHE_TTL_SECONDS = SUMMARY_CACHE_BUCKET_MINUTES * 60;

// ── Cache helpers ────────────────────────────────────────────────────────────

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

const getSummaryCacheBucket = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes;
    return Math.floor(totalMinutes / SUMMARY_CACHE_BUCKET_MINUTES);
};

// ── Date / time validation ───────────────────────────────────────────────────

/**
 * Checks that a "YYYY-MM-DD" string is a real calendar date
 * (rejects things like 2026-02-31, 2026-00-10, 2026-13-01, etc.)
 * Regex format is assumed to have already been validated.
 */
const isRealDateString = (value: string): boolean => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // Building the date in UTC and reading the parts back out catches rollover
    // (e.g. Date.UTC(2026, 1, 31) becomes March 3, which won't match day === 31).
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
};

/**
 * Checks that an "HH:MM" string is a real 24-hour time
 * (rejects things like 99:99, 24:00, 12:60, etc.)
 * Regex format is assumed to have already been validated.
 */
const isRealTimeString = (value: string): boolean => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return false;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

const dateStringSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .refine(isRealDateString, { message: "Date must be a real calendar date" });

const timeStringSchema = z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format")
    .refine(isRealTimeString, { message: "Time must be a real 24-hour time (00:00-23:59)" });

const frequencySchema = z.number().int().positive("Frequency must be at least 1");
const timesSchema = z.array(timeStringSchema).min(1, "At least one time is required");

const validateFrequencyAndTimes = (
    data: { frequency: number; times: string[] },
    ctx: z.RefinementCtx
) => {
    const uniqueTimeCount = new Set(data.times).size;

    if (uniqueTimeCount !== data.times.length) {
        ctx.addIssue({
            code: "custom",
            path: ["times"],
            message: "Dose times must be unique",
        });
    }

    if (data.frequency !== uniqueTimeCount) {
        ctx.addIssue({
            code: "custom",
            path: ["frequency"],
            message: "Frequency must match the number of unique dose times",
        });
    }
};

const frequencyTimesSchema = z
    .object({
        frequency: frequencySchema,
        times: timesSchema,
    })
    .superRefine(validateFrequencyAndTimes);

const createScheduleObjectSchema = z
    .object({
        medicine_name: z.string().min(1, "Medicine name is required"),
        dosage: z.string().min(1, "Dosage is required").default("1 tablet"),
        frequency: frequencySchema,
        times: timesSchema,
        start_date: dateStringSchema,
        end_date: dateStringSchema.nullable().optional(),
        notes: z.string().optional(),
        medicine_id: uuidSchema.nullable().optional(),
    })
    .strict();

const createScheduleSchema = createScheduleObjectSchema
    .superRefine(validateFrequencyAndTimes)
    .refine((data) => !data.end_date || data.end_date >= data.start_date, {
        message: "end_date must not be before start_date",
        path: ["end_date"],
    });

const updateScheduleSchema = createScheduleObjectSchema
    .partial()
    .superRefine((data, ctx) => {
        if (data.frequency !== undefined && data.times !== undefined) {
            validateFrequencyAndTimes({ frequency: data.frequency, times: data.times }, ctx);
        }
    })
    .refine((data) => !data.end_date || !data.start_date || data.end_date >= data.start_date, {
        message: "end_date must not be before start_date",
        path: ["end_date"],
    });

const doseSchema = z
    .object({
        log_date: dateStringSchema,
        log_time: timeStringSchema,
        status: z.enum(["taken", "skipped"]),
        taken_at: z.string().datetime().nullable().optional(),
    })
    .strict();

const statsSchema = z.object({
    from: dateStringSchema,
    to: dateStringSchema,
});

const summaryQuerySchema = z.object({
    date: dateStringSchema.optional(),
    time: timeStringSchema.optional(),
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

const requireValidUuid = (id: string) => {
    if (!uuidSchema.safeParse(id).success) {
        throw new HttpError(400, "Invalid UUID format");
    }
};

export const medicineScheduleService = {
    // GET /
    async listSchedules(userId: string) {
        const { data, error } = await medicineScheduleRepository.findAllByUser(userId);
        if (error) throw new HttpError(500, "Failed to fetch schedules");
        return { schedules: data ?? [] };
    },

    // GET /:id
    async getSchedule(id: string, userId: string) {
        requireValidUuid(id);

        const { data, error } = await medicineScheduleRepository.findByIdForUser(id, userId);
        if (error) throw new HttpError(500, "Failed to fetch schedule");
        if (!data) throw new HttpError(404, "Schedule not found");
        return { schedule: data };
    },

    // POST /
    async createSchedule(body: unknown, userId: string) {
        const parsed = createScheduleSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpError(400, "Invalid request body", parsed.error.flatten().fieldErrors);
        }

        const { data, error } = await medicineScheduleRepository.insertSchedule({
            user_id: userId,
            ...parsed.data,
        });
        if (error) throw new HttpError(500, "Failed to create schedule");

        await invalidateUserSummaryCaches(userId);
        return { schedule: data };
    },

    // PUT /:id
    async updateSchedule(id: string, body: unknown, userId: string) {
        requireValidUuid(id);

        const parsed = updateScheduleSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpError(400, "Invalid request body", parsed.error.flatten().fieldErrors);
        }

        const touchesDates =
            parsed.data.start_date !== undefined || parsed.data.end_date !== undefined;
        const touchesDoseTiming =
            parsed.data.frequency !== undefined || parsed.data.times !== undefined;
        const needsStoredDates =
            touchesDates &&
            (parsed.data.start_date === undefined || parsed.data.end_date === undefined);
        const needsStoredDoseTiming =
            touchesDoseTiming &&
            (parsed.data.frequency === undefined || parsed.data.times === undefined);

        let existing:
            | {
                  start_date: string;
                  end_date: string | null;
                  frequency: number;
                  times: string[];
              }
            | null
            | undefined;

        if (needsStoredDates || needsStoredDoseTiming) {
            const { data, error: fetchError } = await medicineScheduleRepository.findDatesAndTiming(
                id,
                userId
            );

            if (fetchError) throw new HttpError(500, "Failed to update schedule");
            if (!data) throw new HttpError(404, "Schedule not found");
            existing = data;
        }

        // If this update touches start_date or end_date, make sure the resulting
        // pair is never inverted — even when only one of the two is being changed,
        // in which case we need the current value of the other from the DB.
        if (touchesDates) {
            const effectiveStartDate = parsed.data.start_date ?? existing?.start_date;
            const effectiveEndDate =
                parsed.data.end_date !== undefined
                    ? parsed.data.end_date
                    : (existing?.end_date ?? undefined);

            if (effectiveEndDate && effectiveStartDate && effectiveEndDate < effectiveStartDate) {
                throw new HttpError(400, "end_date must not be before start_date");
            }
        }

        if (touchesDoseTiming) {
            const consistencyResult = frequencyTimesSchema.safeParse({
                frequency: parsed.data.frequency ?? existing?.frequency,
                times: parsed.data.times ?? existing?.times,
            });

            if (!consistencyResult.success) {
                throw new HttpError(
                    400,
                    "Invalid request body",
                    consistencyResult.error.flatten().fieldErrors
                );
            }
        }

        const { data, error } = await medicineScheduleRepository.updateSchedule(id, userId, {
            ...parsed.data,
            updated_at: new Date().toISOString(),
        });

        if (error) throw new HttpError(500, "Failed to update schedule");
        if (!data) throw new HttpError(404, "Schedule not found");

        await invalidateUserSummaryCaches(userId);
        return { schedule: data };
    },

    // DELETE /:id
    async deleteSchedule(id: string, userId: string) {
        requireValidUuid(id);

        const { data, error } = await medicineScheduleRepository.deleteSchedule(id, userId);
        if (error) throw new HttpError(500, "Failed to delete schedule");
        if (!data || data.length === 0) throw new HttpError(404, "Schedule not found");

        await invalidateUserSummaryCaches(userId);
        return { success: true };
    },

    // POST /:id/doses
    async logDose(id: string, body: unknown, userId: string) {
        requireValidUuid(id);

        const parsed = doseSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpError(400, "Invalid request body", parsed.error.flatten().fieldErrors);
        }

        const { data: schedule, error: fetchError } =
            await medicineScheduleRepository.findIdForUser(id, userId);

        if (fetchError || !schedule) throw new HttpError(404, "Schedule not found");

        const { data, error } = await medicineScheduleRepository.upsertDoseLog({
            schedule_id: id,
            user_id: userId,
            log_date: parsed.data.log_date,
            log_time: parsed.data.log_time,
            status: parsed.data.status,
            taken_at: parsed.data.taken_at ?? null,
        });

        if (error) throw new HttpError(500, "Failed to log dose");

        await invalidateUserSummaryCaches(userId);
        return { dose: data };
    },

    // GET /:id/doses
    async listDoseLogs(id: string, userId: string) {
        requireValidUuid(id);

        const { data, error } = await medicineScheduleRepository.findDoseLogsBySchedule(id, userId);
        if (error) throw new HttpError(500, "Failed to fetch dose logs");
        return { doses: data ?? [] };
    },

    // GET /:id/stats
    async getStats(id: string, query: unknown, userId: string) {
        requireValidUuid(id);

        const queryParsed = statsSchema.safeParse(query);
        if (!queryParsed.success) {
            throw new HttpError(400, "Invalid query parameters. Use from=YYYY-MM-DD&to=YYYY-MM-DD");
        }

        const { data: schedule, error: fetchError } =
            await medicineScheduleRepository.findByIdForUser(id, userId);

        if (fetchError || !schedule) throw new HttpError(404, "Schedule not found");

        const { from, to } = queryParsed.data;
        const fromDate = new Date(from);
        const toDate = new Date(to);

        if (fromDate > toDate) {
            throw new HttpError(400, "from date must be before to date");
        }

        const requestedDayCount =
            Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;

        if (requestedDayCount > 365) {
            throw new HttpError(400, "Date range cannot exceed 365 days");
        }

        const activeFrom = from > schedule.start_date ? from : schedule.start_date;
        const activeTo = schedule.end_date && schedule.end_date < to ? schedule.end_date : to;
        const hasActiveDays = activeFrom <= activeTo;
        const activeDayCount = hasActiveDays
            ? Math.round(
                  (new Date(activeTo).getTime() - new Date(activeFrom).getTime()) / 86400000
              ) + 1
            : 0;
        const expectedDoses = activeDayCount * schedule.frequency;

        const doseLogs: any[] = [];

        if (hasActiveDays) {
            let offset = 0;
            const DOSE_LOG_PAGE_SIZE = 500;

            while (true) {
                const { data: page, error: doseError } =
                    await medicineScheduleRepository.findDoseLogsPage(
                        id,
                        userId,
                        activeFrom,
                        activeTo,
                        offset,
                        DOSE_LOG_PAGE_SIZE
                    );

                if (doseError) throw new HttpError(500, "Failed to fetch adherence data");

                const currentPage = page ?? [];
                doseLogs.push(...currentPage);

                if (currentPage.length < DOSE_LOG_PAGE_SIZE) break;
                offset += DOSE_LOG_PAGE_SIZE;
            }
        }

        const takenCount = doseLogs.filter((d) => d.status === "taken").length;
        const skippedCount = doseLogs.filter((d) => d.status === "skipped").length;
        const adherencePercent =
            expectedDoses > 0 ? Math.round((takenCount / expectedDoses) * 100) : 100;

        return {
            stats: {
                expected_doses: expectedDoses,
                taken: takenCount,
                skipped: skippedCount,
                adherence_percent: adherencePercent,
                period: { from, to },
            },
            doses: doseLogs,
        };
    },

    // GET /today/summary
    async getTodaySummary(query: unknown, userId: string) {
        const queryResult = summaryQuerySchema.safeParse(query);
        if (!queryResult.success) {
            throw new HttpError(
                400,
                "Invalid query parameters",
                queryResult.error.flatten().fieldErrors
            );
        }

        const { today: istToday, nowTime: istNowTime } = getIstDateTime();

        const today = queryResult.data.date || istToday;
        const nowTime = queryResult.data.time || istNowTime;

        const cacheBucket = getSummaryCacheBucket(nowTime);
        const cacheKey = `schedules:summary:${userId}:${today}:${cacheBucket}`;
        if (redisClient.isOpen) {
            try {
                const cached = await redisClient.get(cacheKey);
                if (cached) {
                    return JSON.parse(cached);
                }
            } catch (redisErr) {
                logger.error("Redis get error for today/summary", { error: redisErr, cacheKey });
            }
        }

        const { data: schedules, error: schedError } =
            await medicineScheduleRepository.findActiveSchedulesForDate(userId, today);

        if (schedError) throw new HttpError(500, "Failed to fetch schedules");

        const scheduleIds = (schedules ?? []).map((s) => s.id);
        let allDoseLogs: any[] = [];

        if (scheduleIds.length > 0) {
            const { data: doseLogsData, error: doseLogsError } =
                await medicineScheduleRepository.findDoseLogsForSchedulesOnDate(
                    scheduleIds,
                    userId,
                    today
                );

            if (doseLogsError) throw new HttpError(500, "Failed to fetch dose logs");
            allDoseLogs = doseLogsData ?? [];
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
                await redisClient.set(cacheKey, JSON.stringify(responseData), {
                    EX: SUMMARY_CACHE_TTL_SECONDS,
                });
            } catch (redisErr) {
                logger.error("Redis set error for today/summary", { error: redisErr, cacheKey });
            }
        }

        return responseData;
    },
};
