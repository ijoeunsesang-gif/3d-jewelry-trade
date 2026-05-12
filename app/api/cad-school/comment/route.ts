import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COMMENT_REWARD = 5;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    const { post_id, content, files } = await req.json();
    if (!post_id || !content?.trim()) {
      return NextResponse.json({ error: "게시글 ID와 내용을 입력해주세요." }, { status: 400 });
    }

    // 게시글이 open 상태인지 확인
    const { data: post } = await adminSupabase
      .from("cad_posts")
      .select("id, status, user_id")
      .eq("id", post_id)
      .single();

    if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    if (post.status !== "open") return NextResponse.json({ error: "마감된 질문에는 답변할 수 없습니다." }, { status: 400 });

    // 답변 등록
    const { data: comment, error: commentErr } = await adminSupabase
      .from("cad_post_comments")
      .insert({ post_id, user_id: user.id, content: content.trim(), files: files ?? [], point_reward: COMMENT_REWARD })
      .select("id")
      .single();

    if (commentErr) return NextResponse.json({ error: commentErr.message }, { status: 500 });

    // 답변자에게 5P 지급
    await adminSupabase.from("points").insert({
      user_id: user.id,
      amount: COMMENT_REWARD,
      reason: "캐드스쿨 답변 등록",
      reference_id: comment.id,
    });
    await adminSupabase.rpc("increment_profile_points", { uid: user.id, delta: COMMENT_REWARD });

    return NextResponse.json({ id: comment.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
