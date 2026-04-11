import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// 점검 모드 ON/OFF (true = 점검중, false = 정상운영)
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

  // 공식 가이드 패턴: supabaseResponse를 먼저 생성하고 setAll에서 재생성
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
          // 1. request 쿠키 업데이트 (다음 미들웨어/핸들러에서 읽을 수 있도록)
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          // 2. 새 response 생성 (업데이트된 request 포함)
          supabaseResponse = NextResponse.next({ request })
          // 3. response에 Set-Cookie 헤더 설정 (브라우저에 쿠키 저장)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 세션 확인 후 없으면 refresh 시도
  // ※ getSession()은 쿠키를 그대로 읽으므로 네트워크 호출 없이 빠름
  //   단, 만료된 토큰도 반환할 수 있으므로 refreshSession()으로 보완
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
