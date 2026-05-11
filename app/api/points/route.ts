import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/isAdminCheck";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // 인증 확인
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  // 관리자 권한 확인
  if (!(await isAdminUser(adminSupabase, user.id))) {
    return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { user_id, amount, reason, reference_id, expires_at } = body;

    if (!user_id || amount === undefined || !reason) {
      return NextResponse.json({ error: "user_id, amount, reason이 필요합니다." }, { status: 400 });
    }

    if (typeof amount !== "number") {
      return NextResponse.json({ error: "amount는 숫자여야 합니다." }, { status: 400 });
    }

    // points 테이블에 기록
    const { error: insertError } = await adminSupabase.from("points").insert({
      user_id,
      amount,
      reason,
      reference_id: reference_id || null,
      expires_at: expires_at || null,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // profiles.points 원자적 업데이트
    const { error: rpcError } = await adminSupabase.rpc("increment_profile_points", {
      uid: user_id,
      delta: amount,
    });

    if (rpcError) {
      console.error("[points] profiles.points 업데이트 실패:", rpcError);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
