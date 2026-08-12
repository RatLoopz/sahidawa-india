/**
 * Converts a brand name or string into a URL-friendly slug.
 * E.g., "Dolo 650 Tablet" -> "dolo-650-tablet"
 */
export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-") // Replace spaces with -
        .replace(/[^\w\-]+/g, "") // Remove all non-word chars except hyphens
        .replace(/\-\-+/g, "-") // Replace multiple hyphens with single hyphen
        .replace(/^-+/, "") // Trim hyphens from start
        .replace(/-+$/, ""); // Trim hyphens from end
}

/**
 * Converts a URL slug back to a standard searchable string.
 * E.g., "dolo-650-tablet" -> "dolo 650 tablet"
 */
export function deslugify(slug: string): string {
    return slug.replace(/-/g, " ");
}
