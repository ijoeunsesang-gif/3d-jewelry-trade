import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // 만료 3일 전이고 아직 알림을 보내지 않은 활성 수강 패키지 조회
    const { data: subs, error } = await adminSupabase
      .from("cad_subscriptions")
      .select("id, subscriber_id, plan_type, expires_at, mentor:cad_mentors(profiles(nickname))")
      .eq("status", "active")
      .eq("is_expiry_notified", false)
      .gte("expires_at", now.toISOString())
      .lte("expires_at", threeDaysLater.toISOString());

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!subs || subs.length === 0) return NextResponse.json({ ok: true, notified: 0 });

    let notified = 0;
    for (const sub of subs) {
      const mentor = sub.mentor as unknown as { profiles: { nickname: string } | null } | null;
      const mentorName = mentor?.profiles?.nickname ?? "멘토";
      const expiresDate = new Date(sub.expires_at).toLocaleDateString("ko-KR");

      await adminSupabase.from("notifications").insert({
        user_id: sub.subscriber_id,
        type: "cad_expiry",
        title: `${mentorName} 멘토와의 수강 패키지가 ${expiresDate}에 만료됩니다`,
        link: "/cad-school/my",
        is_read: false,
      });

      await adminSupabase
        .from("cad_subscriptions")
        .update({ is_expiry_notified: true })
        .eq("id", sub.id);

      notified++;
    }

    return NextResponse.json({ ok: true, notified });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
