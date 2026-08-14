export function getSupabaseUrl(): string {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) {
        console.warn("[env] NEXT_PUBLIC_SUPABASE_URL is not defined. Using placeholder for build.");
        return "https://placeholder.supabase.co";
    }
    try {
        new URL(url);
    } catch {
        console.warn("[env] NEXT_PUBLIC_SUPABASE_URL is not a valid URL. Using placeholder.");
        return "https://placeholder.supabase.co";
    }
    return url;
}

export function getSupabaseAnonKey(): string {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) {
        console.warn("[env] NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined. Using placeholder for build.");
        return "placeholder-key";
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
