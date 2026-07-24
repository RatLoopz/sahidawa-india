import { execSync } from "node:child_process";
import createNextIntlPlugin from "next-intl/plugin";
// import withPWAInit, { runtimeCaching as defaultRuntimeCaching } from "@ducanh2912/next-pwa";
// import { createWorkboxRuntimeCaching } from "./worker/workboxRuntimeCaching.mjs";

const withNextIntl = createNextIntlPlugin();
// const workboxRuntimeCaching = createWorkboxRuntimeCaching(defaultRuntimeCaching);

// const withPWA = withPWAInit({
//     dest: "public",
//     cacheOnFrontEndNav: true,
//     aggressiveFrontEndNavCaching: true,
//     reloadOnOnline: true,
//     swcMinify: true,
//     workboxOptions: {
//         disableDevLogs: true,
//         runtimeCaching: workboxRuntimeCaching,
//     },
// });

/**
 * Deterministic build ID derived from the Git commit SHA.
 * Falls back to a timestamp if git is unavailable (e.g. Docker without .git).
 */
function getBuildId() {
    if (process.env.VERCEL_GIT_COMMIT_SHA) {
        return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
    }
    try {
        return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
    } catch {
        return "static-fallback-id";
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

    images: {
        formats: ["image/avif", "image/webp"],
        deviceSizes: [320, 420, 640, 750, 1080],
        minimumCacheTTL: 3600,
        dangerouslyAllowSVG: false,
    },
    compress: false, // Offloaded to Vercel/proxy
    reactStrictMode: true,
    poweredByHeader: false,
    typescript: {
        ignoreBuildErrors: true,
    },
    experimental: {
        memoryBasedWorkersCount: true,
        cpus: 1,
    },

    async headers() {
        const connectSrc = [
            ...new Set(
                ["'self'", process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_API_URL, process.env.NEXT_PUBLIC_ML_SERVICE_URL]
                    .filter(Boolean)
                    .map((u) => {
                        if (u === "'self'") return u;
                        try {
                            return new URL(u).origin;
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
                            "script-src 'self'",
                            "style-src 'self' 'unsafe-inline'",
                            `connect-src ${connectSrc}`,
                            "img-src 'self' blob: data: https://res.cloudinary.com",
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

export default withNextIntl(nextConfig);
