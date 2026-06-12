import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
    const res = intlMiddleware(req);

    const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
        cookies: {
            getAll() {
                return req.cookies.getAll();
            },
            setAll(cookiesToSet) {
                // Apply cookies only to the response; request cookies are immutable in middleware.
                cookiesToSet.forEach(({ name, value, options }) => {
                    res.cookies.set(name, value, options);
                });
            },
        },
    });

    const {
        data: { session },
    } = await supabase.auth.getSession();

    const { pathname } = req.nextUrl;

    if (/^\/[a-z]{2}\/admin\//.test(pathname) || /^\/[a-z]{2}\/admin$/.test(pathname)) {
        if (!session) {
            const locale = pathname.split("/")[1] ?? "en";
            return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
        }
    }

    return res;
}

export const config = {
    matcher: ["/", "/(ta|en|bn|te|mr|gu|ur|or|hi|kn|pa|as|ml)/:path*"],
};
