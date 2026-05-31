import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: output: 'standalone' is for Docker/Vercel production builds ONLY.
  // It must NOT be set during local dev as it causes the dev server to exit immediately.
  // Uncomment the line below only when building for production Docker images:
  // output: 'standalone',
  serverExternalPackages: ['@supabase/ssr', '@supabase/supabase-js'],
};

export default withNextIntl(nextConfig);
