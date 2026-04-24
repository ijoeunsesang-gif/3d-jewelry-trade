import { supabase } from "./supabase-browser";

export type ProfileItem = {
  id: string;
  email?: string | null;
  nickname?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  created_at?: string | null;
  grade?: string | null;
  phone_number?: string | null;
};

export async function getProfile(userId?: string | null): Promise<ProfileItem | null> {
  // userId가 비어 있으면 바로 종료
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, nickname, avatar_url, bio, created_at, grade, phone_number")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("프로필 불러오기 실패:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      userId,
    });
    return null;
  }

  return data as ProfileItem | null;
}