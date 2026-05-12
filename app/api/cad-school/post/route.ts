import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const QUESTION_COST = 100;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    const { title, content, files } = await req.json();
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "제목과 내용을 입력해주세요." }, { status: 400 });
    }

    // 포인트 잔액 확인
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("points")
      .eq("id", user.id)
      .single();

    if ((profile?.points ?? 0) < QUESTION_COST) {
      return NextResponse.json({ error: `포인트가 부족합니다. (필요: ${QUESTION_COST}P)` }, { status: 400 });
    }

    // 게시글 생성
    const { data: post, error: postErr } = await adminSupabase
      .from("cad_posts")
      .insert({ user_id: user.id, title: title.trim(), content: content.trim(), files: files ?? [] })
      .select("id")
      .single();

    if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });

    // 포인트 차감
    await adminSupabase.from("points").insert({
      user_id: user.id,
      amount: -QUESTION_COST,
      reason: "캐드스쿨 질문 등록",
      reference_id: post.id,
    });
    await adminSupabase.rpc("increment_profile_points", { uid: user.id, delta: -QUESTION_COST });

    return NextResponse.json({ id: post.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
