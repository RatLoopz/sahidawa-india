import { API_BASE, getCsrfToken } from "./api";
import { fetchWithRetry, offlineRequestQueue, DoseQueuedOfflineError } from "./apiWithRetry";
import { readCacheGet, readCachePut } from "./offline/db";

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

/**
 * Extract the authenticated user's id (the JWT `sub` claim) from the Supabase
 * access token, used only to namespace the offline read cache per user so a
 * shared device never serves one user's cached PHI to another.
 *
 * The token is not verified here — that's the server's job. A forged `sub` can
 * only ever scope a cache entry to itself, so it cannot expose another user's
 * cached data. Returns "" when no valid token is present (e.g. after logout),
 * which disables read caching entirely for that request.
 */
function getUserId(): string {
    const token = getToken();
    const parts = token.split(".");
    if (parts.length !== 3) return "";
    try {
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
        const payload = JSON.parse(atob(padded));
        return typeof payload?.sub === "string" ? payload.sub : "";
    } catch {
        return "";
    }
}

function authHeaders(): Record<string, string> {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function scheduleMutationFetch(url: string, options: RequestInit): Promise<Response> {
    const csrfToken = await getCsrfToken();
    return fetchWithRetry(url, {
        ...options,
        headers: {
            ...(options.headers as Record<string, string> | undefined),
            "x-csrf-token": csrfToken,
        },
        credentials: "include",
    });
}

/**
 * Fetches all medication schedules for the authenticated user.
 *
 * On success the response is cached locally so it can be served while offline.
 *
 * @returns {Promise<Schedule[]>} A promise that resolves to an array of Schedule objects.
 *                                Returns an empty array if the API response contains no schedules.
 * @throws {Error} Throws "Failed to fetch schedules" on a non-2xx response, or the underlying
 *                 network error when offline and no cached copy is available.
 */
export async function fetchSchedules(): Promise<Schedule[]> {
    let res: Response;
    try {
        res = await fetch(`${API_BASE}/api/schedules`, {
            headers: authHeaders(),
        });
    } catch (err) {
        // fetch() itself throwing means a genuine network/offline failure (a
        // reachable server that returns an HTTP error resolves normally, below).
        const cached = await readCacheGet<Schedule[]>("schedules", getUserId());
        if (cached) return cached;
        throw err;
    }
    if (!res.ok) throw new Error("Failed to fetch schedules");
    const json = await res.json();
    const schedules: Schedule[] = json.schedules ?? [];
    void readCachePut("schedules", getUserId(), schedules);
    return schedules;
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
    const res = await scheduleMutationFetch(`${API_BASE}/api/schedules`, {
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
    const res = await scheduleMutationFetch(`${API_BASE}/api/schedules/${id}`, {
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
    const res = await scheduleMutationFetch(`${API_BASE}/api/schedules/${id}`, {
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
    const url = `${API_BASE}/api/schedules/${scheduleId}/doses`;
    const body = JSON.stringify(data);

    try {
        const res = await scheduleMutationFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body,
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(errBody.error ?? "Failed to log dose");
        }
        const json = await res.json();
        return json.dose;
    } catch (err) {
        const isOffline = typeof window !== "undefined" && !window.navigator.onLine;
        const isNetworkError =
            err instanceof Error &&
            (err.message.toLowerCase().includes("offline") ||
                err.message.toLowerCase().includes("failed to fetch") ||
                err.name === "TypeError");

        // Only queue genuine connectivity failures — not validation/auth errors (400/401/403/404)
        if (isOffline || isNetworkError) {
            const csrfToken = await getCsrfToken();
            offlineRequestQueue.add(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders(),
                    "x-csrf-token": csrfToken,
                },
                credentials: "include",
                body,
            });
            throw new DoseQueuedOfflineError();
        }

        throw err;
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
 * On success the response is cached locally. When offline, the last cached copy
 * is returned instead with `fromCache: true` so the UI can flag stale data.
 *
 * @returns {Promise<{ date: string; schedules: TodaySchedule[]; fromCache?: boolean }>} A promise
 *          that resolves to today's date and scheduled doses. `fromCache` is set only when the
 *          data was served from the offline cache after a network failure.
 * @throws {Error} Throws "Failed to fetch today summary" on a non-2xx response, or the underlying
 *                 network error when offline and no cached copy is available.
 */
export async function fetchTodaySummary(): Promise<{
    date: string;
    schedules: TodaySchedule[];
    fromCache?: boolean;
}> {
    let res: Response;
    try {
        res = await fetch(`${API_BASE}/api/schedules/today/summary`, {
            headers: authHeaders(),
        });
    } catch (err) {
        const cached = await readCacheGet<{ date: string; schedules: TodaySchedule[] }>(
            "todaySummary",
            getUserId()
        );
        if (cached) return { ...cached, fromCache: true };
        throw err;
    }
    if (!res.ok) throw new Error("Failed to fetch today summary");
    const data = (await res.json()) as { date: string; schedules: TodaySchedule[] };
    void readCachePut("todaySummary", getUserId(), data);
    return data;
}
