import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const MAINTENANCE_MODE = false

// 로그인 여부와 무관하게 보이는 공개 경로. 이 경로들은 Supabase 세션 쿠키가 필요 없으므로
// 요청마다 실행되는 supabase.auth.getUser() 네트워크 검증을 건너뛴다.
// (실제 인증 검사는 각 API 라우트가 Authorization 헤더의 Bearer 토큰으로 직접 수행하며,
// 이 쿠키 세션은 /api/auth/session의 카카오 로그인 동기화 용도로만 쓰인다.)
const PUBLIC_PATH_PREFIXES = [
  '/models',
  '/seller',
  '/notice',
  '/customer-service',
  '/help',
  '/partner',
  '/terms',
  '/privacy',
  '/refund',
  '/auth',
  '/maintenance',
]

function isPublicPath(pathname: string) {
  if (pathname === '/') return true
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

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

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request })
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

  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
