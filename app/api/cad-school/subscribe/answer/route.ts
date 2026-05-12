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
    const { message_id } = await req.json();
    if (!message_id) return NextResponse.json({ error: "메시지 ID가 필요합니다." }, { status: 400 });

    const { data: msg } = await adminSupabase
      .from("cad_subscription_chats")
      .select("id, subscription_id, sender_id, is_answered")
      .eq("id", message_id)
      .single();

    if (!msg) return NextResponse.json({ error: "메시지를 찾을 수 없습니다." }, { status: 404 });
    if (msg.is_answered) return NextResponse.json({ error: "이미 답변 완료된 메시지입니다." }, { status: 400 });

    const { data: sub } = await adminSupabase
      .from("cad_subscriptions")
      .select("mentor:cad_mentors(user_id)")
      .eq("id", msg.subscription_id)
      .single();

    const mentorUserId = (sub?.mentor as unknown as { user_id: string } | null)?.user_id;
    if (user.id !== mentorUserId) {
      return NextResponse.json({ error: "멘토만 답변 완료 처리할 수 있습니다." }, { status: 403 });
    }

    await adminSupabase
      .from("cad_subscription_chats")
      .update({ is_answered: true, answered_at: new Date().toISOString() })
      .eq("id", message_id);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
