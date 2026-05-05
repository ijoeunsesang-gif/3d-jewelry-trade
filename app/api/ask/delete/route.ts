import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/isAdminCheck";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get("id");
  if (!postId) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  const { data: post, error: fetchError } = await adminSupabase
    .from("ask_posts")
    .select("user_id")
    .eq("id", postId)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });
  }

  const isAdmin = await isAdminUser(adminSupabase, user.id);
  if (!isAdmin && post.user_id !== user.id) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  // ask_answers → ask_reports, ask_answer_likes는 ON DELETE CASCADE로 자동 삭제됨
  const { error: deleteError } = await adminSupabase
    .from("ask_posts")
    .delete()
    .eq("id", postId);

  if (deleteError) {
    console.error("ask_posts 삭제 실패:", deleteError);
    return NextResponse.json({ error: "삭제 실패: " + deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
