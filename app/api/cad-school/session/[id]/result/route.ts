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

  const { data: session } = await adminSupabase
    .from("cad_mentoring_sessions")
    .select("id, status, mentor:cad_mentors(user_id)")
    .eq("id", id)
    .single();

  if (!session) return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });

  const mentorUserId = (session.mentor as unknown as { user_id: string } | null)?.user_id;
  if (mentorUserId !== user.id) {
    return NextResponse.json({ error: "멘토만 결과물을 수정할 수 있습니다." }, { status: 403 });
  }

  if (!["accepted", "completed"].includes(session.status)) {
    return NextResponse.json({ error: "진행중 또는 완료된 세션만 수정할 수 있습니다." }, { status: 400 });
  }

  try {
    const { result_files } = await req.json();
    if (!Array.isArray(result_files)) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const { error: updateErr } = await adminSupabase
      .from("cad_mentoring_sessions")
      .update({ result_files, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
