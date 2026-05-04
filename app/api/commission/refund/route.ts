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

  let body: { commission_id?: string; dispute_id?: string; refundRate?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "잘못된 요청" }, { status: 400 }); }

  const { commission_id, dispute_id } = body;
  const refundRate = typeof body.refundRate === "number" && body.refundRate > 0 && body.refundRate <= 100 ? body.refundRate : 100;

  if (!commission_id || !dispute_id) {
    return NextResponse.json({ error: "commission_id와 dispute_id가 필요합니다." }, { status: 400 });
  }

  const { data: commission, error: fetchErr } = await serviceSupabase
    .from("commissions")
    .select("payment_key, user_id, final_price, title")
    .eq("id", commission_id)
    .single();

  if (fetchErr || !commission) return NextResponse.json({ error: "의뢰를 찾을 수 없습니다." }, { status: 404 });
  if (!commission.payment_key) return NextResponse.json({ error: "결제 정보가 없습니다. payment_key가 저장되지 않았습니다." }, { status: 400 });

  const secretKey = process.env.TOSSPAYMENTS_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });

  const cancelBody: Record<string, unknown> = { cancelReason: `관리자 환불 처리 (${refundRate}%)` };
  if (refundRate < 100 && commission.final_price) {
    cancelBody.cancelAmount = Math.floor(commission.final_price * refundRate / 100);
  }

  const tossAuth = Buffer.from(`${secretKey}:`).toString("base64");
  const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${commission.payment_key}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${tossAuth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cancelBody),
  });
  const tossData = await tossRes.json();

  let alreadyCancelled = false;
  if (!tossRes.ok) {
    // 이미 취소된 결제는 dispute 상태만 완료 처리
    if (tossData?.code === "ALREADY_CANCELED_PAYMENT") {
      alreadyCancelled = true;
    } else {
      console.error("[refund] Toss 취소 실패:", tossData);
      return NextResponse.json({ error: tossData.message || "환불 처리에 실패했습니다." }, { status: 400 });
    }
  }

  await serviceSupabase
    .from("commission_disputes")
    .update({ status: "완료" })
    .eq("id", dispute_id);

  await serviceSupabase
    .from("commissions")
    .update({ status: "cancelled", cancellation_reason: "문제 신고로 인한 환불 처리" })
    .eq("id", commission_id);

  await serviceSupabase.from("notifications").insert({
    user_id: commission.user_id,
    type: "negotiation",
    title: `🔄 ${commission.title} - 환불 처리가 완료되었습니다`,
    link: `/commission/${commission_id}`,
    is_read: false,
  });

  return NextResponse.json({
    success: true,
    ...(alreadyCancelled && { message: "이미 환불 처리된 결제입니다. 신고 상태만 완료로 변경합니다." }),
  });
}
