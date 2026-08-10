import { execSync } from "node:child_process";
import createNextIntlPlugin from "next-intl/plugin";
import withPWAInit, { runtimeCaching as defaultRuntimeCaching } from "@ducanh2912/next-pwa";
import { createWorkboxRuntimeCaching } from "./worker/workboxRuntimeCaching.mjs";

const withNextIntl = createNextIntlPlugin();
const workboxRuntimeCaching = createWorkboxRuntimeCaching(defaultRuntimeCaching);

const withPWA = withPWAInit({
    dest: "public",
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    swcMinify: true,
    workboxOptions: {
        disableDevLogs: true,
        runtimeCaching: workboxRuntimeCaching,
    },
});

/**
 * Deterministic build ID derived from the Git commit SHA.
 * Falls back to a timestamp if git is unavailable (e.g. Docker without .git).
 */
function getBuildId() {
    try {
        return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
    } catch {
        return Date.now().toString(36);
    }
}

const buildId = getBuildId();

/** @type {import('next').NextConfig} */
const nextConfig = {
    generateBuildId: () => buildId,
    env: {
        NEXT_PUBLIC_BUILD_ID: buildId,
    },
    transpilePackages: [
        "@sahidawa/validators",
        "@sahidawa/types",
        "@sahidawa/shared",
        "@zxing/library",
        "@zxing/browser",
    ],
    serverExternalPackages: [
        "lightningcss",
        "@tailwindcss/postcss",
        "@tailwindcss/node",
        "@tailwindcss/oxide",
    ],
    images: {
        formats: ["image/avif", "image/webp"],
        deviceSizes: [320, 420, 640, 750, 1080],
        minimumCacheTTL: 3600,
        dangerouslyAllowSVG: false,
    },
    compress: process.env.CI === "true", // Enabled for Lighthouse CI, Vercel will still handle it fine
    reactStrictMode: true,
    experimental: {
        optimizePackageImports: ['lucide-react', 'recharts'],
    },
    poweredByHeader: false,
    async headers() {
        // Derive the WSS origin from the Supabase HTTPS URL so that Supabase
        // Realtime WebSocket connections are explicitly whitelisted.
        const supabaseWssOrigin = (() => {
            try {
                const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
                return `wss://${u.host}`;
            } catch {
                return "";
            }
        })();

        const connectSrc = [
            ...new Set(
                [
                    "'self'",
                    process.env.NEXT_PUBLIC_SUPABASE_URL,
                    supabaseWssOrigin,
                    process.env.NEXT_PUBLIC_API_URL,
                    process.env.NEXT_PUBLIC_ML_SERVICE_URL,
                    process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT || (process.env.NODE_ENV === "development" ? "http://localhost:4318" : ""),
                    "https://overpass.osm.ch",
                    "https://overpass.private.coffee",
                    "https://overpass-api.de",
                    "https://overpass.kumi.systems",
                    "https://lz4.overpass-api.de",
                    "https://z.overpass-api.de",
                ]
                    .filter(Boolean)
                    .map((u) => {
                        if (u === "'self'") return u;
                        // Keep wss:// origins as-is; URL constructor normalises them fine.
                        try {
                            const parsed = new URL(u);
                            return parsed.origin;
                        } catch {
                            return "";
                        }
                    })
                    .filter(Boolean)
            ),
        ].join(" ");

        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
                    { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
                    {
                        key: "Content-Security-Policy",
                        value: [
                            "default-src 'self'",
                            // 'wasm-unsafe-eval' allows WebAssembly (Tesseract OCR WASM engine) without
                            // allowing arbitrary eval(). Unlike 'unsafe-eval', Next.js nonce middleware
                            // does NOT strip this directive. Both are included for broad browser support.
                            "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
                            // blob: is required so the Tesseract CDN worker can spawn a Blob Worker.
                            "worker-src 'self' blob: https://cdn.jsdelivr.net https://unpkg.com",
                            "style-src 'self' 'unsafe-inline'",
                            // connectSrc already includes explicit wss:// origin for Supabase Realtime.
                            `connect-src ${connectSrc} https://cdn.jsdelivr.net https://unpkg.com https://tessdata.projectnaptha.com`,
                            "img-src 'self' blob: data: https://res.cloudinary.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://cdnjs.cloudflare.com",
                            "font-src 'self'",
                            "object-src 'none'",
                            "base-uri 'self'",
                            "form-action 'self'",
                            "frame-ancestors 'none'",
                            "upgrade-insecure-requests",
                        ].join("; "),
                    },
                ],
            },
            {
                source: "/api/:path*",
                headers: [{ key: "Vary", value: "Accept-Encoding" }],
            },
        ];
    },
};

export default withPWA(withNextIntl(nextConfig));
