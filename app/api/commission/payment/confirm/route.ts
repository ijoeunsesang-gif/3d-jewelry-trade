import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // 1. 인증
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { data: { user }, error: authErr } = await serviceSupabase.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  // 2. 요청 파싱
  let body: { paymentKey?: string; orderId?: string; amount?: number; commissionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  const { paymentKey, orderId, amount, commissionId } = body;
  if (!paymentKey || !orderId || typeof amount !== "number" || !commissionId) {
    return NextResponse.json({ error: "paymentKey, orderId, amount, commissionId가 필요합니다." }, { status: 400 });
  }

  // 3. 토스페이먼츠 결제 승인
  const secretKey = process.env.TOSSPAYMENTS_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "서버 설정 오류입니다." }, { status: 500 });
  }
  const tossAuth = Buffer.from(`${secretKey}:`).toString("base64");
  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${tossAuth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const tossData = await tossRes.json();
  if (!tossRes.ok) {
    console.error("[commission/payment/confirm] Toss 승인 실패:", tossData);
    return NextResponse.json(
      { error: tossData.message || "결제 승인에 실패했습니다." },
      { status: 400 }
    );
  }

  // 4. 의뢰 조회 및 소유권 확인
  const { data: commission, error: fetchErr } = await serviceSupabase
    .from("commissions")
    .select("id, user_id, target_seller_id, status")
    .eq("id", commissionId)
    .single();

  if (fetchErr || !commission) {
    return NextResponse.json({ error: "의뢰를 찾을 수 없습니다." }, { status: 404 });
  }
  if (commission.user_id !== user.id) {
    return NextResponse.json({ error: "결제 권한이 없습니다." }, { status: 403 });
  }
  if (commission.status !== "payment") {
    return NextResponse.json({ error: "결제 가능한 상태가 아닙니다." }, { status: 400 });
  }

  // 5. 커미션 상태 → working 업데이트
  const { error: updateErr } = await serviceSupabase
    .from("commissions")
    .update({ status: "working" })
    .eq("id", commissionId);

  if (updateErr) {
    console.error("[commission/payment/confirm] 상태 업데이트 실패:", updateErr);
    return NextResponse.json({ error: "의뢰 상태 업데이트 실패" }, { status: 500 });
  }

  // 6. 알림 발송
  const notifications: object[] = [];
  if (commission.target_seller_id) {
    notifications.push({
      user_id: commission.target_seller_id,
      type: "negotiation",
      title: "결제 완료",
      link: `/commission/${commissionId}`,
      is_read: false,
    });
  }
  notifications.push({
    user_id: commission.user_id,
    type: "negotiation",
    title: "작업 시작",
    link: `/commission/${commissionId}`,
    is_read: false,
  });
  const { error: notifErr } = await serviceSupabase.from("notifications").insert(notifications);
  if (notifErr) {
    console.error("[commission/payment/confirm] 알림 발송 실패:", notifErr);
  }

  return NextResponse.json({ success: true });
}
