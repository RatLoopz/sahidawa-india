/**
 * Escape ILIKE wildcard characters in a string derived from untrusted input.
 * In PostgreSQL ILIKE patterns, % matches any sequence of characters and _
 * matches any single character. The backslash (the LIKE escape character) is
 * escaped first so a user-supplied "\" can't alter the pattern.
 */
export function escapeIlike(word: string): string {
    return word.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Escapes a value for safe use in PostgREST .or() filters.
 * Prevents comma injection by escaping special characters, in addition to
 * the standard ILIKE wildcard escaping.
 */
export function escapePostgrest(val: string): string {
    return val.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/"/g, '""');
}

export function buildOrConditions(fields: string[], words: string[]): string {
    return words
        .map((word) => {
            const safeWord = escapePostgrest(word);
            return fields.map((field) => `${field}.ilike."%${safeWord}%"`).join(",");
        })
        .join(",");
}
