import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MISSION_REWARD = 30;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    const { data: mentor } = await adminSupabase
      .from("cad_mentors")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!mentor) return NextResponse.json({ error: "멘토만 미션을 등록할 수 있습니다." }, { status: 403 });

    const { title, description, hint_commands, difficulty, files } = await req.json();
    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "제목과 설명을 입력해주세요." }, { status: 400 });
    }
    if (!["easy", "normal", "hard"].includes(difficulty)) {
      return NextResponse.json({ error: "올바른 난이도를 선택해주세요." }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data: todayMission } = await adminSupabase
      .from("cad_missions")
      .select("id")
      .eq("mentor_id", mentor.id)
      .gte("created_at", todayISO)
      .maybeSingle();

    if (todayMission) {
      return NextResponse.json({ error: "하루에 1개의 미션만 등록할 수 있습니다." }, { status: 400 });
    }

    const { data: mission, error: missionErr } = await adminSupabase
      .from("cad_missions")
      .insert({
        mentor_id: mentor.id,
        title: title.trim(),
        description: description.trim(),
        hint_commands: hint_commands?.trim() || null,
        difficulty,
        files: files ?? [],
        status: "active",
      })
      .select("id")
      .single();

    if (missionErr) return NextResponse.json({ error: missionErr.message }, { status: 500 });

    await adminSupabase.from("points").insert({
      user_id: user.id,
      amount: MISSION_REWARD,
      reason: "캐드스쿨 미션 등록",
      reference_id: mission.id,
    });
    await adminSupabase.rpc("increment_profile_points", { uid: user.id, delta: MISSION_REWARD });

    await adminSupabase.from("notifications").insert({
      user_id: user.id,
      type: "cad_mission_posted",
      title: `미션이 등록되었습니다 (+${MISSION_REWARD}P)`,
      link: `/cad-school/mission/${mission.id}`,
      is_read: false,
    });

    return NextResponse.json({ id: mission.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
