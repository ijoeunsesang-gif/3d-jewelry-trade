import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/webpush";

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
  let body: { paymentKey?: string; orderId?: string; amount?: number; commissionId?: string; taxInvoice?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  const { paymentKey, orderId, amount, commissionId, taxInvoice } = body;
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
    .select("id, user_id, target_seller_id, status, title, final_price")
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

  // 4.4. 세금계산서 옵션 검증 — 부가세 10%는 서버에서 재계산 (클라이언트 값 신뢰하지 않음)
  const supplyAmount = commission.final_price ?? 0;
  const vatAmount = taxInvoice ? Math.round(supplyAmount * 0.1) : 0;
  if (amount !== supplyAmount + vatAmount) {
    return NextResponse.json({ error: "결제 금액이 협의금액과 일치하지 않습니다." }, { status: 400 });
  }

  // 4.5. 주문(orders) + 주문 항목(order_items) 기록
  //      개인 의뢰는 특정 모델에 연결되지 않으므로 model_id는 null.
  //      실패해도 결제 처리는 계속 진행 (에러만 로깅)
  try {
    const { data: orderRow, error: orderErr } = await serviceSupabase
      .from("orders")
      .insert({
        order_code: orderId,
        buyer_id: commission.user_id,
        payment_key: paymentKey,
        total_amount: amount,
        status: "paid",
      })
      .select("id")
      .single();

    if (orderErr) {
      console.error("[commission/payment/confirm] 주문 기록 실패:", orderErr);
    } else {
      const { error: itemErr } = await serviceSupabase.from("order_items").insert({
        order_id: orderRow.id,
        model_id: null,
        seller_id: commission.target_seller_id ?? null,
        price: amount,
        tax_invoice_requested: !!taxInvoice,
        supply_amount: taxInvoice ? supplyAmount : null,
        vat_amount: taxInvoice ? vatAmount : null,
      });
      if (itemErr) console.error("[commission/payment/confirm] 주문 항목 기록 실패:", itemErr);
    }
  } catch (e) {
    console.error("[commission/payment/confirm] 주문 기록 중 오류:", e);
  }

  // 5. 커미션 상태 → working 업데이트 (paid_at: 실제 결제 승인 시점, 정산 월 필터 기준일)
  const { error: updateErr } = await serviceSupabase
    .from("commissions")
    .update({ status: "working", payment_key: paymentKey, paid_at: new Date().toISOString() })
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
      title: `[개인의뢰] ${commission.title} - 결제가 완료되었습니다.`,
      link: `/commission/${commissionId}`,
      is_read: false,
    });
  }
  notifications.push({
    user_id: commission.user_id,
    type: "negotiation",
    title: `[개인의뢰] ${commission.title} - 작업이 시작되었습니다.`,
    link: `/commission/${commissionId}`,
    is_read: false,
  });
  const { error: notifErr } = await serviceSupabase.from("notifications").insert(notifications);
  if (notifErr) {
    console.error("[commission/payment/confirm] 알림 발송 실패:", notifErr);
  }

  // 푸시 알림 (fire-and-forget)
  const pushLink = `/commission/${commissionId}`;
  if (commission.target_seller_id) {
    sendPushToUser(commission.target_seller_id, "payment", {
      title: `[개인의뢰] ${commission.title}`,
      body: "결제가 완료되었습니다.",
      url: pushLink,
    }).catch((e) => console.error("[payment/confirm] push error:", e));
  }
  sendPushToUser(commission.user_id, "payment", {
    title: `[개인의뢰] ${commission.title}`,
    body: "작업이 시작되었습니다.",
    url: pushLink,
  }).catch((e) => console.error("[payment/confirm] push error:", e));

  return NextResponse.json({ success: true });
}
