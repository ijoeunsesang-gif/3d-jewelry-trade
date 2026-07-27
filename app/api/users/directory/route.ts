import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 내 정보 > 유저 목록 탭(판매자/전체)용 — 로그인한 아무 유저나 볼 수 있는 화면이지만
// deleted_at / is_seller_banned은 profiles RLS 강화 이후 본인/관리자 외에는 조회할 수 없어
// service_role로 서버에서 필터링하고, 응답에는 공개 컬럼만 담아서 내려준다.
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const sub = req.nextUrl.searchParams.get("sub");

  let query = adminSupabase
    .from("profiles")
    .select("id, nickname, avatar_url, grade")
    .is("deleted_at", null);

  if (sub === "sellers") {
    // 내 정보 > 유저 목록 > 판매자 탭
    query = query.eq("role", "seller").eq("is_seller_banned", false).order("created_at", { ascending: false });
  } else if (sub === "commission_sellers") {
    // 의뢰 등록 > 판매자 선택 (팔로우한 판매자 / 전체 판매자)
    query = query.eq("role", "seller").neq("role", "admin").eq("is_seller_banned", false).order("nickname", { ascending: true });
    const ids = req.nextUrl.searchParams.get("ids");
    const exclude = req.nextUrl.searchParams.get("exclude");
    if (ids) query = query.in("id", ids.split(","));
    if (exclude) query = query.neq("id", exclude);
  } else {
    // 내 정보 > 유저 목록 > 전체 탭
    query = query.order("created_at", { ascending: false }).limit(200);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}
