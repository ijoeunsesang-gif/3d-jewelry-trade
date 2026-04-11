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

  // getUser()는 반드시 호출해야 함:
  // - 만료된 access token을 refresh token으로 자동 갱신
  // - 갱신된 토큰을 setAll을 통해 쿠키에 저장
  // ※ getUser()와 return 사이에 다른 코드를 두지 말 것 (공식 가이드 주의사항)
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
