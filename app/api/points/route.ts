import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { user_id, amount, reason, reference_id, expires_at } = body;

    if (!user_id || amount === undefined || !reason) {
      return NextResponse.json({ error: "user_id, amount, reason이 필요합니다." }, { status: 400 });
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
