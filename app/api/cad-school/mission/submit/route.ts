import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SUBMIT_REWARD = 50;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    const { mission_id, files, comment } = await req.json();
    if (!mission_id || !files?.length) {
      return NextResponse.json({ error: "미션 ID와 파일이 필요합니다." }, { status: 400 });
    }

    const { data: mission } = await adminSupabase
      .from("cad_missions")
      .select("id, status, mentor:cad_mentors(user_id)")
      .eq("id", mission_id)
      .single();

    if (!mission) return NextResponse.json({ error: "미션을 찾을 수 없습니다." }, { status: 404 });
    if (mission.status !== "active") return NextResponse.json({ error: "종료된 미션입니다." }, { status: 400 });

    const { data: existing } = await adminSupabase
      .from("cad_mission_submissions")
      .select("id, point_given")
      .eq("mission_id", mission_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const isFirstSubmit = !existing;
    const alreadyGiven = existing?.point_given ?? false;

    const { data: submission, error: subErr } = await adminSupabase
      .from("cad_mission_submissions")
      .upsert({
        mission_id,
        user_id: user.id,
        files,
        comment: comment ?? null,
        point_given: alreadyGiven || isFirstSubmit,
        updated_at: new Date().toISOString(),
      }, { onConflict: "mission_id,user_id" })
      .select("id")
      .single();

    if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

    let pointAwarded = 0;
    if (isFirstSubmit) {
      await adminSupabase.from("points").insert({
        user_id: user.id,
        amount: SUBMIT_REWARD,
        reason: "캐드스쿨 미션 제출",
        reference_id: submission.id,
      });
      await adminSupabase.rpc("increment_profile_points", { uid: user.id, delta: SUBMIT_REWARD });
      pointAwarded = SUBMIT_REWARD;

      const mentorUserId = (mission.mentor as unknown as { user_id: string } | null)?.user_id;
      if (mentorUserId) {
        await adminSupabase.from("notifications").insert({
          user_id: mentorUserId,
          type: "cad_mission_submitted",
          title: "새 결과물이 제출되었습니다",
          link: `/cad-school/mission/${mission_id}`,
          is_read: false,
        });
      }
    }

    return NextResponse.json({ id: submission.id, pointAwarded });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    const { submission_id } = await req.json();
    if (!submission_id) return NextResponse.json({ error: "제출물 ID가 필요합니다." }, { status: 400 });

    const { data: submission } = await adminSupabase
      .from("cad_mission_submissions")
      .select("id, user_id, is_best")
      .eq("id", submission_id)
      .single();

    if (!submission) return NextResponse.json({ error: "제출물을 찾을 수 없습니다." }, { status: 404 });
    if (submission.user_id !== user.id) return NextResponse.json({ error: "본인 제출물만 삭제할 수 있습니다." }, { status: 403 });
    if (submission.is_best) return NextResponse.json({ error: "채택된 제출물은 삭제할 수 없습니다." }, { status: 400 });

    const { error: delErr } = await adminSupabase
      .from("cad_mission_submissions")
      .delete()
      .eq("id", submission_id);

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
