import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
    // Generate a cryptographically secure nonce per request
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const mlUrl = process.env.NEXT_PUBLIC_ML_SERVICE_URL;

    const getOrigin = (url: string | undefined) => {
        try { return url ? new URL(url).origin : ""; } catch { return ""; }
    };
    const getWsOrigin = (url: string | undefined) => {
        try {
            if (!url) return "";
            const parsed = new URL(url);
            parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
            return parsed.origin;
        } catch { return ""; }
    };

    const connectSrc = [...new Set([
        "'self'",
        getOrigin(supabaseUrl),
        getOrigin(apiUrl),
        getOrigin(mlUrl),
        getWsOrigin(mlUrl),
    ].filter(Boolean))].join(" ");

    // Nonce-based strict CSP — replaces 'unsafe-inline' with nonce
    const csp = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        `style-src 'self' 'nonce-${nonce}'`,
        `connect-src ${connectSrc}`,
        "img-src 'self' blob: data:",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
    ].join("; ");

    const requestHeaders = new Headers(request.headers);
    // Forward nonce to App Router via request header
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("x-csp", csp);

    const response = NextResponse.next({
        request: { headers: requestHeaders },
    });

    // Set CSP on the response
    response.headers.set("Content-Security-Policy", csp);

    return response;
}

export const config = {
    matcher: [
        // Skip static assets, images, and Next.js internals
        "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)",
    ],
};