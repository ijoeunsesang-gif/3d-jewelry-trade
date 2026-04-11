import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  // Implicit flow (카카오): 서버는 URL hash를 읽지 못하므로 클라이언트 페이지로 위임
  if (!code) {
    const redirectUrl = new URL('/auth/callback/client', request.url)
    redirectUrl.searchParams.set('next', next)
    return NextResponse.redirect(redirectUrl)
  }

  // PKCE flow (Google): response를 먼저 생성하고 Set-Cookie를 직접 설정
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
