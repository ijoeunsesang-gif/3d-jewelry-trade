import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/isAdminCheck";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) return null;
  if (!(await isAdminUser(adminSupabase, user.id))) return null;
  return user;
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { data: answers, error } = await adminSupabase
    .from("ask_answers")
    .select("id, post_id, user_id, content, report_count, created_at")
    .gt("report_count", 0)
    .order("report_count", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!answers || answers.length === 0) return NextResponse.json({ data: [] });

  const postIds    = [...new Set(answers.map((a: any) => a.post_id))];
  const userIds    = [...new Set(answers.map((a: any) => a.user_id))];
  const answerIds  = answers.map((a: any) => a.id);

  const [
    { data: posts },
    { data: profiles },
    { data: reports },
  ] = await Promise.all([
    adminSupabase.from("ask_posts").select("id, title").in("id", postIds),
    adminSupabase.from("profiles").select("id, nickname").in("id", userIds),
    adminSupabase.from("ask_reports").select("answer_id, reason").in("answer_id", answerIds),
  ]);

  const postMap: Record<string, string> = {};
  (posts || []).forEach((p: any) => { postMap[p.id] = p.title; });

  const profileMap: Record<string, string> = {};
  (profiles || []).forEach((p: any) => { profileMap[p.id] = p.nickname || "익명"; });

  const reasonsMap: Record<string, string[]> = {};
  (reports || []).forEach((r: any) => {
    if (!reasonsMap[r.answer_id]) reasonsMap[r.answer_id] = [];
    reasonsMap[r.answer_id].push(r.reason);
  });

  const data = answers.map((a: any) => ({
    ...a,
    post_title: postMap[a.post_id]  || "제목 없음",
    nickname:   profileMap[a.user_id] || "익명",
    reasons:    reasonsMap[a.id]    || [],
  }));

  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const answerId = req.nextUrl.searchParams.get("answerId");
  if (!answerId) return NextResponse.json({ error: "answerId 필요" }, { status: 400 });

  const { data: answer } = await adminSupabase
    .from("ask_answers")
    .select("id, user_id, post_id")
    .eq("id", answerId)
    .single();

  if (!answer) return NextResponse.json({ error: "답변을 찾을 수 없습니다." }, { status: 404 });

  const { error } = await adminSupabase
    .from("ask_answers")
    .delete()
    .eq("id", answerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, userId: answer.user_id });
}
