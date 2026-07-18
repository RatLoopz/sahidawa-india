import { API_BASE } from "./api";
import localforage from "localforage";

// SSR safe helper to prevent server-side crashes during Next.js build
function getOfflineQueueStore() {
    if (typeof window === "undefined") return null;
    return localforage.createInstance({
        name: "sahidawa-offline-queue",
        storeName: "doseLogs",
    });
}

export interface Schedule {
    id: string;
    user_id: string;
    medicine_id: string | null;
    medicine_name: string;
    dosage: string;
    frequency: number;
    times: string[];
    start_date: string;
    end_date: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface DoseLog {
    id: string;
    schedule_id: string;
    user_id: string;
    log_date: string;
    log_time: string;
    status: "taken" | "skipped";
    taken_at: string | null;
    created_at: string;
}

export interface TodaySchedule {
    id: string;
    medicine_name: string;
    dosage: string;
    times: string[];
    doses: { time: string; status: string }[];
    completed: boolean;
}

export interface AdherenceStats {
    expected_doses: number;
    taken: number;
    skipped: number;
    adherence_percent: number;
    period: { from: string; to: string };
}

function getToken(): string {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("sb-access-token") ?? "";
}

function authHeaders(): Record<string, string> {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchSchedules(): Promise<Schedule[]> {
    const res = await fetch(`${API_BASE}/api/schedules`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch schedules");
    const json = await res.json();
    return json.schedules ?? [];
}

export async function fetchSchedule(id: string): Promise<Schedule> {
    const res = await fetch(`${API_BASE}/api/schedules/${id}`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch schedule");
    const json = await res.json();
    return json.schedule;
}

export async function createSchedule(data: {
    medicine_name: string;
    dosage?: string;
    frequency: number;
    times: string[];
    start_date: string;
    end_date?: string | null;
    notes?: string;
    medicine_id?: string | null;
}): Promise<Schedule> {
    const res = await fetch(`${API_BASE}/api/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(body.error ?? "Failed to create schedule");
    }
    const json = await res.json();
    return json.schedule;
}

export async function updateSchedule(
    id: string,
    data: Partial<{
        medicine_name: string;
        dosage: string;
        frequency: number;
        times: string[];
        start_date: string;
        end_date: string | null;
        notes: string;
        is_active: boolean;
    }>
): Promise<Schedule> {
    const res = await fetch(`${API_BASE}/api/schedules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(body.error ?? "Failed to update schedule");
    }
    const json = await res.json();
    return json.schedule;
}

export async function deleteSchedule(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/schedules/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete schedule");
}

/**
 * Logs a single dose event (taken or skipped) for a given schedule.
 */

export async function logDose(
    scheduleId: string,
    data: { log_date: string; log_time: string; status: "taken" | "skipped" }
): Promise<DoseLog> {
    try {
        const res = await fetch(`${API_BASE}/api/schedules/${scheduleId}/doses`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(body.error ?? "Failed to log dose");
        }
        const json = await res.json();
        return json.dose;
    } catch (error: any) {
        const isNetworkError =
            error instanceof TypeError || (error && error.message === "Failed to fetch");

        // If device is offline or request faces generic network drop, run local queue logic
        if (typeof window !== "undefined" && (!window.navigator.onLine || isNetworkError)) {
            const requestId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const offlinePayload = {
                id: requestId,
                scheduleId,
                data,
                timestamp: new Date().toISOString(),
            };

            if (offlineDoseQueue) {
                const currentQueue: any[] = (await offlineDoseQueue.getItem("queuedDoses")) ?? [];
                currentQueue.push(offlinePayload);
                await offlineDoseQueue.setItem("queuedDoses", currentQueue);
            }

            return {
                id: requestId,
                schedule_id: scheduleId,
                user_id: "offline_user",
                log_date: data.log_date,
                log_time: data.log_time,
                status: data.status,
                taken_at: data.status === "taken" ? new Date().toISOString() : null,
                created_at: new Date().toISOString(),
            };
        }

        throw error;
    }
}

/**
 * Fetches all dose logs for a specific schedule.
 *
 * @param {string} scheduleId - The unique identifier of the schedule.
 * @returns {Promise<DoseLog[]>} A promise that resolves to an array of DoseLog objects.
 *                               Returns an empty array if the API response contains no doses.
 * @throws {Error} Throws "Failed to fetch dose logs" if the API returns a non-2xx response.
 */
export async function fetchDoseLogs(scheduleId: string): Promise<DoseLog[]> {
    const res = await fetch(`${API_BASE}/api/schedules/${scheduleId}/doses`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch dose logs");
    const json = await res.json();
    return json.doses ?? [];
}

/**
 * Fetches adherence statistics for a schedule over a given date range.
 *
 * @param {string} scheduleId - The unique identifier of the schedule.
 * @param {string} from - The start date of the range (ISO format YYYY-MM-DD).
 * @param {string} to - The end date of the range (ISO format YYYY-MM-DD).
 * @returns {Promise<{ stats: AdherenceStats; doses: DoseLog[] }>} A promise that resolves to an
 *          object containing aggregated adherence stats and the corresponding dose logs.
 * @throws {Error} Throws "Failed to fetch adherence stats" if the API returns a non-2xx response.
 */
export async function fetchAdherenceStats(
    scheduleId: string,
    from: string,
    to: string
): Promise<{ stats: AdherenceStats; doses: DoseLog[] }> {
    const res = await fetch(`${API_BASE}/api/schedules/${scheduleId}/stats?from=${from}&to=${to}`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch adherence stats");
    return res.json() as Promise<{ stats: AdherenceStats; doses: DoseLog[] }>;
}

/**
 * Fetches today's summary of all scheduled doses for the authenticated user.
 *
 * @returns {Promise<{ date: string; schedules: TodaySchedule[] }>} A promise that resolves to an
 *          object containing today's date and the list of today's scheduled doses with their statuses.
 * @throws {Error} Throws "Failed to fetch today summary" if the API returns a non-2xx response.
 */
export async function fetchTodaySummary(): Promise<{
    date: string;
    schedules: TodaySchedule[];
}> {
    const res = await fetch(`${API_BASE}/api/schedules/today/summary`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch today summary");
    return res.json() as Promise<{ date: string; schedules: TodaySchedule[] }>;
}
