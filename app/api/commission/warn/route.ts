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

  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").trim().toLowerCase();
  const isAdmin = adminEmail !== "" && (user.email || "").toLowerCase() === adminEmail;
  if (!isAdmin) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  let body: { commission_id?: string; dispute_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "잘못된 요청" }, { status: 400 }); }

  const { commission_id, dispute_id } = body;
  if (!commission_id || !dispute_id) {
    return NextResponse.json({ error: "commission_id와 dispute_id가 필요합니다." }, { status: 400 });
  }

  const { data: commission, error: fetchErr } = await serviceSupabase
    .from("commissions")
    .select("target_seller_id, title")
    .eq("id", commission_id)
    .single();

  if (fetchErr || !commission) return NextResponse.json({ error: "의뢰를 찾을 수 없습니다." }, { status: 404 });
  if (!commission.target_seller_id) return NextResponse.json({ error: "판매자 정보가 없습니다." }, { status: 400 });

  const sellerId = commission.target_seller_id;

  const { data: profile, error: profileErr } = await serviceSupabase
    .from("profiles")
    .select("warning_count, is_seller_banned")
    .eq("id", sellerId)
    .single();

  if (profileErr || !profile) return NextResponse.json({ error: "판매자 프로필을 찾을 수 없습니다." }, { status: 404 });

  const newCount = (profile.warning_count ?? 0) + 1;
  const nowBanned = newCount >= 3;

  const { error: updateErr } = await serviceSupabase
    .from("profiles")
    .update({ warning_count: newCount, ...(nowBanned && { is_seller_banned: true }) })
    .eq("id", sellerId);

  if (updateErr) {
    console.error("[warn] profile update error:", updateErr);
    return NextResponse.json({ error: "경고 처리 실패" }, { status: 500 });
  }

  const notifTitle = nowBanned
    ? `[경고 ${newCount}회] 판매자 활동이 정지되었습니다.`
    : `[경고 ${newCount}회] ${commission.title} 의뢰 관련 경고가 부여되었습니다.`;

  await serviceSupabase.from("notifications").insert({
    user_id: sellerId,
    type: "dispute",
    title: notifTitle,
    link: `/commission/${commission_id}`,
    is_read: false,
  });

  return NextResponse.json({ success: true, warning_count: newCount, is_seller_banned: nowBanned });
}
