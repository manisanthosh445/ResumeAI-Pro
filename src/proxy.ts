import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // If Supabase env vars aren't set, skip auth middleware so UI still renders
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (!supabaseUrl || supabaseUrl.includes('your_supabase') || !supabaseUrl.startsWith('http')) {
    return NextResponse.next({ request })
  }

  const { pathname } = request.nextUrl

  // Protected routes — redirect to login if not authenticated
  const protectedPaths = ['/dashboard', '/upload', '/analysis', '/study', '/jobs', '/mock-test']
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))
  const isAuthRoute =
    pathname.startsWith('/auth/login') ||
    pathname.startsWith('/auth/signup') ||
    pathname.startsWith('/auth/forgot-password') ||
    pathname.startsWith('/auth/reset-password') ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'

  // Fast-path: completely skip Supabase on routes that do not need auth
  if (!isProtected && !isAuthRoute) {
    return NextResponse.next({ request })
  }

  // Fast-path: Check for presence of Supabase auth cookie before making network calls
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && (c.name.includes('auth-token') || c.name.endsWith('-token')))

  // If visiting protected route with zero auth cookies, redirect to login without network delay
  if (isProtected && !hasAuthCookie) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If visiting auth pages with zero auth cookies, allow immediately without network call
  if (isAuthRoute && !hasAuthCookie) {
    return NextResponse.next({ request })
  }

  // Only create client and verify auth when verification is actually required
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/upload/:path*',
    '/analysis/:path*',
    '/study/:path*',
    '/jobs/:path*',
    '/mock-test/:path*',
    '/auth/login',
    '/auth/signup',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
  ],
}
