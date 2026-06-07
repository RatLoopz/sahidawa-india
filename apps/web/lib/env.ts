export function getSupabaseUrl(): string {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) {
        if (process.env.NODE_ENV === "development") {
            throw new Error(
                "NEXT_PUBLIC_SUPABASE_URL is not defined. See https://supabase.com/docs/guides/getting-started/local-development#supabase-project-settings for local development setup."
            );
        }
        console.error(
            "Critical: NEXT_PUBLIC_SUPABASE_URL is not defined in production environment."
        );
        return "";
    }
    return url;
}

export function getSupabaseAnonKey(): string {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) {
        if (process.env.NODE_ENV === "development") {
            throw new Error(
                "NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined. You can find your anon key in the Supabase dashboard under Settings -> API."
            );
        }
        console.error(
            "Critical: NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined in production environment."
        );
        return "";
    }
    return key;
}
