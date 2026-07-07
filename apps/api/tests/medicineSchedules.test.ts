process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";

jest.mock(
    "rate-limit-redis",
    () => ({
        RedisStore: jest.fn(),
    }),
    { virtual: true }
);

const mockSupabaseChain = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    or: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    error: null,
    data: null,
};

jest.mock("../src/db/client", () => ({
    supabase: mockSupabaseChain,
}));

const mockRedisClient = {
    isOpen: false,
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    scanIterator: jest.fn(() => (async function* () {})()),
};

jest.mock("../src/utils/redis", () => ({
    redisClient: mockRedisClient,
}));

jest.mock("../src/middleware/auth", () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: "test-user-id", email: "test@example.com", role: "user" };
        next();
    },
    optionalAuth: (_req: any, _res: any, next: any) => next(),
    requireRole:
        (..._roles: string[]) =>
        (_req: any, _res: any, next: any) =>
            next(),
    AuthenticatedRequest: Object,
}));

import request from "supertest";
import express from "express";
import medicineSchedulesRouter from "../src/routes/medicineSchedules";
import { redisClient } from "../src/utils/redis";

const app = express();
app.use(express.json());
app.use("/api/schedules", medicineSchedulesRouter);

const mockedSupabase = mockSupabaseChain as jest.Mocked<typeof mockSupabaseChain>;

beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockedSupabase).forEach((value) => {
        if (jest.isMockFunction(value)) {
            value.mockReset();
        }
    });
    mockedSupabase.from.mockReturnValue(mockedSupabase);
    mockedSupabase.select.mockReturnValue(mockedSupabase);
    mockedSupabase.insert.mockReturnValue(mockedSupabase);
    mockedSupabase.update.mockReturnValue(mockedSupabase);
    mockedSupabase.delete.mockReturnValue(mockedSupabase);
    mockedSupabase.upsert.mockReturnValue(mockedSupabase);
    mockedSupabase.eq.mockReturnValue(mockedSupabase);
    mockedSupabase.order.mockReturnValue(mockedSupabase);
    mockedSupabase.gte.mockReturnValue(mockedSupabase);
    mockedSupabase.lte.mockReturnValue(mockedSupabase);
    mockedSupabase.or.mockReturnValue(mockedSupabase);
    mockedSupabase.in.mockReturnValue(mockedSupabase);
    (redisClient as any).isOpen = false;
    (redisClient.get as jest.Mock).mockResolvedValue(null);
    (redisClient.set as jest.Mock).mockResolvedValue("OK");
    (redisClient.del as jest.Mock).mockResolvedValue(1);
    (redisClient.scanIterator as jest.Mock).mockReturnValue((async function* () {})());
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("GET /api/schedules", () => {
    it("returns empty list when no schedules", async () => {
        mockedSupabase.single.mockResolvedValue({ data: null, error: null });
        mockedSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.order as jest.Mock).mockResolvedValue({ data: [], error: null });

        const res = await request(app)
            .get("/api/schedules")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(200);
        expect(res.body.schedules).toEqual([]);
    });

    it("returns schedules list", async () => {
        const mockSchedules = [
            {
                id: "sched-1",
                user_id: "test-user-id",
                medicine_name: "Paracetamol",
                dosage: "1 tablet",
                frequency: 2,
                times: ["08:00", "20:00"],
                start_date: "2026-06-01",
                end_date: null,
                notes: "Take after food",
                is_active: true,
                created_at: "2026-06-01T00:00:00Z",
                updated_at: "2026-06-01T00:00:00Z",
            },
        ];

        mockedSupabase.single.mockResolvedValue({ data: null, error: null });
        mockedSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.order as jest.Mock).mockResolvedValue({ data: mockSchedules, error: null });

        const res = await request(app)
            .get("/api/schedules")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(200);
        expect(res.body.schedules).toHaveLength(1);
        expect(res.body.schedules[0].medicine_name).toBe("Paracetamol");
    });
});

