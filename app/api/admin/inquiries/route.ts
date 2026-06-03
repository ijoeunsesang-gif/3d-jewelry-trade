import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/isAdminCheck";
import { Resend } from "resend";

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

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { data, error } = await adminSupabase
    .from("inquiries")
    .select("id, user_id, user_email, title, content, status, created_at, inquiry_answers(id, content, created_at)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id, answer } = await req.json();
  if (!id || !answer?.trim()) {
    return NextResponse.json({ error: "id, answer가 필요합니다." }, { status: 400 });
  }

  const { data: inquiry, error: fetchErr } = await adminSupabase
    .from("inquiries")
    .select("user_id, user_email, title, content")
    .eq("id", id)
    .single();

  if (fetchErr || !inquiry) {
    return NextResponse.json({ error: "문의를 찾을 수 없습니다." }, { status: 404 });
  }

  // inquiry_answers 테이블에 답변 추가
  const { data: inserted, error: insertErr } = await adminSupabase
    .from("inquiry_answers")
    .insert({ inquiry_id: id, admin_id: admin.id, content: answer.trim() })
    .select("id, content, created_at")
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // inquiries.status를 answered로 변경
  await adminSupabase.from("inquiries").update({ status: "answered" }).eq("id", id);

  // 문의자에게 답변 알림
  await adminSupabase.from("notifications").insert({
    user_id: inquiry.user_id,
    type: "inquiry",
    title: `문의 답변이 등록되었습니다: ${inquiry.title}`,
    link: "/customer-service",
    is_read: false,
  });

  // 문의자에게 이메일 발송 (실패해도 답변 저장에 영향 없음)
  if (inquiry.user_email) {
    try {
      const fromAddress = process.env.RESEND_FROM_EMAIL;
      if (fromAddress) {
        await resend.emails.send({
          from: `3D Jewelry Trade <${fromAddress}>`,
          to: inquiry.user_email,
          subject: "[주얼리 플랫폼] 문의하신 내용에 답변이 등록되었습니다",
          html: `
            <table width="100%" cellpadding="0" cellspacing="0" style="font-family: system-ui, sans-serif; background: #ffffff;">
              <tr>
                <td style="padding: 32px 24px; color: #111827; max-width: 580px;">
                  <h2 style="font-size: 20px; font-weight: 900; margin: 0 0 8px;">문의 답변 안내</h2>
                  <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px;">안녕하세요. 문의하신 내용에 답변이 등록되었습니다.</p>

                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px;">
                    <tr><td style="padding: 10px 14px; background: #f9fafb; font-size: 13px; font-weight: 700; color: #374151; border-radius: 8px 8px 0 0;">문의 제목</td></tr>
                    <tr><td style="padding: 10px 14px; font-size: 14px; color: #111827;">${inquiry.title}</td></tr>
                  </table>

                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px;">
                    <tr><td style="padding: 10px 14px; background: #f9fafb; font-size: 13px; font-weight: 700; color: #374151; border-radius: 8px 8px 0 0;">문의 내용</td></tr>
                    <tr><td style="padding: 10px 14px; font-size: 14px; color: #374151; white-space: pre-wrap; line-height: 1.6;">${inquiry.content}</td></tr>
                  </table>

                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #bbf7d0; border-radius: 8px; margin-bottom: 24px;">
                    <tr><td style="padding: 10px 14px; background: #f0fdf4; font-size: 13px; font-weight: 700; color: #15803d; border-radius: 8px 8px 0 0;">관리자 답변</td></tr>
                    <tr><td style="padding: 10px 14px; font-size: 14px; color: #111827; white-space: pre-wrap; line-height: 1.6;">${answer.trim()}</td></tr>
                  </table>

                  <p style="font-size: 12px; color: #9ca3af; margin: 0;">본 메일은 3D 주얼리 플랫폼에서 자동 발송된 메일입니다.</p>
                </td>
              </tr>
            </table>
          `,
        });
      }
    } catch (emailErr) {
      console.error("문의 답변 이메일 발송 실패:", emailErr);
    }
  }

  return NextResponse.json({ success: true, answer: inserted });
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { answerId } = await req.json();
  if (!answerId) return NextResponse.json({ error: "answerId가 필요합니다." }, { status: 400 });

  const { error } = await adminSupabase
    .from("inquiry_answers")
    .delete()
    .eq("id", answerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
