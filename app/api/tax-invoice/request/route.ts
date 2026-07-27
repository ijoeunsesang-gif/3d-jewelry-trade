import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { buildTaxInvoiceRequestedHtml } from "@/lib/emails/tax-invoice-requested";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

type RequestBody = {
  type?: "purchase" | "commission";
  orderItemId?: string;
  commissionId?: string;
  businessName?: string;
  businessNumber?: string;
  ceoName?: string;
  businessAddress?: string;
  email?: string;
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const { data: { user }, error: authErr } = await serviceSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const { type, orderItemId, commissionId, businessName, businessNumber, ceoName, businessAddress, email } = body;

  if (!type || (type !== "purchase" && type !== "commission")) {
    return NextResponse.json({ error: "type은 purchase 또는 commission 이어야 합니다." }, { status: 400 });
  }
  if (!businessName?.trim() || !businessNumber?.trim() || !ceoName?.trim() || !businessAddress?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "사업자 정보를 모두 입력해주세요." }, { status: 400 });
  }

  // 1. 대상 order_item 조회 (일반구매: 전달받은 id / 개인의뢰: order_code로 역추적)
  let orderItem: { id: string; order_id: string; seller_id: string | null; tax_invoice_requested: boolean; supply_amount: number | null; vat_amount: number | null } | null = null;

  if (type === "purchase") {
    if (!orderItemId) return NextResponse.json({ error: "orderItemId가 필요합니다." }, { status: 400 });
    const { data: item } = await serviceSupabase
      .from("order_items")
      .select("id, order_id, seller_id, tax_invoice_requested, supply_amount, vat_amount, orders!inner(buyer_id)")
      .eq("id", orderItemId)
      .single();
    if (!item || (item as any).orders?.buyer_id !== user.id) {
      return NextResponse.json({ error: "주문 항목을 찾을 수 없습니다." }, { status: 404 });
    }
    orderItem = item as any;
  } else {
    if (!commissionId) return NextResponse.json({ error: "commissionId가 필요합니다." }, { status: 400 });
    const { data: order } = await serviceSupabase
      .from("orders")
      .select("id")
      .ilike("order_code", `commission-${commissionId}-%`)
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!order) return NextResponse.json({ error: "결제 내역을 찾을 수 없습니다." }, { status: 404 });
    const { data: item } = await serviceSupabase
      .from("order_items")
      .select("id, order_id, seller_id, tax_invoice_requested, supply_amount, vat_amount")
      .eq("order_id", order.id)
      .maybeSingle();
    if (!item) return NextResponse.json({ error: "주문 항목을 찾을 수 없습니다." }, { status: 404 });
    orderItem = item;
  }

  if (!orderItem || !orderItem.tax_invoice_requested || orderItem.supply_amount == null || orderItem.vat_amount == null) {
    return NextResponse.json({ error: "세금계산서 옵션으로 결제된 건이 아닙니다." }, { status: 400 });
  }
  if (!orderItem.seller_id) {
    return NextResponse.json({ error: "판매자 정보를 확인할 수 없습니다." }, { status: 400 });
  }

  // 2. 중복 요청 방지
  const { data: existing } = await serviceSupabase
    .from("tax_invoice_requests")
    .select("id")
    .eq("order_item_id", orderItem.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "이미 세금계산서를 요청한 건입니다." }, { status: 409 });
  }

  // 3. 요청 생성
  const { error: insertErr } = await serviceSupabase.from("tax_invoice_requests").insert({
    order_item_id: type === "purchase" ? orderItem.id : null,
    commission_id: type === "commission" ? commissionId : null,
    buyer_id: user.id,
    seller_id: orderItem.seller_id,
    business_name: businessName.trim(),
    business_number: businessNumber.trim(),
    ceo_name: ceoName.trim(),
    business_address: businessAddress.trim(),
    email: email.trim(),
    supply_amount: orderItem.supply_amount,
    vat_amount: orderItem.vat_amount,
    status: "pending",
  });
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // 4. 구매자 사업자 정보 자동입력용 프로필 저장
  await serviceSupabase.from("profiles").update({
    buyer_business_name: businessName.trim(),
    buyer_business_number: businessNumber.trim(),
    buyer_ceo_name: ceoName.trim(),
    buyer_business_address: businessAddress.trim(),
    buyer_tax_email: email.trim(),
  }).eq("id", user.id);

  // 5. 판매자 알림 + 이메일
  await serviceSupabase.from("notifications").insert({
    user_id: orderItem.seller_id,
    type: "system",
    title: `세금계산서 발행 요청이 접수되었습니다: ${businessName.trim()}`,
    link: "/profile?tab=taxInvoices",
    is_read: false,
  });

  try {
    const { data: seller } = await serviceSupabase.from("profiles").select("email").eq("id", orderItem.seller_id).single();
    const fromAddress = process.env.RESEND_FROM_EMAIL;
    if (fromAddress && seller?.email) {
      await resend.emails.send({
        from: `3D Jewelry Trade <${fromAddress}>`,
        to: seller.email,
        subject: "[3D 주얼리 트레이드] 세금계산서 발행 요청이 접수되었습니다",
        html: buildTaxInvoiceRequestedHtml({
          businessName: businessName.trim(),
          businessNumber: businessNumber.trim(),
          ceoName: ceoName.trim(),
          businessAddress: businessAddress.trim(),
          email: email.trim(),
          supplyAmount: orderItem.supply_amount,
          vatAmount: orderItem.vat_amount,
          managePageUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://3d-jewelry-trade.com"}/profile?tab=taxInvoices`,
        }),
      });
    }
  } catch (emailErr) {
    console.error("세금계산서 요청 이메일 발송 실패:", emailErr);
  }

  return NextResponse.json({ success: true });
}
