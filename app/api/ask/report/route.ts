import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REPORT_THRESHOLD = 3;

// ask_reports 등록 자체는 누구나 할 수 있지만, 누적 3회를 넘겨 답변 작성자의
// 포인트를 회수하고 profiles.is_point_blocked를 세우는 것은 "본인이 아닌 남의
// 비공개 컬럼을 수정"하는 작업이라 서버(service_role)에서 처리한다.
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const { answerId, reason } = await req.json();
  if (!answerId || !reason) return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });

  const { error: insertErr } = await adminSupabase.from("ask_reports").insert({
    answer_id: answerId,
    reporter_id: user.id,
    reason,
  });
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  const { data: answer } = await adminSupabase
    .from("ask_answers")
    .select("id, user_id, report_count")
    .eq("id", answerId)
    .single();
  if (!answer) return NextResponse.json({ ok: true });

  if ((answer.report_count ?? 0) >= REPORT_THRESHOLD) {
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("is_point_blocked")
      .eq("id", answer.user_id)
      .single();

    // 이미 차단 처리된 경우 중복으로 포인트를 재회수하지 않는다.
    if (!profile?.is_point_blocked) {
      const { data: earnedRows } = await adminSupabase
        .from("points")
        .select("amount")
        .eq("user_id", answer.user_id)
        .eq("reference_id", answerId)
        .gt("amount", 0);
      const earnedTotal = (earnedRows || []).reduce((s: number, r: any) => s + r.amount, 0);
      if (earnedTotal > 0) {
        await adminSupabase.from("points").insert({
          user_id: answer.user_id,
          amount: -earnedTotal,
          reason: "신고 누적 포인트 회수",
          reference_id: answerId,
        });
        await adminSupabase.rpc("increment_profile_points", { uid: answer.user_id, delta: -earnedTotal });
      }
      await adminSupabase.from("profiles").update({ is_point_blocked: true }).eq("id", answer.user_id);
    }
  }

  return NextResponse.json({ ok: true });
}
