import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser, type PushCategory, type PushPayload } from "@/lib/webpush";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await serviceSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  let body: { user_id?: string; category?: PushCategory; payload?: PushPayload };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "잘못된 요청" }, { status: 400 }); }

  const { user_id, category, payload } = body;
  if (!user_id || !category || !payload?.title) {
    return NextResponse.json({ error: "user_id, category, payload.title이 필요합니다." }, { status: 400 });
  }

  // "chat" 카테고리: 두 사용자 간 대화 존재 여부 확인
  if (category === "chat") {
    const { data: conv } = await serviceSupabase
      .from("conversations")
      .select("id")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .or(`user1_id.eq.${user_id},user2_id.eq.${user_id}`)
      .limit(1)
      .maybeSingle();

    if (!conv) {
      return NextResponse.json({ error: "대화 권한이 없습니다." }, { status: 403 });
    }
  } else {
    // 다른 카테고리는 관리자만 (서버 내부 라우트에서 직접 sendPushToUser 호출 권장)
    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
  }

  await sendPushToUser(user_id, category, payload);
  return NextResponse.json({ success: true });
}
