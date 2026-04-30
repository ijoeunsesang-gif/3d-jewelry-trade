import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await serviceSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const { data: profile, error: fetchErr } = await serviceSupabase
    .from("profiles")
    .select("is_seller_banned, nickname")
    .eq("id", user.id)
    .single();

  if (fetchErr || !profile) return NextResponse.json({ error: "프로필을 찾을 수 없습니다." }, { status: 404 });
  if (!profile.is_seller_banned) return NextResponse.json({ error: "정지된 계정이 아닙니다." }, { status: 400 });

  const { data: existing } = await serviceSupabase
    .from("seller_reinstate_requests")
    .select("id")
    .eq("seller_id", user.id)
    .eq("status", "대기")
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "이미 재등록 신청 중입니다." }, { status: 400 });

  let body: { reason?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "잘못된 요청" }, { status: 400 }); }

  const reason = (body.reason || "").trim();
  if (!reason) return NextResponse.json({ error: "신청 사유를 입력해주세요." }, { status: 400 });

  const { error: insertErr } = await serviceSupabase
    .from("seller_reinstate_requests")
    .insert({ seller_id: user.id, reason, status: "대기" });

  if (insertErr) {
    console.error("[reinstate-request] insert error:", insertErr);
    return NextResponse.json({ error: "신청 처리 실패" }, { status: 500 });
  }

  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").trim().toLowerCase();
  if (adminEmail) {
    try {
      const { data: { users } } = await serviceSupabase.auth.admin.listUsers();
      const adminUser = users.find((u) => u.email?.toLowerCase() === adminEmail);
      if (adminUser) {
        await serviceSupabase.from("notifications").insert({
          user_id: adminUser.id,
          type: "reinstate_request",
          title: `판매자 재등록 신청: ${profile.nickname || user.id}`,
          link: `/admin?reinstate=${user.id}`,
          is_read: false,
        });
      }
    } catch (e) {
      console.error("[reinstate-request] admin notify error:", e);
    }
  }

  return NextResponse.json({ success: true });
}
