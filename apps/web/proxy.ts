import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  let res = intlMiddleware(req);
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "local-development-key",
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  
  const { data: { session } } = await supabase.auth.getSession();

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
  // Match only internationalized pathnames
  matcher: ['/', '/(ta|en|bn|te|mr|gu|ur|od|hi|kn|pa)/:path*']
};
