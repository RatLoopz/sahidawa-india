import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";

export async function POST() {
    const cookieStore = await cookies();

    const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                    cookieStore.set({ name, value, ...options });
                });
            },
        },
    });

    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
}
