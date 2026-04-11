import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  // PKCE flow: 구글·카카오 모두 code로 처리
  // code가 없으면 잘못된 접근
  if (!code) {
    return NextResponse.redirect(new URL('/auth?error=no_code', request.url))
  }

  // response를 먼저 생성하고 Set-Cookie를 직접 설정
  // ※ cookies()로 set 후 NextResponse.redirect()를 새로 생성하면 Set-Cookie 누락됨
  const response = NextResponse.redirect(new URL(next, request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[callback] exchangeCodeForSession failed:', error.message)
    return NextResponse.redirect(new URL('/auth?error=oauth_failed', request.url))
  }

  // Set-Cookie 헤더가 포함된 redirect 응답 반환 → 브라우저에 세션 쿠키 저장
  return response
}
