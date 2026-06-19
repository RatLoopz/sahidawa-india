/**
 * Escape ILIKE wildcard characters in a string derived from untrusted input.
 * In PostgreSQL ILIKE patterns, % matches any sequence of characters and _
 * matches any single character. Leaving them unescaped causes overly broad
 * matches that may return far more rows than intended.
 */
export function escapeIlike(word: string): string {
    return word.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
/**
 * Escapes a value for safe use in PostgREST .or() filters.
 * Prevents comma injection by escaping special characters.
 */
export function escapePostgrest(val: string): string {
    return val.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/"/g, '""');
}
