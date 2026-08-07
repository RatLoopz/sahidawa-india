import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
    // 1. Generate a cryptographically secure nonce per request
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const mlUrl = process.env.NEXT_PUBLIC_ML_SERVICE_URL;

    const getOrigin = (url: string | undefined) => {
        try {
            return url ? new URL(url).origin : "";
        } catch {
            return "";
        }
    };
    const getWsOrigin = (url: string | undefined) => {
        try {
            if (!url) return "";
            const parsed = new URL(url);
            parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
            return parsed.origin;
        } catch {
            return "";
        }
    };

    const connectSrc = [
        ...new Set(
            [
                "'self'",
                getOrigin(supabaseUrl),
                getOrigin(apiUrl),
                getOrigin(mlUrl),
                getWsOrigin(mlUrl),
                "https://*.tile.openstreetmap.org",
                "https://*.basemaps.cartocdn.com",
                "https://overpass.osm.ch",
                "https://overpass.private.coffee",
                "https://overpass-api.de",
                "https://overpass.kumi.systems",
                "https://lz4.overpass-api.de",
                "https://z.overpass-api.de",
                "https://unpkg.com",
                "https://cdn.jsdelivr.net",
                "https://tessdata.projectnaptha.com",
            ].filter(Boolean)
        ),
    ].join(" ");

    // Nonce-based strict CSP
    const csp = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com`,
        "worker-src 'self' blob:",
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com`,
        `connect-src ${connectSrc}`,
        "img-src 'self' blob: data: https://res.cloudinary.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://cdnjs.cloudflare.com",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
    ].join("; ");

    // Forward nonce and csp to the App Router via request header
    req.headers.set("x-nonce", nonce);
    req.headers.set("x-csp", csp);

    // 2. Run next-intl middleware (it uses req.headers)
    const res = intlMiddleware(req);

    // 3. Set CSP on the response
    res.headers.set("Content-Security-Policy", csp);

    // 4. Supabase auth and Admin route protection
    const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
        cookies: {
            getAll() {
                return req.cookies.getAll();
            },
            setAll(cookiesToSet) {
                // Apply cookies only to the response
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
            // Preserve the intended destination so the user is returned to it
            // after re-authenticating instead of being dumped at the home page.
            const returnTo = encodeURIComponent(pathname);
            return NextResponse.redirect(new URL(`/${locale}/login?returnTo=${returnTo}`, req.url));
        }
    }

    return res;
}

export const config = {
    matcher: [
        // Match all routes except /api, static assets, images, and internals
        "/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)",
    ],
};