describe("POST /api/schedules", () => {
    it("returns 400 when required fields are missing", async () => {
        const res = await request(app)
            .post("/api/schedules")
            .set("Authorization", "Bearer test-token")
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid request body");
    });

    it("creates a new schedule", async () => {
        const newSchedule = {
            medicine_name: "Amoxicillin",
            dosage: "1 capsule",
            frequency: 3,
            times: ["06:00", "14:00", "22:00"],
            start_date: "2026-06-10",
            notes: "Take with water",
        };

        const createdSchedule = {
            id: "sched-new",
            user_id: "test-user-id",
            ...newSchedule,
            end_date: null,
            is_active: true,
            created_at: "2026-06-10T00:00:00Z",
            updated_at: "2026-06-10T00:00:00Z",
        };

        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.insert as jest.Mock).mockReturnValue(mockedSupabase);
        mockedSupabase.single.mockResolvedValue({ data: createdSchedule, error: null });

        const res = await request(app)
            .post("/api/schedules")
            .set("Authorization", "Bearer test-token")
            .send(newSchedule);

        expect(res.status).toBe(201);
        expect(res.body.schedule.medicine_name).toBe("Amoxicillin");
        expect(res.body.schedule.frequency).toBe(3);
    });
});

describe("GET /api/schedules/:id", () => {
    it("returns 400 for non-UUID schedule ID", async () => {
        const res = await request(app)
            .get("/api/schedules/nonexistent")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(400);
    });

    it("returns 404 when schedule not found", async () => {
        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);
        mockedSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });

        const res = await request(app)
            .get("/api/schedules/00000000-0000-4000-8000-000000000001")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(404);
    });

    it("returns schedule by id", async () => {
        const mockSchedule = {
            id: "sched-1",
            user_id: "test-user-id",
            medicine_name: "Ibuprofen",
            dosage: "1 tablet",
            frequency: 2,
            times: ["08:00", "20:00"],
            start_date: "2026-06-01",
            end_date: null,
            notes: null,
            is_active: true,
            created_at: "2026-06-01T00:00:00Z",
            updated_at: "2026-06-01T00:00:00Z",
        };

        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);
        mockedSupabase.maybeSingle.mockResolvedValue({ data: mockSchedule, error: null });

        const res = await request(app)
            .get("/api/schedules/00000000-0000-4000-8000-000000000001")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(200);
        expect(res.body.schedule.medicine_name).toBe("Ibuprofen");
    });
});

describe("PUT /api/schedules/:id", () => {
    it("updates a schedule", async () => {
        const updatedSchedule = {
            ...mockUpdatedSchedule,
            medicine_name: "Ibuprofen (Updated)",
            notes: "Take before food",
        };

        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.update as jest.Mock).mockReturnValue(mockedSupabase);
        mockedSupabase.single.mockResolvedValue({ data: updatedSchedule, error: null });

        const res = await request(app)
            .put("/api/schedules/00000000-0000-4000-8000-000000000001")
            .set("Authorization", "Bearer test-token")
            .send({ medicine_name: "Ibuprofen (Updated)", notes: "Take before food" });

        expect(res.status).toBe(200);
        expect(res.body.schedule.medicine_name).toBe("Ibuprofen (Updated)");
    });
});

describe("DELETE /api/schedules/:id", () => {
    it("deletes a schedule", async () => {
        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.delete as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockResolvedValue({
            data: [{ id: "00000000-0000-4000-8000-000000000001" }],
            error: null,
        });

        const res = await request(app)
            .delete("/api/schedules/00000000-0000-4000-8000-000000000001")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockedSupabase.select).toHaveBeenCalledWith("id");
    });

    it("returns 404 when no matching schedule is deleted", async () => {
        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.delete as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockResolvedValue({
            data: [],
            error: null,
        });

        const res = await request(app)
            .delete("/api/schedules/00000000-0000-4000-8000-000000000999")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Schedule not found");
    });

    it("returns 404 when a schedule is not owned by the user", async () => {
        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.delete as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockResolvedValue({
            data: [],
            error: null,
        });

        const res = await request(app)
            .delete("/api/schedules/00000000-0000-4000-8000-000000000002")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Schedule not found");
        expect(mockedSupabase.eq).toHaveBeenCalledWith("user_id", "test-user-id");
    });
});

