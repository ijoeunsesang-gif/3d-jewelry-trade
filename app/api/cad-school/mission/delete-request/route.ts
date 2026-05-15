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

  const { mission_id, reason } = await req.json();
  if (!mission_id) return NextResponse.json({ error: "mission_id가 필요합니다." }, { status: 400 });
  if (!reason?.trim()) return NextResponse.json({ error: "삭제 요청 사유를 입력해주세요." }, { status: 400 });

  const { data: mission } = await adminSupabase
    .from("cad_missions")
    .select("id, mentor:cad_mentors(user_id)")
    .eq("id", mission_id)
    .single();

  if (!mission) return NextResponse.json({ error: "미션을 찾을 수 없습니다." }, { status: 404 });

  const mentorUserId = (mission.mentor as unknown as { user_id: string } | null)?.user_id;
  if (mentorUserId !== user.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // 이미 pending 요청이 있으면 거부
  const { data: existing } = await adminSupabase
    .from("cad_mission_deletion_requests")
    .select("id")
    .eq("mission_id", mission_id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "이미 삭제 요청이 접수되어 있습니다." }, { status: 400 });

  const { error: insertErr } = await adminSupabase
    .from("cad_mission_deletion_requests")
    .insert({ mission_id, user_id: user.id, reason: reason.trim() });

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const url = new URL(req.url);
  const missionId = url.searchParams.get("mission_id");
  if (!missionId) return NextResponse.json({ error: "mission_id가 필요합니다." }, { status: 400 });

  const { data } = await adminSupabase
    .from("cad_mission_deletion_requests")
    .select("id, status")
    .eq("mission_id", missionId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ request: data ?? null });
}
