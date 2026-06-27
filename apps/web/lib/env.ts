export function getSupabaseUrl(): string {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) {
        throw new Error(
            "NEXT_PUBLIC_SUPABASE_URL is not defined. This environment variable is required for the application to start."
        );
    }
    try {
        new URL(url);
    } catch {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
    }
    return url;
}

export function getSupabaseAnonKey(): string {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) {
        throw new Error(
            "NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined. This environment variable is required for the application to start."
        );
    }
    return key;
}

/**
 * Returns the canonical site URL used for SEO metadata (sitemap, robots,
 * OpenGraph, alternate-language links, share URLs, etc.).
 *
 * Reads `NEXT_PUBLIC_SITE_URL` first so preview / staging deployments can
 * override, then falls back to the production domain.
 */
export function getSiteUrl(): string {
    const url = process.env.NEXT_PUBLIC_SITE_URL || "https://sahidawa.in";
    return url.replace(/\/+$/, ""); // strip trailing slashes
}
