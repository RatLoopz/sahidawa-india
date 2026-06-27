import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
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
        const getOrigin = (url) => {
            try { return url ? new URL(url).origin : ""; } catch { return ""; }
        };

        const getWebSocketOrigin = (url) => {
            try {
                if (!url) return "";
                const parsedUrl = new URL(url);
                parsedUrl.protocol = parsedUrl.protocol === "https:" ? "wss:" : "ws:";
                return parsedUrl.origin;
            } catch {
                return "";
            }
        };

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const mlUrl = process.env.NEXT_PUBLIC_ML_SERVICE_URL;

        const connectSrcUrls = [
            "'self'",
            getOrigin(supabaseUrl),
            getOrigin(apiUrl),
            getOrigin(mlUrl),
            getWebSocketOrigin(mlUrl),
        ].filter(Boolean);

        const uniqueConnectSrc = [...new Set(connectSrcUrls)].join(" ");
        const csp = `default-src 'self'; connect-src ${uniqueConnectSrc}; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;`;

        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
                    { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
                    { key: "Content-Security-Policy", value: csp },
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
