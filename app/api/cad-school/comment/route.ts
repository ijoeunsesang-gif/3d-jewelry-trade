import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COMMENT_REWARD = 50;
const DAILY_CAP = 1000;
const MONTHLY_CAP = 10000;

async function getCadEarned(userId: string): Promise<{ daily: number; monthly: number }> {
  const now = new Date();

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data } = await adminSupabase
    .from("points")
    .select("amount, created_at")
    .eq("user_id", userId)
    .gt("amount", 0)
    .ilike("reason", "캐드스쿨%")
    .gte("created_at", monthStart.toISOString());

  const rows = (data ?? []) as { amount: number; created_at: string }[];
  const dayStartTs = dayStart.getTime();

  let daily = 0;
  let monthly = 0;
  for (const r of rows) {
    monthly += r.amount;
    if (new Date(r.created_at).getTime() >= dayStartTs) daily += r.amount;
  }
  return { daily, monthly };
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    const { post_id, content, files, parent_id } = await req.json();
    if (!post_id || !content?.trim()) {
      return NextResponse.json({ error: "게시글 ID와 내용을 입력해주세요." }, { status: 400 });
    }

    const { data: post } = await adminSupabase
      .from("cad_posts")
      .select("id, status, user_id")
      .eq("id", post_id)
      .single();

    if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });

    // 대댓글: 질문자만 작성 가능, 포인트 없음 (채택 후에도 허용)
    if (parent_id) {
      if (user.id !== post.user_id) {
        return NextResponse.json({ error: "대댓글은 질문 작성자만 달 수 있습니다." }, { status: 403 });
      }

      const { data: parentComment } = await adminSupabase
        .from("cad_post_comments")
        .select("id, post_id, parent_id")
        .eq("id", parent_id)
        .single();

      if (!parentComment || parentComment.post_id !== post_id || parentComment.parent_id) {
        return NextResponse.json({ error: "유효하지 않은 부모 댓글입니다." }, { status: 400 });
      }

      const { data: subComment, error: subErr } = await adminSupabase
        .from("cad_post_comments")
        .insert({ post_id, user_id: user.id, content: content.trim(), files: [], parent_id, point_reward: 0 })
        .select("id")
        .single();

      if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
      return NextResponse.json({ id: subComment.id, pointAwarded: 0 });
    }

    // 일반 답변: 본인 질문에 답변 불가
    if (user.id === post.user_id) {
      return NextResponse.json({ error: "본인의 질문에는 답변할 수 없습니다." }, { status: 403 });
    }

    const { data: comment, error: commentErr } = await adminSupabase
      .from("cad_post_comments")
      .insert({ post_id, user_id: user.id, content: content.trim(), files: files ?? [], point_reward: COMMENT_REWARD })
      .select("id")
      .single();

    if (commentErr) return NextResponse.json({ error: commentErr.message }, { status: 500 });

    // 채택 완료(closed) 상태이면 포인트 미지급
    if (post.status !== "open") {
      return NextResponse.json({ id: comment.id, pointAwarded: 0 });
    }

    // 일일·월 한도 확인 후 포인트 지급
    const { daily, monthly } = await getCadEarned(user.id);
    const remainingDaily = Math.max(0, DAILY_CAP - daily);
    const remainingMonthly = Math.max(0, MONTHLY_CAP - monthly);
    const actualReward = Math.min(COMMENT_REWARD, remainingDaily, remainingMonthly);

    if (actualReward > 0) {
      await adminSupabase.from("points").insert({
        user_id: user.id,
        amount: actualReward,
        reason: "캐드스쿨 답변 등록",
        reference_id: comment.id,
      });
      await adminSupabase.rpc("increment_profile_points", { uid: user.id, delta: actualReward });
    }

    return NextResponse.json({ id: comment.id, pointAwarded: actualReward });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
