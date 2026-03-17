import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getLogger } from '@logtape/logtape'

const log = getLogger(['buildlog', 'proxy'])

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip auth when Supabase is not configured (local dev without env vars)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    log.debug`Supabase env vars missing — skipping auth for ${pathname}`
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — required for Server Components to read auth state
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    log.warn`Auth error on ${pathname}: ${error.message}`
  }

  log.debug`${pathname} — user: ${user?.id ?? 'anonymous'}`

  if (!user && pathname.startsWith('/dashboard')) {
    log.info`Unauthenticated request to ${pathname} — redirecting to /login`
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (pathname === '/login' || pathname === '/')) {
    log.info`Authenticated user on ${pathname} — redirecting to /dashboard`
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