describe("POST /api/schedules/:id/doses", () => {
    it("logs a dose as taken", async () => {
        const doseEntry = {
            id: "dose-1",
            schedule_id: "sched-1",
            user_id: "test-user-id",
            log_date: "2026-06-10",
            log_time: "08:00",
            status: "taken",
            taken_at: "2026-06-10T08:05:00Z",
            created_at: "2026-06-10T08:05:00Z",
        };

        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);
        // First call: maybeSingle to verify schedule exists
        mockedSupabase.maybeSingle.mockResolvedValueOnce({
            data: { id: "sched-1" },
            error: null,
        });
        // Second call: single for the upsert result
        mockedSupabase.single.mockResolvedValue({ data: doseEntry, error: null });

        const res = await request(app)
            .post("/api/schedules/00000000-0000-4000-8000-000000000001/doses")
            .set("Authorization", "Bearer test-token")
            .send({
                log_date: "2026-06-10",
                log_time: "08:00",
                status: "taken",
            });

        expect(res.status).toBe(200);
        expect(res.body.dose.status).toBe("taken");
    });

    it("invalidates all bucketed summary caches after logging a dose", async () => {
        (redisClient as any).isOpen = true;
        (redisClient.scanIterator as jest.Mock).mockReturnValue(
            (async function* () {
                yield "schedules:summary:test-user-id:2026-06-10:96";
                yield "schedules:summary:test-user-id:2026-06-10:97";
            })()
        );

        const doseEntry = {
            id: "dose-1",
            schedule_id: "sched-1",
            user_id: "test-user-id",
            log_date: "2026-06-10",
            log_time: "08:00",
            status: "taken",
            taken_at: null,
            created_at: "2026-06-10T08:05:00Z",
        };

        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);
        mockedSupabase.maybeSingle.mockResolvedValueOnce({
            data: { id: "sched-1" },
            error: null,
        });
        mockedSupabase.single.mockResolvedValue({ data: doseEntry, error: null });

        const res = await request(app)
            .post("/api/schedules/00000000-0000-4000-8000-000000000001/doses")
            .set("Authorization", "Bearer test-token")
            .send({
                log_date: "2026-06-10",
                log_time: "08:00",
                status: "taken",
            });

        expect(res.status).toBe(200);
        expect(redisClient.scanIterator).toHaveBeenCalledWith({
            MATCH: "schedules:summary:test-user-id:*",
            COUNT: 100,
        });
        expect(redisClient.del).toHaveBeenCalledWith(
            "schedules:summary:test-user-id:2026-06-10:96"
        );
        expect(redisClient.del).toHaveBeenCalledWith(
            "schedules:summary:test-user-id:2026-06-10:97"
        );
    });
});

