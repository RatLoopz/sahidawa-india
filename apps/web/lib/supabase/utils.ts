/**
 * Escapes a value for safe use in PostgREST .or() and .ilike() filters.
 * Wraps in double quotes to prevent comma injection and escapes
 * PostgreSQL ILIKE wildcard characters (% and _).
 */
export function escapePostgrest(val: string): string {
    return val
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_")
        .replace(/"/g, '""');
}