import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await adminSupabase
    .from("cad_tips")
    .select(
      `id, title, content, images, like_count, bookmark_count, comment_count, created_at, updated_at,
       mentor:cad_mentors!mentor_id(
         id, avg_rating, career_start_year, intro, user_id,
         profiles(nickname, avatar_url)
       )`
    )
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: "팁을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ tip: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const { data: tip } = await adminSupabase
    .from("cad_tips")
    .select("id, mentor:cad_mentors!mentor_id(user_id)")
    .eq("id", id)
    .single();

  if (!tip) return NextResponse.json({ error: "팁을 찾을 수 없습니다." }, { status: 404 });

  const mentorUserId = (tip.mentor as unknown as { user_id: string } | null)?.user_id;
  if (mentorUserId !== user.id) {
    return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 });
  }

  try {
    const { title, content, images } = await req.json();
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "제목과 내용을 입력해주세요." }, { status: 400 });
    }

    const { error: updateErr } = await adminSupabase
      .from("cad_tips")
      .update({ title: title.trim(), content: content.trim(), images: images ?? [], updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const { data: tip } = await adminSupabase
    .from("cad_tips")
    .select("id, mentor:cad_mentors!mentor_id(user_id)")
    .eq("id", id)
    .single();

  if (!tip) return NextResponse.json({ error: "팁을 찾을 수 없습니다." }, { status: 404 });

  const mentorUserId = (tip.mentor as unknown as { user_id: string } | null)?.user_id;
  const { data: profile } = await adminSupabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin";

  if (mentorUserId !== user.id && !isAdmin) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  const { error: deleteErr } = await adminSupabase.from("cad_tips").delete().eq("id", id);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
