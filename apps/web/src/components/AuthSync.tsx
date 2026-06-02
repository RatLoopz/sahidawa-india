"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";

export function AuthSync() {
    useEffect(() => {
        const supabase = createBrowserClient(
            getSupabaseUrl(),
            getSupabaseAnonKey()
        );

        // Sync token on first load (handles Google OAuth redirect)
        supabase.auth.getSession().then(({ data }) => {
            if (data.session?.access_token) {
                localStorage.setItem("sb-access-token", data.session.access_token);
            } else {
                localStorage.removeItem("sb-access-token");
            }
        });

        // Keep syncing whenever login/logout happens
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                if (session?.access_token) {
                    localStorage.setItem("sb-access-token", session.access_token);
                } else {
                    localStorage.removeItem("sb-access-token");
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    return null; // Invisible component, sirf background mein kaam karta hai
}