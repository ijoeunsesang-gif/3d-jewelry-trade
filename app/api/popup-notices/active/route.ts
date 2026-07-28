import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 팝업 공지는 자주 바뀌지 않으므로 60초 캐싱한다. 홈 첫 로딩 시 매번 DB를 치던 것을 줄여
// home-models와 동일한 revalidate 간격으로 네트워크 경합을 줄인다.
// 관리자가 새 팝업을 등록해도 최대 60초 뒤에 반영되는 정도는 허용 범위.
export const revalidate = 60;

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const nowIso = new Date().toISOString();

  const { data: popups, error } = await adminSupabase
    .from("popup_notices")
    .select("id, title, content, image_url, link_url")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "조회 실패: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ popups: popups || [] });
}
