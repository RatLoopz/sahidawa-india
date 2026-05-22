import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes - redirect to login if no user
  const protectedPaths = ['/profile', '/dashboard', '/history', '/scan']
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.includes(path))
  
  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone()
    url.pathname = `/login`
    return NextResponse.redirect(url)
  }

  // If logged in and trying to access login/signup, redirect to home
  if (user && (request.nextUrl.pathname.includes('/login') || request.nextUrl.pathname.includes('/signup'))) {
    const url = request.nextUrl.clone()
    url.pathname = `/`
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}