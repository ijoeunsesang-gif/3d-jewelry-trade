import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/isAdminCheck";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  if (!(await isAdminUser(adminSupabase, user.id))) {
    return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });
  }

  // Single commission fetch (for admin viewing detail page)
  const singleId = req.nextUrl.searchParams.get("id");
  if (singleId) {
    const FULL_SELECT = "id, user_id, title, description, images, status, result_link, created_at, updated_at, is_private, target_seller_id, desired_price, desired_days, negotiation_count, final_price, final_days, revision_count, rejection_reason, cancellation_reason, cancel_reason, commission_type, bid_status";
    const { data, error } = await adminSupabase
      .from("commissions")
      .select(FULL_SELECT)
      .eq("id", singleId)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "의뢰를 찾을 수 없습니다." }, { status: 404 });
    }
    const allIds = [data.user_id, data.target_seller_id].filter(Boolean) as string[];
    const { data: profiles } = await adminSupabase.from("profiles").select("id, nickname, grade, phone_number").in("id", allIds);
    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
    return NextResponse.json({
      data: {
        ...data,
        nickname: profileMap[data.user_id]?.nickname || "익명",
        seller_nickname: data.target_seller_id ? (profileMap[data.target_seller_id]?.nickname || "알 수 없음") : undefined,
        seller_grade: data.target_seller_id ? profileMap[data.target_seller_id]?.grade : undefined,
        seller_phone: data.target_seller_id ? profileMap[data.target_seller_id]?.phone_number : undefined,
      }
    });
  }

  // All commissions list (삭제된 의뢰는 '삭제된 의뢰' 탭에서 별도 조회)
  const { data: commissions, error } = await adminSupabase
    .from("commissions")
    .select("id, title, images, status, user_id, created_at, is_private, target_seller_id, commission_results(count)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error || !commissions) {
    return NextResponse.json({ error: "조회 실패: " + error?.message }, { status: 500 });
  }

  const userIds = [...new Set(commissions.map((c: any) => c.user_id))];
  const sellerIds = [...new Set(
    commissions.filter((c: any) => c.is_private && c.target_seller_id).map((c: any) => c.target_seller_id)
  )];
  const allIds = [...new Set([...userIds, ...sellerIds])];

  const { data: profiles } = await adminSupabase
    .from("profiles")
    .select("id, nickname, grade")
    .in("id", allIds);

  const profileMap: Record<string, { nickname: string; grade: string | null }> = {};
  (profiles || []).forEach((p: any) => {
    profileMap[p.id] = { nickname: p.nickname || "익명", grade: p.grade || null };
  });

  const result = commissions.map((c: any) => ({
    ...c,
    nickname: profileMap[c.user_id]?.nickname || "익명",
    seller_nickname: c.target_seller_id ? (profileMap[c.target_seller_id]?.nickname || "알 수 없음") : undefined,
    seller_grade: c.target_seller_id ? profileMap[c.target_seller_id]?.grade : undefined,
  }));

  return NextResponse.json({ data: result });
}
