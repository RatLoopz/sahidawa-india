import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getClientIp";

export async function POST(req: NextRequest) {
    const ip = getClientIp(req);
    const { success } = await rateLimit.limit(ip);
    if (!success) {
        return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            { status: 429 }
        );
    }

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
