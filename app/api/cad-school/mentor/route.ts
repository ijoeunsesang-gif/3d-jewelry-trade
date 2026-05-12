import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    // 판매자 여부 확인 (판매자 또는 관리자만 멘토 등록 가능)
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role ?? "buyer";
    if (role !== "seller" && role !== "admin") {
      return NextResponse.json({ error: "판매자로 등록된 회원만 멘토 등록이 가능합니다." }, { status: 403 });
    }

    // 이미 등록된 멘토인지 확인
    const { data: existing } = await adminSupabase
      .from("cad_mentors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const { intro, per_session_price, package_5_price, package_10_price, daily_limit } = await req.json();

    if (existing) {
      await adminSupabase
        .from("cad_mentors")
        .update({ intro: intro ?? "", per_session_price: per_session_price ?? 0, package_5_price: package_5_price ?? 0, package_10_price: package_10_price ?? 0, daily_limit: daily_limit ?? 2, is_active: true })
        .eq("user_id", user.id);
      return NextResponse.json({ ok: true, updated: true });
    }

    const { error: insertErr } = await adminSupabase
      .from("cad_mentors")
      .insert({ user_id: user.id, intro: intro ?? "", per_session_price: per_session_price ?? 0, package_5_price: package_5_price ?? 0, package_10_price: package_10_price ?? 0, daily_limit: daily_limit ?? 2 });

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    const { is_active } = await req.json();
    const { error } = await adminSupabase.from("cad_mentors").update({ is_active }).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
