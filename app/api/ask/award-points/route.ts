import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DAILY_POINT_LIMIT = 100;
const MIN_ANSWER_LENGTH = 20;

// "답변 좋아요"/"답변 채택" 포인트 지급을 서버(service_role)에서 처리한다.
// - is_point_blocked는 profiles의 비공개 컬럼이라 클라이언트에서는 타인 행을 조회할 수 없다
//   (profiles RLS 잠금 이후 항상 빈 값이 되어 차단 유저에게도 포인트가 지급되는 우회가 생김).
// - amount/reason을 클라이언트가 그대로 넘기게 하면 임의로 포인트를 받아갈 수 있으므로,
//   action별로 서버에서 지급 대상·금액·사유를 직접 검증/결정한다.
async function tryAddPoints(userId: string, amount: number, reason: string, referenceId: string) {
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("is_point_blocked")
    .eq("id", userId)
    .single();
  if (profile?.is_point_blocked) return false;

  const { data: todayRows } = await adminSupabase
    .from("points")
    .select("amount")
    .eq("user_id", userId)
    .in("reason", ["답변 등록", "답변 좋아요", "답변 채택"])
    .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  const todayTotal = (todayRows || []).reduce((s: number, r: any) => s + (r.amount > 0 ? r.amount : 0), 0);
  if (todayTotal >= DAILY_POINT_LIMIT) return false;

  await adminSupabase.from("points").insert({ user_id: userId, amount, reason, reference_id: referenceId });
  await adminSupabase.rpc("increment_profile_points", { uid: userId, delta: amount });
  return true;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const { action, answerId } = await req.json();
  if (!answerId || (action !== "like" && action !== "accept" && action !== "register")) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { data: answer } = await adminSupabase
    .from("ask_answers")
    .select("id, post_id, user_id, content")
    .eq("id", answerId)
    .single();
  if (!answer) return NextResponse.json({ error: "답변을 찾을 수 없습니다." }, { status: 404 });

  if (action === "register") {
    // 본인이 작성한 답변에 대한 최초 등록 보너스 (조건은 서버에서 다시 검증)
    if (answer.user_id !== user.id) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const { data: post } = await adminSupabase
      .from("ask_posts")
      .select("id, user_id, is_solved")
      .eq("id", answer.post_id)
      .single();
    if (!post) return NextResponse.json({ error: "질문을 찾을 수 없습니다." }, { status: 404 });

    const meetsLength = (answer.content ?? "").trim().length >= MIN_ANSWER_LENGTH;
    const isSelfAnswer = post.user_id === user.id;
    if (!meetsLength || post.is_solved || isSelfAnswer) {
      return NextResponse.json({ awarded: false });
    }

    // 이 질문글에 내가 단 다른 답변으로 이미 "답변 등록" 포인트를 받았는지 확인
    const { data: myAnswers } = await adminSupabase
      .from("ask_answers")
      .select("id")
      .eq("post_id", answer.post_id)
      .eq("user_id", user.id);
    const myAnswerIds = (myAnswers ?? []).map((a: any) => a.id);
    const { data: earned } = myAnswerIds.length > 0
      ? await adminSupabase.from("points").select("id").eq("user_id", user.id).eq("reason", "답변 등록").in("reference_id", myAnswerIds).limit(1)
      : { data: [] as { id: string }[] };
    if ((earned ?? []).length > 0) return NextResponse.json({ awarded: false });

    const awarded = await tryAddPoints(user.id, 5, "답변 등록", answerId);
    return NextResponse.json({ awarded });
  }

  if (action === "like") {
    // 방금 내가 좋아요를 눌렀는지 확인 (클라이언트가 임의로 호출하는 것을 방지)
    const { data: likeRow } = await adminSupabase
      .from("ask_answer_likes")
      .select("answer_id")
      .eq("answer_id", answerId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!likeRow) return NextResponse.json({ error: "좋아요 내역을 찾을 수 없습니다." }, { status: 403 });

    const awarded = await tryAddPoints(answer.user_id, 2, "답변 좋아요", answerId);
    return NextResponse.json({ awarded });
  }

  // action === "accept": 내가 이 답변이 달린 질문글의 작성자인지 확인
  const { data: post } = await adminSupabase
    .from("ask_posts")
    .select("id, user_id")
    .eq("id", answer.post_id)
    .single();
  if (!post || post.user_id !== user.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const awarded = await tryAddPoints(answer.user_id, 20, "답변 채택", answerId);
  return NextResponse.json({ awarded });
}
