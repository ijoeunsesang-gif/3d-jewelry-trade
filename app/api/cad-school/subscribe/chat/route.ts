import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_LIMITS: Record<string, { checklist: number; review: number }> = {
  basic:  { checklist: 2,  review: 2  },
  pro:    { checklist: 5,  review: 5  },
  master: { checklist: 10, review: 10 },
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    const { subscription_id, content, files, message_type } = await req.json();
    if (!subscription_id || !content?.trim()) {
      return NextResponse.json({ error: "구독 ID와 내용을 입력해주세요." }, { status: 400 });
    }

    const { data: sub } = await adminSupabase
      .from("cad_subscriptions")
      .select("id, subscriber_id, mentor_id, plan_type, status, checklist_count, review_count, mentor:cad_mentors(user_id)")
      .eq("id", subscription_id)
      .single();

    if (!sub) return NextResponse.json({ error: "구독을 찾을 수 없습니다." }, { status: 404 });
    if (sub.status !== "active") return NextResponse.json({ error: "활성 구독에서만 채팅이 가능합니다." }, { status: 400 });

    const mentor = sub.mentor as unknown as { user_id: string } | null;
    const isSubscriber = user.id === sub.subscriber_id;
    const isMentor = user.id === mentor?.user_id;
    if (!isSubscriber && !isMentor) return NextResponse.json({ error: "채팅 권한이 없습니다." }, { status: 403 });

    const limits = PLAN_LIMITS[sub.plan_type] ?? PLAN_LIMITS.basic;
    const sentFiles: { name: string; url: string; ext: string }[] = files ?? [];

    // 쿼터 검증 및 차감 (구독자가 보내는 경우만)
    if (isSubscriber) {
      if (message_type === "checklist") {
        if (sub.checklist_count >= limits.checklist) {
          return NextResponse.json({ error: "이번 달 CAD수정 횟수를 모두 사용했습니다." }, { status: 400 });
        }
        await adminSupabase.from("cad_subscriptions").update({ checklist_count: sub.checklist_count + 1, updated_at: new Date().toISOString() }).eq("id", subscription_id);
      } else if (message_type === "review") {
        if (sub.review_count >= limits.review) {
          return NextResponse.json({ error: "이번 달 검수 횟수를 모두 사용했습니다." }, { status: 400 });
        }
        await adminSupabase.from("cad_subscriptions").update({ review_count: sub.review_count + 1, updated_at: new Date().toISOString() }).eq("id", subscription_id);
      }
    }

    const finalType = isMentor ? "answer" : (message_type ?? "question");

    const { data: msg, error: msgErr } = await adminSupabase
      .from("cad_subscription_chats")
      .insert({ subscription_id, sender_id: user.id, content: content.trim(), files: sentFiles, message_type: finalType })
      .select("id")
      .single();

    if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

    // 상대방 알림
    const notifTarget = isSubscriber ? mentor?.user_id : sub.subscriber_id;
    if (notifTarget) {
      const { data: senderProfile } = await adminSupabase.from("profiles").select("nickname").eq("id", user.id).single();
      const senderName = senderProfile?.nickname ?? "상대방";
      await adminSupabase.from("notifications").insert({
        user_id: notifTarget,
        type: "cad_chat",
        title: `${senderName}님이 메시지를 보냈습니다`,
        link: `/cad-school/subscription/${subscription_id}`,
        is_read: false,
      });
    }

    return NextResponse.json({ ok: true, id: msg.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
