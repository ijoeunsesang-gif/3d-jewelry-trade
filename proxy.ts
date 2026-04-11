import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const MAINTENANCE_MODE = false

export async function proxy(request: NextRequest) {
  if (MAINTENANCE_MODE) {
    const { pathname } = request.nextUrl
    if (
      !pathname.startsWith('/maintenance') &&
      !pathname.startsWith('/_next/') &&
      !pathname.startsWith('/favicon')
    ) {
      return NextResponse.redirect(new URL('/maintenance', request.url))
    }
  }

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

  await supabase.auth.getSession()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}