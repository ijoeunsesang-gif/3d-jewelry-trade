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

  let body: { seller_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "잘못된 요청" }, { status: 400 }); }

  const { seller_id } = body;
  if (!seller_id) return NextResponse.json({ error: "seller_id가 필요합니다." }, { status: 400 });

  const { error: updateErr } = await serviceSupabase
    .from("profiles")
    .update({ is_seller_banned: false, reinstate_requested: false, warning_count: 0 })
    .eq("id", seller_id);

  if (updateErr) {
    console.error("[reinstate-approve] update error:", updateErr);
    return NextResponse.json({ error: "승인 처리 실패" }, { status: 500 });
  }

  await serviceSupabase.from("notifications").insert({
    user_id: seller_id,
    type: "reinstate_request",
    title: "판매자 활동 정지가 해제되었습니다. 다시 활동을 시작할 수 있습니다.",
    link: "/profile?tab=seller",
    is_read: false,
  });

  return NextResponse.json({ success: true });
}
