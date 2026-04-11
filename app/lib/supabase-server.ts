import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 서버 컴포넌트 / Route Handler / Server Action 전용 Supabase 클라이언트
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            // Server Component에서는 쿠키 설정이 불가하므로 try/catch 필수
            // Route Handler / Server Action에서는 정상 동작
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // 읽기 전용 컨텍스트(Server Component)에서의 호출은 무시
          }
        },
      },
    }
  )
}
