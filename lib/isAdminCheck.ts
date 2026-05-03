import { SupabaseClient } from "@supabase/supabase-js";

/**
 * API 라우트에서 현재 유저가 admin 역할인지 확인.
 * service role 클라이언트를 사용해야 RLS 우회 가능.
 */
export async function isAdminUser(
  client: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await client
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return data?.role === "admin";
}
