import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BEST_ANSWER_REWARD = 20;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    const { comment_id } = await req.json();
    if (!comment_id) return NextResponse.json({ error: "답변 ID가 필요합니다." }, { status: 400 });

    // 댓글 + 게시글 조회
    const { data: comment } = await adminSupabase
      .from("cad_post_comments")
      .select("id, post_id, user_id, is_best_answer")
      .eq("id", comment_id)
      .single();

    if (!comment) return NextResponse.json({ error: "답변을 찾을 수 없습니다." }, { status: 404 });
    if (comment.is_best_answer) return NextResponse.json({ error: "이미 채택된 답변입니다." }, { status: 400 });

    const { data: post } = await adminSupabase
      .from("cad_posts")
      .select("id, user_id, status")
      .eq("id", comment.post_id)
      .single();

    if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    if (post.user_id !== user.id) return NextResponse.json({ error: "게시글 작성자만 채택할 수 있습니다." }, { status: 403 });
    if (post.status === "closed") return NextResponse.json({ error: "이미 마감된 질문입니다." }, { status: 400 });

    // 채택 처리
    await adminSupabase
      .from("cad_post_comments")
      .update({ is_best_answer: true })
      .eq("id", comment_id);

    // 게시글 마감
    await adminSupabase
      .from("cad_posts")
      .update({ status: "closed" })
      .eq("id", post.id);

    // 답변자에게 20P 지급
    await adminSupabase.from("points").insert({
      user_id: comment.user_id,
      amount: BEST_ANSWER_REWARD,
      reason: "캐드스쿨 채택 보상",
      reference_id: comment_id,
    });
    await adminSupabase.rpc("increment_profile_points", { uid: comment.user_id, delta: BEST_ANSWER_REWARD });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
