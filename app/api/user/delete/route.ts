import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  const userId = user.id;

  // 진행중인 의뢰가 있으면 탈퇴 차단
  const { data: activeCommissions } = await adminSupabase
    .from("commissions")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["working"])
    .limit(1);

  if (activeCommissions && activeCommissions.length > 0) {
    return NextResponse.json(
      { error: "진행중인 의뢰가 있어 탈퇴할 수 없습니다." },
      { status: 400 }
    );
  }

  // 판매자인 경우 등록된 모델 비공개 처리
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "seller") {
    await adminSupabase
      .from("models")
      .update({ is_public: false })
      .eq("seller_id", userId);
  }

  // 탈퇴 시각 기록 (판매자 목록 쿼리의 deleted_at IS NULL 필터로 즉시 제외됨)
  await adminSupabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", userId);

  // auth.admin.deleteUser + 명시적 profiles 삭제 (CASCADE FK 미설정 대비)
  const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);
  if (!deleteError) {
    await adminSupabase.from("profiles").delete().eq("id", userId);
  }
  if (deleteError) {
    console.error("deleteUser error:", deleteError);
    return NextResponse.json({ error: "탈퇴 처리 실패: " + deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
