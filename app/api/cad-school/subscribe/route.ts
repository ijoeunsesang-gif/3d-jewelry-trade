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
    const { mentor_id, plan_type, price } = await req.json();
    if (!mentor_id || !plan_type || !price) {
      return NextResponse.json({ error: "필수 정보가 누락되었습니다." }, { status: 400 });
    }

    // 이미 활성 구독 확인
    const { data: existing } = await adminSupabase
      .from("cad_subscriptions")
      .select("id")
      .eq("subscriber_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "이미 활성 구독이 있습니다. 기존 구독을 취소 후 다시 시도해주세요." }, { status: 400 });
    }

    // 멘토 확인
    const { data: mentor } = await adminSupabase
      .from("cad_mentors")
      .select("id, user_id, is_suspended")
      .eq("id", mentor_id)
      .single();

    if (!mentor) return NextResponse.json({ error: "멘토를 찾을 수 없습니다." }, { status: 404 });
    if (mentor.is_suspended) return NextResponse.json({ error: "현재 활동이 중단된 멘토입니다." }, { status: 400 });

    // 구독 생성 (만료일 = 30일 후)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: subscription, error: subErr } = await adminSupabase
      .from("cad_subscriptions")
      .insert({ subscriber_id: user.id, mentor_id, plan_type, price, expires_at: expiresAt })
      .select("id")
      .single();

    if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

    // 닉네임 조회
    const [{ data: subProfile }, { data: mentorProfile }] = await Promise.all([
      adminSupabase.from("profiles").select("nickname").eq("id", user.id).single(),
      adminSupabase.from("profiles").select("nickname").eq("id", mentor.user_id).single(),
    ]);

    const subscriberName = subProfile?.nickname ?? "구독자";
    const mentorName = mentorProfile?.nickname ?? "멘토";

    // 알림 전송
    await adminSupabase.from("notifications").insert([
      {
        user_id: user.id,
        type: "cad_subscription",
        title: `${mentorName} 멘토와 구독이 시작되었습니다`,
        link: "/cad-school/my",
        is_read: false,
      },
      {
        user_id: mentor.user_id,
        type: "cad_subscription",
        title: `${subscriberName}님이 구독을 시작했습니다`,
        link: "/cad-school/my",
        is_read: false,
      },
    ]);

    return NextResponse.json({ ok: true, id: subscription.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
