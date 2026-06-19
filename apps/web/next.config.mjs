import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ["lightningcss", "@tailwindcss/postcss", "@tailwindcss/node", "@tailwindcss/oxide"],
    output: "standalone",
    images: {
        formats: ["image/avif", "image/webp"],
        deviceSizes: [320, 420, 640, 750, 1080],
        minimumCacheTTL: 3600,
        dangerouslyAllowSVG: false,
    },
    compress: true,
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
                    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
                    { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;" },
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
