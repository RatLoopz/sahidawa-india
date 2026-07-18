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
    deleteSchedule,
    fetchSchedules,
    fetchTodaySummary,
    logDose,
    updateSchedule,
    type Schedule,
    type TodaySchedule,
} from "@/lib/scheduleApi";
import { getCsrfToken } from "@/lib/api";
import { fetchWithRetry } from "@/lib/apiWithRetry";

const mockFetch = jest.fn();
const mockGetCsrfToken = jest.mocked(getCsrfToken);
const mockFetchWithRetry = jest.mocked(fetchWithRetry);

jest.mock("@/lib/api", () => ({
    API_BASE: "http://localhost:4000",
    getCsrfToken: jest.fn(),
}));

jest.mock("@/lib/apiWithRetry", () => ({
    fetchWithRetry: jest.fn(),
}));

describe("scheduleApi", () => {
    beforeEach(() => {
        mockFetch.mockReset();
        Object.defineProperty(global, "fetch", {
            value: mockFetch,
            writable: true,
        });
        localStorage.clear();
        mockGetCsrfToken.mockReset();
        mockGetCsrfToken.mockResolvedValue("csrf-token-123");
        mockFetchWithRetry.mockReset();
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
        expect(mockGetCsrfToken).not.toHaveBeenCalled();
        expect(mockFetchWithRetry).not.toHaveBeenCalled();
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
        mockFetchWithRetry.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ schedule: created }),
        } as Response);

        await expect(createSchedule(payload)).resolves.toEqual(created);
        expect(mockGetCsrfToken).toHaveBeenCalledTimes(1);
        expect(mockFetchWithRetry).toHaveBeenCalledWith("http://localhost:4000/api/schedules", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer token-123",
                "x-csrf-token": "csrf-token-123",
            },
            body: JSON.stringify(payload),
            credentials: "include",
        });
    });

    it("adds CSRF protection to schedule updates and deletions", async () => {
        localStorage.setItem("sb-access-token", "token-123");
        mockFetchWithRetry
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ schedule: { id: "schedule-1", dosage: "250mg" } }),
            } as Response)
            .mockResolvedValueOnce({ ok: true } as Response);

        await updateSchedule("schedule-1", { dosage: "250mg" });
        await deleteSchedule("schedule-1");

        expect(mockFetchWithRetry).toHaveBeenNthCalledWith(
            1,
            "http://localhost:4000/api/schedules/schedule-1",
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer token-123",
                    "x-csrf-token": "csrf-token-123",
                },
                body: JSON.stringify({ dosage: "250mg" }),
                credentials: "include",
            }
        );
        expect(mockFetchWithRetry).toHaveBeenNthCalledWith(
            2,
            "http://localhost:4000/api/schedules/schedule-1",
            {
                method: "DELETE",
                headers: {
                    Authorization: "Bearer token-123",
                    "x-csrf-token": "csrf-token-123",
                },
                credentials: "include",
            }
        );
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
        localStorage.setItem("sb-access-token", "token-123");
        mockFetchWithRetry.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ dose: createdDose }),
        } as Response);

        await expect(logDose("schedule-1", dosePayload)).resolves.toEqual(createdDose);
        expect(mockFetchWithRetry).toHaveBeenCalledWith(
            "http://localhost:4000/api/schedules/schedule-1/doses",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer token-123",
                    "x-csrf-token": "csrf-token-123",
                },
                body: JSON.stringify(dosePayload),
                credentials: "include",
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
        expect(mockGetCsrfToken).not.toHaveBeenCalled();
        expect(mockFetchWithRetry).not.toHaveBeenCalled();
    });
});
