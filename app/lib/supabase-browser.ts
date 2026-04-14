import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          detectSessionInUrl: false, // /auth/callback에서만 code 처리
          flowType: 'pkce',
        },
      }
    ) as SupabaseClient
  }
  return supabaseInstance
}

// 기존 코드 호환을 위한 export
export const supabase = getSupabase()
