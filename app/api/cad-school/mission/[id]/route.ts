import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const { data: mission } = await adminSupabase
    .from("cad_missions")
    .select("id, mentor:cad_mentors(user_id)")
    .eq("id", id)
    .single();

  if (!mission) return NextResponse.json({ error: "미션을 찾을 수 없습니다." }, { status: 404 });

  const mentorUserId = (mission.mentor as unknown as { user_id: string } | null)?.user_id;
  if (mentorUserId !== user.id) {
    return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, hint_commands, difficulty, files } = body;

  if (!title?.trim()) return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
  if (!description?.trim()) return NextResponse.json({ error: "미션 설명을 입력해주세요." }, { status: 400 });

  const { error: updateErr } = await adminSupabase
    .from("cad_missions")
    .update({
      title: title.trim(),
      description: description.trim(),
      hint_commands: hint_commands?.trim() || null,
      difficulty,
      files: files ?? [],
    })
    .eq("id", id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
