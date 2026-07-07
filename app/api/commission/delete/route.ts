import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/isAdminCheck";

// Service role client — bypasses RLS for cascade deletion
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: NextRequest) {
  const commissionId = req.nextUrl.searchParams.get("id");
  if (!commissionId) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  let body: { reason_category?: string; reason_detail?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Verify caller is authenticated and owns the commission
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  const isAdmin = await isAdminUser(adminSupabase, user.id);

  const { data: commission, error: fetchError } = await adminSupabase
    .from("commissions")
    .select("user_id, status")
    .eq("id", commissionId)
    .single();

  if (fetchError || !commission) {
    return NextResponse.json({ error: "의뢰를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!isAdmin && commission.user_id !== user.id) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  // 작업중 이후 상태에서는 의뢰자 삭제 불가
  const NON_DELETABLE_STATUSES = ["working", "completed", "downloaded"];
  if (!isAdmin && NON_DELETABLE_STATUSES.includes(commission.status)) {
    return NextResponse.json(
      { error: "작업이 시작된 의뢰는 삭제할 수 없습니다. 관리자에게 문의하세요." },
      { status: 403 }
    );
  }

  if (!isAdmin) {
    // 작성자 본인 삭제 → soft delete (row 유지)
    const ALLOWED_REASON_CATEGORIES = ["mistake", "cancel", "solved_elsewhere", "info_error", "other"];
    const reasonCategory = body.reason_category;

    if (!reasonCategory) {
      return NextResponse.json({ error: "삭제 사유를 선택해주세요." }, { status: 400 });
    }
    if (!ALLOWED_REASON_CATEGORIES.includes(reasonCategory)) {
      return NextResponse.json({ error: "올바르지 않은 삭제 사유입니다." }, { status: 400 });
    }
    if (reasonCategory === "other" && !body.reason_detail?.trim()) {
      return NextResponse.json({ error: "상세 사유를 입력해주세요." }, { status: 400 });
    }

    const { error: softDeleteError } = await adminSupabase
      .from("commissions")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_reason_category: reasonCategory,
        deleted_reason_detail: body.reason_detail?.trim() || null,
        deleted_by: user.id,
      })
      .eq("id", commissionId);

    if (softDeleteError) {
      console.error("commission soft delete error:", softDeleteError);
      return NextResponse.json({ error: "삭제 실패: " + softDeleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  // 관리자 삭제 → hard delete. Delete child records first (FK constraints without CASCADE)
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
    console.error("commission delete error:", deleteError);
    return NextResponse.json({ error: "삭제 실패: " + deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
