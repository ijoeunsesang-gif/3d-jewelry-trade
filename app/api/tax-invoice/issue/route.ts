import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { buildTaxInvoiceIssuedHtml } from "@/lib/emails/tax-invoice-issued";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const { data: { user }, error: authErr } = await serviceSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const { data: reqRow, error: fetchErr } = await serviceSupabase
    .from("tax_invoice_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !reqRow) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (reqRow.seller_id !== user.id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  if (reqRow.status === "issued") return NextResponse.json({ error: "이미 발행 완료된 요청입니다." }, { status: 409 });

  const now = new Date().toISOString();
  const { error: updateErr } = await serviceSupabase
    .from("tax_invoice_requests")
    .update({ status: "issued", issued_at: now })
    .eq("id", id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  await serviceSupabase.from("notifications").insert({
    user_id: reqRow.buyer_id,
    type: "system",
    title: `세금계산서 발행이 완료되었습니다: ${reqRow.business_name}`,
    link: "/library",
    is_read: false,
  });

  try {
    const { data: buyer } = await serviceSupabase.from("profiles").select("email").eq("id", reqRow.buyer_id).single();
    const fromAddress = process.env.RESEND_FROM_EMAIL;
    if (fromAddress && buyer?.email) {
      await resend.emails.send({
        from: `3D Jewelry Trade <${fromAddress}>`,
        to: buyer.email,
        subject: "[3D 주얼리 트레이드] 세금계산서 발행이 완료되었습니다",
        html: buildTaxInvoiceIssuedHtml({
          businessName: reqRow.business_name,
          supplyAmount: reqRow.supply_amount,
          vatAmount: reqRow.vat_amount,
          issuedDate: new Date(now).toLocaleDateString("ko-KR"),
        }),
      });
    }
  } catch (emailErr) {
    console.error("세금계산서 발행완료 이메일 발송 실패:", emailErr);
  }

  return NextResponse.json({ success: true });
}
