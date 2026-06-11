import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
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
                source: "/api/:path*",
                headers: [{ key: "Vary", value: "Accept-Encoding" }],
            },
        ];
    },
};

export default withNextIntl(nextConfig);
