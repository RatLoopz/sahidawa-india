import { execSync } from "node:child_process";
import createNextIntlPlugin from "next-intl/plugin";
import withPWAInit from "@ducanh2912/next-pwa";

const withNextIntl = createNextIntlPlugin();

const withPWA = withPWAInit({
    dest: "public",
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    swcMinify: true,
    workboxOptions: {
        disableDevLogs: true,
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
    transpilePackages: ["@sahidawa/validators", "@sahidawa/types", "@sahidawa/shared", "@zxing/library", "@zxing/browser"],
    serverExternalPackages: ["lightningcss", "@tailwindcss/postcss", "@tailwindcss/node", "@tailwindcss/oxide"],
    images: {
        formats: ["image/avif", "image/webp"],
        deviceSizes: [320, 420, 640, 750, 1080],
        minimumCacheTTL: 3600,
        dangerouslyAllowSVG: false,
    },
    compress: false, // Offloaded to Vercel/proxy
    reactStrictMode: true,
    poweredByHeader: false,
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
                    { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
                    // CSP removed — now handled dynamically per-request in middleware.ts
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