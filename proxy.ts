import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) =>
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          }),
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/posts') ||
    pathname.startsWith('/repos') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/usage')

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

// Protect every dashboard route and the login page. The (dashboard) route
// group in app/ means URLs are /dashboard, /posts, /repos, /settings, /usage
// — all need the auth redirect or users with stale JWTs end up calling
// edge functions that then 401.
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/posts/:path*',
    '/repos/:path*',
    '/settings/:path*',
    '/usage/:path*',
    '/login',
  ],
}
