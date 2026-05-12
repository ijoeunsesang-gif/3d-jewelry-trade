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
    const { subscription_id, rating, comment } = await req.json();
    if (!subscription_id || !rating) {
      return NextResponse.json({ error: "구독 ID와 평점이 필요합니다." }, { status: 400 });
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "평점은 1~5점 사이여야 합니다." }, { status: 400 });
    }

    const { data: sub } = await adminSupabase
      .from("cad_subscriptions")
      .select("id, subscriber_id, mentor_id")
      .eq("id", subscription_id)
      .single();

    if (!sub) return NextResponse.json({ error: "구독을 찾을 수 없습니다." }, { status: 404 });
    if (sub.subscriber_id !== user.id) return NextResponse.json({ error: "본인 구독만 평가할 수 있습니다." }, { status: 403 });

    // 월 1회 중복 체크
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: existing } = await adminSupabase
      .from("cad_mentor_ratings")
      .select("id")
      .eq("subscription_id", subscription_id)
      .eq("subscriber_id", user.id)
      .gte("created_at", monthStart.toISOString())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "이번 달에 이미 평점을 남겼습니다." }, { status: 400 });
    }

    // 평점 등록
    await adminSupabase.from("cad_mentor_ratings").insert({
      subscription_id,
      mentor_id: sub.mentor_id,
      subscriber_id: user.id,
      rating,
      comment: comment?.trim() ?? "",
    });

    // cad_mentors avg_rating, total_ratings 업데이트
    const { data: allRatings } = await adminSupabase
      .from("cad_mentor_ratings")
      .select("rating")
      .eq("mentor_id", sub.mentor_id);

    const ratings = (allRatings ?? []) as { rating: number }[];
    const total = ratings.length;
    const avg = total > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / total : 0;

    await adminSupabase
      .from("cad_mentors")
      .update({ avg_rating: Math.round(avg * 10) / 10, total_ratings: total })
      .eq("id", sub.mentor_id);

    // 3개월 연속 평균 3점 미만 시 관리자 알림
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentRatings } = await adminSupabase
      .from("cad_mentor_ratings")
      .select("rating, created_at")
      .eq("mentor_id", sub.mentor_id)
      .gte("created_at", threeMonthsAgo);

    const recent = (recentRatings ?? []) as { rating: number; created_at: string }[];
    if (recent.length >= 3) {
      const recentAvg = recent.reduce((s, r) => s + r.rating, 0) / recent.length;
      if (recentAvg < 3) {
        const { data: mentorProfile } = await adminSupabase
          .from("cad_mentors")
          .select("user_id, profiles(nickname)")
          .eq("id", sub.mentor_id)
          .single();

        const mentorName = (mentorProfile?.profiles as unknown as { nickname: string | null } | null)?.nickname ?? "멘토";

        const { data: admins } = await adminSupabase
          .from("profiles")
          .select("id")
          .eq("role", "admin");

        if (admins && admins.length > 0) {
          await adminSupabase.from("notifications").insert(
            (admins as { id: string }[]).map((a) => ({
              user_id: a.id,
              type: "cad_low_rating_alert",
              title: `[캐드스쿨] ${mentorName} 멘토 최근 3개월 평균 평점 ${recentAvg.toFixed(1)}점`,
              link: "/admin/cad-school",
              is_read: false,
            }))
          );
        }
      }
    }

    return NextResponse.json({ ok: true, avg_rating: Math.round(avg * 10) / 10, total_ratings: total });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
