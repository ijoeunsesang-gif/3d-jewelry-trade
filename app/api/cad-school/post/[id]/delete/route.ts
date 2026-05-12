import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { r2DeleteMany } from "@/lib/r2";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const { data: post } = await adminSupabase
    .from("cad_posts")
    .select("id, user_id, files")
    .eq("id", id)
    .single();

  if (!post) return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  if (!isAdmin && post.user_id !== user.id) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  // 답변(최상위 댓글) 존재 여부 확인
  const { count } = await adminSupabase
    .from("cad_post_comments")
    .select("*", { count: "exact", head: true })
    .eq("post_id", id)
    .is("parent_id", null);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "답변이 있는 게시물은 삭제할 수 없습니다." }, { status: 400 });
  }

  // DB 삭제 (댓글/대댓글 cascade 처리)
  await adminSupabase.from("cad_post_comments").delete().eq("post_id", id);
  const { error: deleteErr } = await adminSupabase.from("cad_posts").delete().eq("id", id);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  // R2 첨부 파일 삭제 (실패해도 응답에 영향 없음)
  const files = (post.files ?? []) as { url: string }[];
  const r2Base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";
  const r2Paths = files
    .map((f) => f.url.startsWith(r2Base + "/") ? f.url.slice(r2Base.length + 1) : null)
    .filter((k): k is string => k !== null)
    .map((key) => ({ bucket: "thumbnails", key }));

  if (r2Paths.length > 0) {
    r2DeleteMany(r2Paths).catch((e) => console.error("R2 파일 삭제 오류 (무시):", e));
  }

  return NextResponse.json({ ok: true });
}