describe("GET /api/schedules/today/summary", () => {
    it("returns today's summary", async () => {
        const activeSchedules = [
            {
                id: "sched-1",
                medicine_name: "Paracetamol",
                dosage: "1 tablet",
                times: ["08:00", "20:00"],
                frequency: 2,
                user_id: "test-user-id",
                start_date: "2026-01-01",
                end_date: null,
                notes: null,
                is_active: true,
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
            },
        ];

        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.lte as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.gte as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.or as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.order as jest.Mock).mockReturnValue(mockedSupabase);
        mockedSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
        // First call: fetch schedules
        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.lte as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.or as jest.Mock).mockResolvedValueOnce({
            data: activeSchedules,
            error: null,
        });

        // Second call: fetch dose logs for schedule
        (mockedSupabase.select as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.in as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockResolvedValueOnce({
            data: [
                {
                    id: "dose-1",
                    log_time: "08:00",
                    status: "taken",
                },
            ],
            error: null,
        });

        const res = await request(app)
            .get("/api/schedules/today/summary")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(200);
        expect(res.body.schedules).toHaveLength(1);
        expect(res.body.schedules[0].medicine_name).toBe("Paracetamol");
    });

    it("uses the IST calendar date before UTC midnight", async () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-06-13T20:00:00.000Z")); // 01:30 IST on 2026-06-14

        const activeSchedules = [
            {
                id: "sched-1",
                medicine_name: "Paracetamol",
                dosage: "1 tablet",
                times: ["01:00", "08:00"],
                frequency: 2,
                user_id: "test-user-id",
                start_date: "2026-06-14",
                end_date: null,
                notes: null,
                is_active: true,
                created_at: "2026-06-14T00:00:00Z",
                updated_at: "2026-06-14T00:00:00Z",
            },
        ];

        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.lte as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.or as jest.Mock).mockResolvedValueOnce({
            data: activeSchedules,
            error: null,
        });

        (mockedSupabase.select as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockResolvedValueOnce({
            data: [],
            error: null,
        });

        const res = await request(app)
            .get("/api/schedules/today/summary")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(200);
        expect(res.body.date).toBe("2026-06-14");
        expect(mockedSupabase.lte).toHaveBeenCalledWith("start_date", "2026-06-14");
        expect(mockedSupabase.or).toHaveBeenCalledWith("end_date.is.null,end_date.gte.2026-06-14");
        expect(mockedSupabase.eq).toHaveBeenCalledWith("log_date", "2026-06-14");
        expect(res.body.schedules[0].doses).toEqual([
            { time: "01:00", status: "pending" },
            { time: "08:00", status: "upcoming" },
        ]);
        jest.useRealTimers();
    });

    it("uses a 5-minute time bucket and short TTL for Redis summary cache", async () => {
        (redisClient as any).isOpen = true;
        (redisClient.get as jest.Mock).mockResolvedValue(null);

        const activeSchedules = [
            {
                id: "sched-1",
                medicine_name: "Paracetamol",
                dosage: "1 tablet",
                times: ["01:00", "08:00"],
                frequency: 2,
                user_id: "test-user-id",
                start_date: "2026-06-14",
                end_date: null,
                notes: null,
                is_active: true,
                created_at: "2026-06-14T00:00:00Z",
                updated_at: "2026-06-14T00:00:00Z",
            },
        ];

        (mockedSupabase.from as jest.Mock).mockReturnValue(mockedSupabase);
        (mockedSupabase.select as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.lte as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.or as jest.Mock).mockResolvedValueOnce({
            data: activeSchedules,
            error: null,
        });

        (mockedSupabase.select as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.in as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockReturnValueOnce(mockedSupabase);
        (mockedSupabase.eq as jest.Mock).mockResolvedValueOnce({
            data: [],
            error: null,
        });

        const res = await request(app)
            .get("/api/schedules/today/summary?date=2026-06-14&time=01:34")
            .set("Authorization", "Bearer test-token");

        expect(res.status).toBe(200);
        expect(redisClient.get).toHaveBeenCalledWith(
            "schedules:summary:test-user-id:2026-06-14:18"
        );
        expect(redisClient.set).toHaveBeenCalledWith(
            "schedules:summary:test-user-id:2026-06-14:18",
            expect.any(String),
            { EX: 300 }
        );
    });
});

const mockUpdatedSchedule = {
    id: "sched-1",
    user_id: "test-user-id",
    medicine_name: "Ibuprofen (Updated)",
    dosage: "1 tablet",
    frequency: 2,
    times: ["08:00", "20:00"],
    start_date: "2026-06-01",
    end_date: null,
    notes: "Take before food",
    is_active: true,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
};
