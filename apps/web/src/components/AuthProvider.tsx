"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

interface AuthContextValue {
    session: Session | null;
    isLoading: boolean;
    token: string | null;
}

const AuthContext = createContext<AuthContextValue>({
    session: null,
    isLoading: true,
    token: null,
});

export function useSession(): AuthContextValue {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const supabase = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());

        supabase.auth.getSession().then(({ data }) => {
            const s = data.session ?? null;
            setSession(s);
            setIsLoading(false);
            if (s?.access_token) {
                localStorage.setItem("sb-access-token", s.access_token);
            } else {
                localStorage.removeItem("sb-access-token");
            }
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.access_token) {
                localStorage.setItem("sb-access-token", session.access_token);
            } else {
                localStorage.removeItem("sb-access-token");
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ session, isLoading, token: session?.access_token ?? null }}>
            {children}
        </AuthContext.Provider>
    );
}
