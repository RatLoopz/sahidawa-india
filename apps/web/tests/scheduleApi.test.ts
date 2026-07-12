/** @jest-environment jsdom */

import {
    describe,
    it,
    expect,
    jest,
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
} from "@jest/globals";
import {
    createSchedule,
    fetchSchedules,
    fetchTodaySummary,
    logDose,
    type Schedule,
    type TodaySchedule,
} from "@/lib/scheduleApi";

const mockFetch = jest.fn();

describe("scheduleApi", () => {
    beforeEach(() => {
        mockFetch.mockReset();
        Object.defineProperty(global, "fetch", {
            value: mockFetch,
            writable: true,
        });
        localStorage.clear();
    });

    it("returns parsed schedules from fetchSchedules on a 200 response", async () => {
        const schedules: Schedule[] = [
            {
                id: "schedule-1",
                user_id: "user-1",
                medicine_id: null,
                medicine_name: "Dolo 650",
                dosage: "650mg",
                frequency: 2,
                times: ["08:00", "20:00"],
                start_date: "2027-01-01",
                end_date: null,
                notes: null,
                is_active: true,
                created_at: "2027-01-01T00:00:00Z",
                updated_at: "2027-01-01T00:00:00Z",
            },
        ];
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ schedules }),
        });

        await expect(fetchSchedules()).resolves.toEqual(schedules);
        expect(mockFetch).toHaveBeenCalledWith("http://localhost:4000/api/schedules", {
            headers: {},
        });
    });

    it("throws when fetchSchedules receives a non-OK response", async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

        await expect(fetchSchedules()).rejects.toThrow("Failed to fetch schedules");
    });

    it("sends createSchedule as a JSON POST with auth headers", async () => {
        localStorage.setItem("sb-access-token", "token-123");
        const payload = {
            medicine_name: "Paracetamol",
            dosage: "500mg",
            frequency: 1,
            times: ["09:00"],
            start_date: "2027-01-01",
            end_date: null,
            notes: "After breakfast",
            medicine_id: null,
        };
        const created = { id: "schedule-1", ...payload };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ schedule: created }),
        });

        await expect(createSchedule(payload)).resolves.toEqual(created);
        expect(mockFetch).toHaveBeenCalledWith("http://localhost:4000/api/schedules", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer token-123",
            },
            body: JSON.stringify(payload),
        });
    });

    it("sends logDose as a JSON POST to the schedule doses endpoint", async () => {
        const dosePayload = {
            log_date: "2027-01-01",
            log_time: "09:00",
            status: "taken" as const,
        };
        const createdDose = {
            id: "dose-1",
            schedule_id: "schedule-1",
            user_id: "user-1",
            taken_at: "2027-01-01T09:00:00Z",
            created_at: "2027-01-01T09:00:00Z",
            ...dosePayload,
        };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ dose: createdDose }),
        });

        await expect(logDose("schedule-1", dosePayload)).resolves.toEqual(createdDose);
        expect(mockFetch).toHaveBeenCalledWith(
            "http://localhost:4000/api/schedules/schedule-1/doses",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dosePayload),
            }
        );
    });

    it("returns parsed today summary data", async () => {
        const schedules: TodaySchedule[] = [
            {
                id: "schedule-1",
                medicine_name: "Dolo 650",
                dosage: "650mg",
                times: ["08:00"],
                doses: [{ time: "08:00", status: "taken" }],
                completed: true,
            },
        ];
        const summary = { date: "2027-01-01", schedules };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => summary,
        });

        await expect(fetchTodaySummary()).resolves.toEqual(summary);
        expect(mockFetch).toHaveBeenCalledWith(
            "http://localhost:4000/api/schedules/today/summary",
            { headers: {} }
        );
    });
});
