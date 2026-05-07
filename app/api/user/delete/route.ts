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

  // 탈퇴 사유 (선택)
  let reason: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    reason = body?.reason?.trim() || null;
  } catch { /* body 없으면 무시 */ }

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

  // 탈퇴 전 핵심 정보 조회
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("nickname, email, phone_number, role, warning_count, bank_name, account_holder, account_number")
    .eq("id", userId)
    .single();

  // deleted_profiles에 핵심 정보 보관 (전자상거래법 기준 5년)
  const bankAccount = [
    profile?.bank_name,
    profile?.account_holder,
    profile?.account_number,
  ]
    .filter(Boolean)
    .join(" / ") || null;

  await adminSupabase.from("deleted_profiles").insert({
    original_user_id: userId,
    nickname:         profile?.nickname    || null,
    email:            profile?.email       || user.email || null,
    phone:            profile?.phone_number || null,
    bank_account:     bankAccount,
    role:             profile?.role        || "user",
    warning_count:    profile?.warning_count ?? 0,
    reason,
  });

  // 판매자인 경우 등록된 모델 비공개 처리
  if (profile?.role === "seller") {
    await adminSupabase
      .from("models")
      .update({ is_public: false })
      .eq("seller_id", userId);
  }

  // 개인 식별 정보 익명화 + 소프트 삭제
  await adminSupabase
    .from("profiles")
    .update({
      nickname:       "탈퇴한 사용자",
      avatar_url:     null,
      bio:            null,
      phone_number:   null,
      bank_name:      null,
      account_holder: null,
      account_number: null,
      business_number: null,
      business_name:  null,
      deleted_at:     new Date().toISOString(),
    })
    .eq("id", userId);

  // auth.users 삭제 + profiles 하드 삭제
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
