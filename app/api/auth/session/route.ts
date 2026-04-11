import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// 카카오 implicit flow: 클라이언트에서 받은 토큰을 서버가 HTTP 쿠키로 저장
// createBrowserClient의 document.cookie는 새로고침 시 SSR에서 못 읽는 경우가 있어
// 서버에서 직접 Set-Cookie 헤더로 쿠키를 설정해야 신뢰성 있게 유지됨
export async function POST(request: Request) {
  const { access_token, refresh_token } = await request.json()
  const cookieStore = await cookies()
  const response = NextResponse.json({ success: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(c) {
          c.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              maxAge: 60 * 60 * 24 * 7, // 7일
              httpOnly: true,
              secure: true,
              sameSite: 'lax',
              path: '/',
            }))
        }
      }
    }
  )

  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) return NextResponse.json({ error: error.message }, { status: 401 })
  return response
}