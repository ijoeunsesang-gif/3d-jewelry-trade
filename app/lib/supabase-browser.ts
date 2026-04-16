import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'sb-fvhotaxjdacfulxjahon-auth-token',
        }
      }
    )
  }
  return supabaseInstance
}

export const supabase = getSupabase()

let publicInstance: ReturnType<typeof createClient> | null = null

export function getPublicSupabase() {
  if (!publicInstance) {
    publicInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return publicInstance
}

export const publicSupabase = getPublicSupabase()
