"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";

/**
 * AuthSync — invisible background component.
 * Keeps `sb-access-token` in localStorage in sync with the real
 * Supabase session. This is needed because Google OAuth redirects
 * write the session into cookies, but our API calls still read from
 * localStorage. Without this, a fresh OAuth login results in a
 * "not logged in" state until the user refreshes.
 */
export function AuthSync() {
    useEffect(() => {
        const supabase = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());

        // Sync token on mount — handles the Google OAuth redirect case
        supabase.auth.getSession().then(({ data }) => {
            if (data.session?.access_token) {
                localStorage.setItem("sb-access-token", data.session.access_token);
            } else {
                localStorage.removeItem("sb-access-token");
            }
        });

        // Keep syncing whenever auth state changes (login / logout / token refresh)
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.access_token) {
                localStorage.setItem("sb-access-token", session.access_token);
            } else {
                localStorage.removeItem("sb-access-token");
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return null;
}
