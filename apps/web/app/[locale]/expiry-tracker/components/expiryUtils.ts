/**
 * expiryUtils.ts
 * Pure, React-free helper functions for medicine expiry date calculations.
 * These functions have no side effects and are fully unit-testable.
 */

export type ExpiryStatusKey = "expired" | "expiringSoon" | "safe";

export interface ExpiryStatus {
    key: ExpiryStatusKey;
    /** Number of days until expiry (negative = already expired) */
    diffDays: number;
}

/**
 * Parses a YYYY-MM-DD date string into a local (midnight) Date object,
 * avoiding timezone-related off-by-one errors from `new Date(dateStr)`.
 */
export function parseLocalDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
}

/**
 * Returns the number of whole days between today (midnight) and the
 * medicine's expiry date. Negative values mean the medicine is expired.
 */
export function getDiffDays(dateStr: string): number {
    const expiry = parseLocalDate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Validates that a string is a real calendar date in YYYY-MM-DD format.
 */
export function isValidDateString(dateStr: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const [year, month, day] = dateStr.split("-").map(Number);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * Returns the expiry status bucket and precise diff-days for a medicine.
 * Icon/color selection is left to the render layer (keeps this file React-free).
 *
 * Thresholds:
 *   diffDays < 0   → "expired"
 *   diffDays ≤ 30  → "expiringSoon"
 *   otherwise      → "safe"
 */
export function getExpiryStatus(dateStr: string): ExpiryStatus {
    const diffDays = getDiffDays(dateStr);
    if (diffDays < 0) return { key: "expired", diffDays };
    if (diffDays <= 30) return { key: "expiringSoon", diffDays };
    return { key: "safe", diffDays };
}
