import { API_BASE } from "./api";

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

/**
 * Fetches all medication schedules for the authenticated user.
 *
 * @returns {Promise<Schedule[]>} A promise that resolves to an array of Schedule objects.
 *                                Returns an empty array if the API response contains no schedules.
 * @throws {Error} Throws "Failed to fetch schedules" if the API returns a non-2xx response.
 */
export async function fetchSchedules(): Promise<Schedule[]> {
    const res = await fetch(`${API_BASE}/api/schedules`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch schedules");
    const json = await res.json();
    return json.schedules ?? [];
}

/**
 * Fetches a single medication schedule by its unique ID.
 *
 * @param {string} id - The unique identifier of the schedule to fetch.
 * @returns {Promise<Schedule>} A promise that resolves to the requested Schedule object.
 * @throws {Error} Throws "Failed to fetch schedule" if the API returns a non-2xx response.
 */
export async function fetchSchedule(id: string): Promise<Schedule> {
    const res = await fetch(`${API_BASE}/api/schedules/${id}`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch schedule");
    const json = await res.json();
    return json.schedule;
}

/**
 * Creates a new medication schedule for the authenticated user.
 *
 * @param {Object} data - The schedule data to create.
 * @param {string} data.medicine_name - The name of the medicine.
 * @param {string} [data.dosage] - The dosage (e.g., "500mg"). Optional.
 * @param {number} data.frequency - The number of times the medicine should be taken per day.
 * @param {string[]} data.times - Array of times (HH:mm) when doses should be taken.
 * @param {string} data.start_date - The start date for the schedule (ISO format YYYY-MM-DD).
 * @param {string|null} [data.end_date] - The optional end date for the schedule, or null for open-ended.
 * @param {string} [data.notes] - Optional notes about the schedule.
 * @param {string|null} [data.medicine_id] - Optional reference to a medicine in the database.
 * @returns {Promise<Schedule>} A promise that resolves to the newly created Schedule object.
 * @throws {Error} Throws an error with the server-provided message or "Failed to create schedule"
 *                 if the API returns a non-2xx response.
 */
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

/**
 * Updates an existing medication schedule by ID with the provided partial data.
 *
 * @param {string} id - The unique identifier of the schedule to update.
 * @param {Partial<Object>} data - The partial schedule fields to update.
 * @param {string} [data.medicine_name] - Updated medicine name.
 * @param {string} [data.dosage] - Updated dosage.
 * @param {number} [data.frequency] - Updated frequency (doses per day).
 * @param {string[]} [data.times] - Updated array of dose times.
 * @param {string} [data.start_date] - Updated start date (ISO format YYYY-MM-DD).
 * @param {string|null} [data.end_date] - Updated end date, or null for open-ended.
 * @param {string} [data.notes] - Updated notes.
 * @param {boolean} [data.is_active] - Whether the schedule is currently active.
 * @returns {Promise<Schedule>} A promise that resolves to the updated Schedule object.
 * @throws {Error} Throws an error with the server-provided message or "Failed to update schedule"
 *                 if the API returns a non-2xx response.
 */
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

/**
 * Deletes a medication schedule by its unique ID.
 *
 * @param {string} id - The unique identifier of the schedule to delete.
 * @returns {Promise<void>} A promise that resolves when the schedule is successfully deleted.
 * @throws {Error} Throws "Failed to delete schedule" if the API returns a non-2xx response.
 */
export async function deleteSchedule(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/schedules/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete schedule");
}

/**
 * Logs a single dose event (taken or skipped) for a given schedule.
 *
 * @param {string} scheduleId - The unique identifier of the schedule the dose belongs to.
 * @param {Object} data - The dose log data.
 * @param {string} data.log_date - The date the dose was logged (ISO format YYYY-MM-DD).
 * @param {string} data.log_time - The scheduled time of the dose (HH:mm).
 * @param {"taken"|"skipped"} data.status - The status of the dose.
 * @returns {Promise<DoseLog>} A promise that resolves to the created DoseLog object.
 * @throws {Error} Throws an error with the server-provided message or "Failed to log dose"
 *                 if the API returns a non-2xx response.
 */
export async function logDose(
    scheduleId: string,
    data: { log_date: string; log_time: string; status: "taken" | "skipped" }
): Promise<DoseLog> {
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
