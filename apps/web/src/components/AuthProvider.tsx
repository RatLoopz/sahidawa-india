"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";
import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { clearSyncQueueForLogout, registerCurrentUser } from "@/lib/syncUserScoping";

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

    const supabase = useMemo(() => createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey()), []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            const s = data.session ?? null;
            setSession(s);
            setIsLoading(false);
            if (s?.access_token) {
                localStorage.setItem("sb-access-token", s.access_token);
            } else {
                localStorage.removeItem("sb-access-token");
            }
            syncServiceWorkerSession(s);
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
            syncServiceWorkerSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ session, isLoading, token: session?.access_token ?? null }}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Keep the service worker's notion of the signed-in user in step with the
 * auth session so queued offline mutations are scoped/bound to the user who
 * created them. On sign-out the queue is cleared so an old offline action can
 * never be submitted as a different user.
 */
function syncServiceWorkerSession(session: Session | null): void {
    const userId = session?.user?.id ?? null;
    if (userId) {
        registerCurrentUser(userId);
    } else {
        clearSyncQueueForLogout();
    }
}
