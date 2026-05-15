import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BEST_REWARD = 200;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    const { submission_id } = await req.json();
    if (!submission_id) return NextResponse.json({ error: "제출물 ID가 필요합니다." }, { status: 400 });

    const { data: submission } = await adminSupabase
      .from("cad_mission_submissions")
      .select("id, mission_id, user_id, is_best")
      .eq("id", submission_id)
      .single();

    if (!submission) return NextResponse.json({ error: "제출물을 찾을 수 없습니다." }, { status: 404 });
    if (submission.is_best) return NextResponse.json({ error: "이미 채택된 제출물입니다." }, { status: 400 });

    const { data: mission } = await adminSupabase
      .from("cad_missions")
      .select("id, mentor:cad_mentors(user_id)")
      .eq("id", submission.mission_id)
      .single();

    if (!mission) return NextResponse.json({ error: "미션을 찾을 수 없습니다." }, { status: 404 });

    const mentorUserId = (mission.mentor as unknown as { user_id: string } | null)?.user_id;
    if (mentorUserId !== user.id) {
      return NextResponse.json({ error: "해당 미션의 멘토만 채택할 수 있습니다." }, { status: 403 });
    }

    await adminSupabase
      .from("cad_mission_submissions")
      .update({ is_best: true, updated_at: new Date().toISOString() })
      .eq("id", submission_id);

    await adminSupabase.from("points").insert({
      user_id: submission.user_id,
      amount: BEST_REWARD,
      reason: "캐드스쿨 미션 우수 결과물 채택",
      reference_id: submission_id,
    });
    await adminSupabase.rpc("increment_profile_points", { uid: submission.user_id, delta: BEST_REWARD });

    await adminSupabase.from("notifications").insert({
      user_id: submission.user_id,
      type: "cad_mission_best",
      title: `우수 결과물로 채택되었습니다! (+${BEST_REWARD}P)`,
      link: `/cad-school/mission/${submission.mission_id}`,
      is_read: false,
    });

    return NextResponse.json({ ok: true, pointAwarded: BEST_REWARD });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
