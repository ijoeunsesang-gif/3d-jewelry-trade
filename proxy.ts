import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const MAINTENANCE_MODE = false

// RLS 우회용 서비스 롤 클라이언트 (admin role 조회 전용)
const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (MAINTENANCE_MODE) {
    if (!pathname.startsWith('/maintenance') && !pathname.startsWith('/_next/') && !pathname.startsWith('/favicon')) {
      return NextResponse.redirect(new URL('/maintenance', request.url))
    }
  }

  const host = request.headers.get('host') || '';
  if (!host.startsWith('www.') && !host.includes('localhost') && !host.includes('vercel.app')) {
    return NextResponse.redirect(`https://www.${host}${request.nextUrl.pathname}${request.nextUrl.search}`, 308)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  const { data: { user } } = await supabase.auth.getUser()

  // /admin/* 경로: 미인증 또는 비관리자 → 홈 리다이렉트
  if (pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
