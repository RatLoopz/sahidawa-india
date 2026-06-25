import { API_BASE, getCsrfToken } from "../api";
import { fetchWithRetry } from "../apiWithRetry";

export interface WatchlistPreferences {
    notify_price_change: boolean;
    notify_recall: boolean;
    notify_new_alternative: boolean;
    notify_stock_availability: boolean;
}

export interface WatchedMedicineDetails {
    id: string;
    brand_name: string;
    generic_name: string;
    manufacturer: string;
    mrp: number | null;
    jan_aushadhi_price: number | null;
    cdsco_approval_status: string;
    is_counterfeit_alert: boolean;
}

export interface WatchlistItem {
    id: string;
    user_id: string;
    medicine_id: string;
    notify_price_change: boolean;
    notify_recall: boolean;
    notify_new_alternative: boolean;
    notify_stock_availability: boolean;
    created_at: string;
    medicine: WatchedMedicineDetails;
}

/**
 * Fetches the current user's medicine watchlist.
 */
export async function fetchWatchlist(
    accessToken?: string,
    signal?: AbortSignal
): Promise<{ watchlist: WatchlistItem[] }> {
    const res = await fetchWithRetry(`${API_BASE}/api/v1/watchlist`, {
        method: "GET",
        headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
        timeout: 8000,
        signal,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to fetch watchlist");
    }

    return res.json() as Promise<{ watchlist: WatchlistItem[] }>;
}

/**
 * Adds a medicine to the user's watchlist (or updates preferences if already added).
 */
export async function addToWatchlist(
    payload: {
        medicine_id: string;
        notify_price_change?: boolean;
        notify_recall?: boolean;
        notify_new_alternative?: boolean;
        notify_stock_availability?: boolean;
    },
    accessToken?: string,
    signal?: AbortSignal
): Promise<{ success: boolean; item: WatchlistItem }> {
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/v1/watchlist`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(payload),
        timeout: 10000,
        signal,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to add medicine to watchlist");
    }

    const data = await res.json();
    return { success: true, item: data.item };
}

/**
 * Updates notification preferences for a specific watchlist item.
 */
export async function updateWatchlistPreferences(
    itemId: string,
    payload: Partial<WatchlistPreferences>,
    accessToken?: string,
    signal?: AbortSignal
): Promise<{ success: boolean; item: WatchlistItem }> {
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/v1/watchlist/${itemId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(payload),
        timeout: 10000,
        signal,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to update notification preferences");
    }

    const data = await res.json();
    return { success: true, item: data.item };
}

/**
 * Removes a medicine from the watchlist by watchlist item ID.
 */
export async function removeFromWatchlist(
    itemId: string,
    accessToken?: string,
    signal?: AbortSignal
): Promise<{ success: boolean }> {
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/v1/watchlist/${itemId}`, {
        method: "DELETE",
        headers: {
            "x-csrf-token": csrfToken,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
        timeout: 10000,
        signal,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to remove from watchlist");
    }

    return res.json() as Promise<{ success: boolean }>;
}

/**
 * Removes a medicine from the watchlist by medicine ID.
 */
export async function removeFromWatchlistByMedicineId(
    medicineId: string,
    accessToken?: string,
    signal?: AbortSignal
): Promise<{ success: boolean }> {
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/v1/watchlist/medicine/${medicineId}`, {
        method: "DELETE",
        headers: {
            "x-csrf-token": csrfToken,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
        timeout: 10000,
        signal,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to remove medicine from watchlist");
    }

    return res.json() as Promise<{ success: boolean }>;
}
