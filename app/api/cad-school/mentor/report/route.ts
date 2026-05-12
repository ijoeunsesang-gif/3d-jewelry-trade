import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_RESPONSE_HOURS: Record<string, number> = {
  basic: 48, pro: 36, master: 24,
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    const { subscription_id, message_id, reason } = await req.json();
    if (!subscription_id || !message_id) {
      return NextResponse.json({ error: "구독 ID와 메시지 ID가 필요합니다." }, { status: 400 });
    }

    const { data: sub } = await adminSupabase
      .from("cad_subscriptions")
      .select("id, subscriber_id, mentor_id, plan_type, status, mentor:cad_mentors(id, user_id, warning_count, is_suspended)")
      .eq("id", subscription_id)
      .single();

    if (!sub) return NextResponse.json({ error: "구독을 찾을 수 없습니다." }, { status: 404 });
    if (sub.subscriber_id !== user.id) return NextResponse.json({ error: "본인 구독만 신고할 수 있습니다." }, { status: 403 });
    if (sub.status !== "active") return NextResponse.json({ error: "활성 구독만 신고할 수 있습니다." }, { status: 400 });

    const { data: msg } = await adminSupabase
      .from("cad_subscription_chats")
      .select("id, subscription_id, sender_id, is_answered, answered_at, created_at, message_type")
      .eq("id", message_id)
      .single();

    if (!msg) return NextResponse.json({ error: "메시지를 찾을 수 없습니다." }, { status: 404 });
    if (msg.is_answered) return NextResponse.json({ error: "이미 답변된 메시지입니다." }, { status: 400 });

    // 실제 시간 초과 여부 검증
    const responseHours = PLAN_RESPONSE_HOURS[sub.plan_type] ?? 48;
    const msgCreatedAt = new Date(msg.created_at).getTime();
    const elapsedHours = (Date.now() - msgCreatedAt) / (1000 * 60 * 60);

    if (elapsedHours < responseHours) {
      return NextResponse.json({
        error: `답변 시간 ${responseHours}시간이 아직 지나지 않았습니다. (${Math.floor(elapsedHours)}시간 경과)`,
      }, { status: 400 });
    }

    const mentor = sub.mentor as unknown as { id: string; user_id: string; warning_count: number; is_suspended: boolean } | null;
    if (!mentor) return NextResponse.json({ error: "멘토 정보를 찾을 수 없습니다." }, { status: 404 });
    if (mentor.is_suspended) return NextResponse.json({ error: "이미 정지된 멘토입니다." }, { status: 400 });

    // 경고 생성
    await adminSupabase.from("cad_mentor_warnings").insert({
      mentor_id: mentor.id,
      reason: reason || "답변 시간 초과",
      warning_type: "late_response",
      reported_by: user.id,
      admin_confirmed: true,
    });

    const newWarningCount = mentor.warning_count + 1;
    await adminSupabase.from("cad_mentors").update({ warning_count: newWarningCount }).eq("id", mentor.id);

    // 경고 3회 이상: 1개월 정지
    if (newWarningCount >= 3) {
      const suspendedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await adminSupabase.from("cad_mentors").update({ is_suspended: true, suspended_until: suspendedUntil }).eq("id", mentor.id);

      // 멘토 닉네임
      const { data: mentorProfile } = await adminSupabase.from("profiles").select("nickname").eq("id", mentor.user_id).single();
      const mentorName = mentorProfile?.nickname ?? "멘토";

      // 해당 멘토의 모든 활성 구독자 조회
      const { data: affectedSubs } = await adminSupabase
        .from("cad_subscriptions")
        .select("id, subscriber_id")
        .eq("mentor_id", mentor.id)
        .eq("status", "active");

      if (affectedSubs && affectedSubs.length > 0) {
        const notifs = affectedSubs.map((s: { id: string; subscriber_id: string }) => ({
          user_id: s.subscriber_id,
          type: "cad_mentor_suspended",
          title: `${mentorName} 멘토가 활동 정지되었습니다. 멘토 교체 횟수 차감 없이 교체 가능합니다`,
          link: `/cad-school/subscription/${s.id}`,
          is_read: false,
        }));
        await adminSupabase.from("notifications").insert(notifs);
      }

      // 멘토에게도 알림
      await adminSupabase.from("notifications").insert({
        user_id: mentor.user_id,
        type: "cad_mentor_suspended",
        title: "경고 3회 누적으로 멘토 활동이 1개월 정지되었습니다",
        link: "/cad-school/my",
        is_read: false,
      });

      return NextResponse.json({ ok: true, suspended: true, warning_count: newWarningCount });
    }

    return NextResponse.json({ ok: true, suspended: false, warning_count: newWarningCount });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
