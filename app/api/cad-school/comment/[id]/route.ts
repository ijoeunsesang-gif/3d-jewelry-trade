import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isAdminUser(userId: string): Promise<boolean> {
  const { data } = await adminSupabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return data?.role === "admin";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const { data: comment } = await adminSupabase
    .from("cad_post_comments")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (!comment) return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });

  const admin = await isAdminUser(user.id);
  if (!admin && comment.user_id !== user.id) {
    return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 });
  }

  try {
    const { content } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
    }

    const { error: updateErr } = await adminSupabase
      .from("cad_post_comments")
      .update({ content: content.trim() })
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

  const { data: comment } = await adminSupabase
    .from("cad_post_comments")
    .select("id, user_id, post_id, parent_id, is_best_answer")
    .eq("id", id)
    .single();

  if (!comment) return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });

  const admin = await isAdminUser(user.id);
  if (!admin && comment.user_id !== user.id) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  // 최상위 댓글이면 대댓글 먼저 삭제
  if (!comment.parent_id) {
    await adminSupabase.from("cad_post_comments").delete().eq("parent_id", id);
  }

  const { error: deleteErr } = await adminSupabase
    .from("cad_post_comments")
    .delete()
    .eq("id", id);

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  // 채택된 답변 삭제 시 게시물 다시 open 상태로
  if (comment.is_best_answer) {
    await adminSupabase
      .from("cad_posts")
      .update({ status: "open" })
      .eq("id", comment.post_id);
  }

  return NextResponse.json({ ok: true });
}
