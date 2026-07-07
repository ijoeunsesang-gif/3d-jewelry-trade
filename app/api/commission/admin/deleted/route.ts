import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/isAdminCheck";

// Service role client — bypasses RLS for admin-only access
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return { error: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }

  const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
  if (authError || !user) {
    return { error: NextResponse.json({ error: "인증 실패" }, { status: 401 }) };
  }

  if (!(await isAdminUser(adminSupabase, user.id))) {
    return { error: NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 }) };
  }

  return { user };
}

// 삭제된 의뢰 목록 조회
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const { data: commissions, error } = await adminSupabase
    .from("commissions")
    .select("id, user_id, title, status, commission_type, created_at, deleted_at, deleted_reason_category, deleted_reason_detail, deleted_by")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error || !commissions) {
    return NextResponse.json({ error: "조회 실패: " + error?.message }, { status: 500 });
  }

  // 작성자/삭제자 닉네임 표시용 profiles 조회 (admin/route.ts와 동일한 수동 조인 방식)
  const allIds = [...new Set(
    commissions.flatMap((c: any) => [c.user_id, c.deleted_by].filter(Boolean))
  )];

  const { data: profiles } = await adminSupabase
    .from("profiles")
    .select("id, nickname")
    .in("id", allIds);

  const profileMap: Record<string, string> = {};
  (profiles || []).forEach((p: any) => {
    profileMap[p.id] = p.nickname || "익명";
  });

  const result = commissions.map((c: any) => ({
    ...c,
    nickname: profileMap[c.user_id] || "익명",
    deleted_by_nickname: c.deleted_by ? (profileMap[c.deleted_by] || "알 수 없음") : undefined,
  }));

  return NextResponse.json({ commissions: result });
}

// 복구 (되살리기)
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  let body: { id?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!body.id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  const { error: restoreError } = await adminSupabase
    .from("commissions")
    .update({
      deleted_at: null,
      deleted_reason_category: null,
      deleted_reason_detail: null,
      deleted_by: null,
    })
    .eq("id", body.id);

  if (restoreError) {
    console.error("commission restore error:", restoreError);
    return NextResponse.json({ error: "복구 실패: " + restoreError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// 완전삭제 (DB에서 영구 제거)
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const commissionId = req.nextUrl.searchParams.get("id");
  if (!commissionId) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  // Delete child records first (FK constraints without CASCADE)
  await adminSupabase.from("commission_disputes").delete().eq("commission_id", commissionId);
  await adminSupabase.from("commission_chats").delete().eq("commission_id", commissionId);
  await adminSupabase.from("commission_negotiations").delete().eq("commission_id", commissionId);
  await adminSupabase.from("commission_results").delete().eq("commission_id", commissionId);
  await adminSupabase.from("commission_comments").delete().eq("commission_id", commissionId);
  await adminSupabase.from("commission_bookmarks").delete().eq("commission_id", commissionId);
  await adminSupabase.from("commission_revisions").delete().eq("commission_id", commissionId);
  await adminSupabase.from("commission_bids").delete().eq("commission_id", commissionId);

  const { error: deleteError } = await adminSupabase
    .from("commissions")
    .delete()
    .eq("id", commissionId);

  if (deleteError) {
    console.error("commission permanent delete error:", deleteError);
    return NextResponse.json({ error: "완전삭제 실패: " + deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
