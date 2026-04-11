import { createBrowserClient } from '@supabase/ssr'

// 클라이언트 컴포넌트 전용 Supabase 클라이언트
// @supabase/ssr의 createBrowserClient는 쿠키 기반 세션 저장을 사용함 (localStorage 아님)
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
