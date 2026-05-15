import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { id, cid } = await params;

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const { data: comment } = await adminSupabase
    .from("cad_tip_comments")
    .select("id, user_id, tip_id")
    .eq("id", cid)
    .single();

  if (!comment) return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });

  // 본인 댓글 또는 해당 팁 멘토 또는 관리자
  const { data: tip } = await adminSupabase
    .from("cad_tips")
    .select("mentor:cad_mentors!mentor_id(user_id)")
    .eq("id", id)
    .single();

  const mentorUserId = (tip?.mentor as unknown as { user_id: string } | null)?.user_id;
  const { data: profile } = await adminSupabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin";

  if (comment.user_id !== user.id && mentorUserId !== user.id && !isAdmin) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  await adminSupabase.from("cad_tip_comments").delete().eq("id", cid);

  // 댓글 수 감소
  const { data: tipData } = await adminSupabase.from("cad_tips").select("comment_count").eq("id", id).single();
  if (tipData) {
    await adminSupabase.from("cad_tips").update({ comment_count: Math.max(0, tipData.comment_count - 1) }).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
