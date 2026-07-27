import { supabase } from "./supabase-browser";

export type ProfileItem = {
  id: string;
  nickname?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  created_at?: string | null;
  grade?: string | null;
  phone_number?: string | null;
};

// profiles_public 뷰의 전체 컬럼(공개 컬럼만) — 게시판류에서 "작성자 정보"를
// 임베드 조인 대신 배치 조회할 때 쓴다.
export type PublicProfile = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  grade: string | null;
  role: string | null;
  created_at: string | null;
  seller_registered_at: string | null;
  opentalk_url: string | null;
  contact_phone: string | null;
  phone_number: string | null;
  is_business_verified: boolean | null;
};

/**
 * 여러 유저 id에 대한 공개 프로필을 한 번에 조회해 id → PublicProfile 맵으로 반환한다.
 * PostgREST FK 임베딩(`profiles(nickname, ...)`)은 profiles 원본 RLS가 잠긴 뒤
 * 타인 행에 대해 null을 반환하므로, 게시글/댓글 등에서 "작성자 id 목록을 먼저 구하고
 * profiles_public을 배치 조회해 merge"하는 용도로 이 헬퍼를 사용한다.
 */
export async function getProfilesMap(
  userIds: (string | null | undefined)[]
): Promise<Record<string, PublicProfile>> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("profiles_public")
    .select("*")
    .in("id", ids);

  if (error) {
    console.error("프로필 배치 조회 실패:", error.message, error);
    return {};
  }

  const map: Record<string, PublicProfile> = {};
  (data as PublicProfile[] | null ?? []).forEach((p) => { map[p.id] = p; });
  return map;
}

export async function getProfile(userId?: string | null): Promise<ProfileItem | null> {
  // userId가 비어 있으면 바로 종료
  if (!userId) {
    return null;
  }

  // 임의의(주로 타인의) 프로필을 조회하는 범용 헬퍼라 email 등 비공개 컬럼이 없는
  // profiles_public 뷰를 사용한다.
  const { data, error } = await supabase
    .from("profiles_public")
    .select("id, nickname, avatar_url, bio, created_at, grade, phone_number")
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