import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    const { subscription_id } = await req.json();
    if (!subscription_id) return NextResponse.json({ error: "구독 ID가 필요합니다." }, { status: 400 });

    const { data: subscription } = await adminSupabase
      .from("cad_subscriptions")
      .select("id, subscriber_id, status, expires_at")
      .eq("id", subscription_id)
      .single();

    if (!subscription) return NextResponse.json({ error: "구독을 찾을 수 없습니다." }, { status: 404 });
    if (subscription.subscriber_id !== user.id) return NextResponse.json({ error: "본인의 구독만 취소할 수 있습니다." }, { status: 403 });
    if (subscription.status !== "active") return NextResponse.json({ error: "이미 취소되었거나 만료된 구독입니다." }, { status: 400 });

    // 즉시 취소가 아닌 만료일까지 유지 (status = cancelled로 변경)
    await adminSupabase
      .from("cad_subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", subscription_id);

    return NextResponse.json({ ok: true, expires_at: subscription.expires_at });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
