import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MENTOR_CHANGE_LIMITS: Record<string, number> = {
  basic: 1,
  pro: 2,
  master: 3,
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    const { subscription_id, new_mentor_id } = await req.json();
    if (!subscription_id || !new_mentor_id) {
      return NextResponse.json({ error: "구독 ID와 새 멘토 ID가 필요합니다." }, { status: 400 });
    }

    // 구독 조회
    const { data: subscription } = await adminSupabase
      .from("cad_subscriptions")
      .select("id, subscriber_id, mentor_id, plan_type, status, mentor_change_count")
      .eq("id", subscription_id)
      .single();

    if (!subscription) return NextResponse.json({ error: "구독을 찾을 수 없습니다." }, { status: 404 });
    if (subscription.subscriber_id !== user.id) return NextResponse.json({ error: "본인의 구독만 변경할 수 있습니다." }, { status: 403 });
    if (subscription.status !== "active") return NextResponse.json({ error: "활성 구독만 멘토를 변경할 수 있습니다." }, { status: 400 });
    if (subscription.mentor_id === new_mentor_id) return NextResponse.json({ error: "현재와 동일한 멘토입니다." }, { status: 400 });

    // 교체 횟수 확인
    const limit = MENTOR_CHANGE_LIMITS[subscription.plan_type] ?? 1;
    if (subscription.mentor_change_count >= limit) {
      return NextResponse.json({ error: "이번 달 멘토 교체 횟수를 모두 사용했습니다." }, { status: 400 });
    }

    // 새 멘토 확인
    const { data: newMentor } = await adminSupabase
      .from("cad_mentors")
      .select("id, user_id, is_suspended")
      .eq("id", new_mentor_id)
      .single();

    if (!newMentor) return NextResponse.json({ error: "새 멘토를 찾을 수 없습니다." }, { status: 404 });
    if (newMentor.is_suspended) return NextResponse.json({ error: "현재 활동이 중단된 멘토입니다." }, { status: 400 });

    // 기존 멘토 user_id 조회
    const { data: oldMentor } = await adminSupabase
      .from("cad_mentors")
      .select("user_id")
      .eq("id", subscription.mentor_id)
      .single();

    // 구독 업데이트
    await adminSupabase
      .from("cad_subscriptions")
      .update({
        mentor_id: new_mentor_id,
        mentor_change_count: subscription.mentor_change_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription_id);

    // 닉네임 조회
    const [{ data: subProfile }, { data: newMentorProfile }, { data: oldMentorProfile }] = await Promise.all([
      adminSupabase.from("profiles").select("nickname").eq("id", user.id).single(),
      adminSupabase.from("profiles").select("nickname").eq("id", newMentor.user_id).single(),
      oldMentor ? adminSupabase.from("profiles").select("nickname").eq("id", oldMentor.user_id).single() : Promise.resolve({ data: null }),
    ]);

    const subscriberName = subProfile?.nickname ?? "구독자";
    const newMentorName = newMentorProfile?.nickname ?? "멘토";
    const oldMentorName = oldMentorProfile?.nickname ?? "멘토";

    // 알림 전송
    const notifRows = [
      {
        user_id: user.id,
        type: "cad_mentor_change",
        title: `멘토가 ${newMentorName}으로 변경되었습니다`,
        link: "/cad-school/my",
        is_read: false,
      },
      {
        user_id: newMentor.user_id,
        type: "cad_mentor_change",
        title: `${subscriberName}님이 멘토로 지정했습니다`,
        link: "/cad-school/my",
        is_read: false,
      },
    ];

    if (oldMentor) {
      notifRows.push({
        user_id: oldMentor.user_id,
        type: "cad_mentor_change",
        title: `${subscriberName}님이 멘토를 ${oldMentorName}에서 ${newMentorName}으로 변경했습니다`,
        link: "/cad-school/my",
        is_read: false,
      });
    }

    await adminSupabase.from("notifications").insert(notifRows);

    return NextResponse.json({ ok: true, remaining: limit - (subscription.mentor_change_count + 1) });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
