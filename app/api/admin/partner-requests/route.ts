import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/isAdminCheck";
import { Resend } from "resend";
import { buildPartnerApprovedHtml } from "@/lib/emails/partner-request-approved";
import { buildPartnerRejectedHtml } from "@/lib/emails/partner-request-rejected";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) return null;
  if (!(await isAdminUser(adminSupabase, user.id))) return null;
  return user;
}

// 업체 분류 → DB 테이블 매핑
const CATEGORY_TABLE_MAP: Record<string, string> = {
  "출력소":       "print_shops",
  "원본":         "finishing_workers",
  "생산공장":     "factories",
  "도금":         "partners",
  "고무몰드":     "partners",
  "레이저 각인":  "partners",
  "주조":         "partners",
  "조각":         "partners",
};

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id, action, reject_reason } = await req.json();

  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action은 approve 또는 reject 이어야 합니다." }, { status: 400 });
  }
  if (action === "reject" && !reject_reason?.trim()) {
    return NextResponse.json({ error: "거절 사유를 입력하세요." }, { status: 400 });
  }

  // 신청 정보 조회
  const { data: request, error: fetchErr } = await adminSupabase
    .from("partner_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !request) {
    return NextResponse.json({ error: "신청을 찾을 수 없습니다." }, { status: 404 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: "이미 처리된 신청입니다." }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (action === "approve") {
    // 1. 상태 업데이트
    const { error: updateErr } = await adminSupabase
      .from("partner_requests")
      .update({ status: "approved", processed_at: now })
      .eq("id", id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // 2. 해당 업체 분류 테이블에 자동 등록
    const table = CATEGORY_TABLE_MAP[request.category];
    if (table) {
      let payload: Record<string, unknown> = { is_active: true };
      if (table === "print_shops") {
        payload = { name: request.name, phone: request.contact, address: request.address, description: request.description, is_active: true };
      } else if (table === "finishing_workers") {
        payload = { name: request.name, email: request.user_email, phone: request.contact, location: request.address, description: request.description, work_scope: [], is_active: true };
      } else if (table === "factories") {
        payload = { name: request.name, phone: request.contact, address: request.address, description: request.description, is_active: true };
      } else {
        payload = { category: request.category, name: request.name, phone: request.contact, address: request.address, description: request.description, is_active: true };
      }
      await adminSupabase.from(table).insert(payload);
    }

    // 3. 신청자 알림
    await adminSupabase.from("notifications").insert({
      user_id: request.user_id,
      type: "inquiry",
      title: `업체등록 신청이 승인되었습니다: ${request.name}`,
      link: "/partner",
      is_read: false,
    });

    // 4. 승인 이메일 발송
    try {
      const fromAddress = process.env.RESEND_FROM_EMAIL;
      if (fromAddress && request.user_email) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://3d-jewelry-trade.com";
        await resend.emails.send({
          from: `3D Jewelry Trade <${fromAddress}>`,
          to: request.user_email,
          subject: "[3D 주얼리 트레이드] 업체등록 신청이 승인되었습니다",
          html: buildPartnerApprovedHtml({
            businessName: request.name,
            category: request.category,
            partnerPageUrl: `${siteUrl}/partner`,
          }),
        });
      }
    } catch (emailErr) {
      console.error("업체등록 승인 이메일 발송 실패:", emailErr);
    }

  } else {
    // reject
    const { error: updateErr } = await adminSupabase
      .from("partner_requests")
      .update({ status: "rejected", reject_reason: reject_reason.trim(), processed_at: now })
      .eq("id", id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // 신청자 알림
    await adminSupabase.from("notifications").insert({
      user_id: request.user_id,
      type: "inquiry",
      title: `업체등록 신청이 반려되었습니다: ${request.name}`,
      link: "/customer-service",
      is_read: false,
    });

    // 거절 이메일 발송
    try {
      const fromAddress = process.env.RESEND_FROM_EMAIL;
      if (fromAddress && request.user_email) {
        await resend.emails.send({
          from: `3D Jewelry Trade <${fromAddress}>`,
          to: request.user_email,
          subject: "[3D 주얼리 트레이드] 업체등록 신청이 반려되었습니다",
          html: buildPartnerRejectedHtml({
            businessName: request.name,
            category: request.category,
            rejectReason: reject_reason.trim(),
          }),
        });
      }
    } catch (emailErr) {
      console.error("업체등록 거절 이메일 발송 실패:", emailErr);
    }
  }

  return NextResponse.json({ success: true });
}
