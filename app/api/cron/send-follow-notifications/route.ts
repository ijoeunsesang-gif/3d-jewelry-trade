import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.3d-jewelry-trade.com";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 미발송 레코드 조회
    const { data: pending, error } = await adminSupabase
      .from("pending_email_notifications")
      .select("id, user_id, seller_id, seller_name, model_id, model_name, model_image")
      .is("sent_at", null)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!pending?.length) return NextResponse.json({ ok: true, sent: 0 });

    // 유저 이메일 조회
    const userIds = [...new Set(pending.map((p: any) => p.user_id))];
    const { data: profiles } = await adminSupabase
      .from("profiles")
      .select("id, email, nickname")
      .in("id", userIds);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    // 유저별 그룹핑
    const grouped = new Map<string, typeof pending>();
    for (const p of pending) {
      if (!grouped.has(p.user_id)) grouped.set(p.user_id, []);
      grouped.get(p.user_id)!.push(p);
    }

    const from = process.env.RESEND_FROM_EMAIL;
    if (!from) return NextResponse.json({ error: "RESEND_FROM_EMAIL 미설정" }, { status: 500 });

    let sentCount = 0;
    const sentIds: string[] = [];

    for (const [userId, items] of grouped.entries()) {
      const profile = profileMap.get(userId);
      if (!profile?.email) continue;

      // 판매자별로 묶기
      const sellerGroups = new Map<string, typeof items>();
      for (const item of items) {
        if (!sellerGroups.has(item.seller_id)) sellerGroups.set(item.seller_id, []);
        sellerGroups.get(item.seller_id)!.push(item);
      }

      const sellerSectionsHtml = Array.from(sellerGroups.values()).map((sellerItems) => {
        const sellerName = sellerItems[0].seller_name;
        const modelsHtml = sellerItems.map((item: any) => `
          <tr>
            <td style="padding: 8px 14px; vertical-align: middle;">
              ${item.model_image
                ? `<img src="${item.model_image}" alt="${item.model_name}" width="56" height="56" style="border-radius:8px;object-fit:cover;vertical-align:middle;margin-right:10px;">`
                : ""
              }
              <a href="${APP_URL}/models/${item.model_id}" style="color:#c9a84c;font-weight:700;font-size:14px;text-decoration:none;">${item.model_name}</a>
            </td>
          </tr>
        `).join("");

        return `
          <div style="margin-bottom:20px;">
            <div style="font-size:14px;font-weight:800;color:#374151;padding:8px 14px;background:#f9fafb;border-radius:8px;margin-bottom:6px;">
              ${sellerName}
            </div>
            <table width="100%" cellpadding="0" cellspacing="0">${modelsHtml}</table>
          </div>
        `;
      }).join("");

      const html = `
        <table width="100%" cellpadding="0" cellspacing="0" style="font-family:system-ui,sans-serif;background:#ffffff;">
          <tr>
            <td style="padding:32px 24px;max-width:580px;color:#111827;">
              <h2 style="font-size:20px;font-weight:900;margin:0 0 8px;">새 작품 알림</h2>
              <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">팔로우하신 판매자가 새 작품을 업로드했습니다.</p>
              ${sellerSectionsHtml}
              <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;">
                알림을 받지 않으려면
                <a href="${APP_URL}/my/settings" style="color:#9ca3af;">알림 설정</a>에서 끌 수 있습니다.
              </p>
            </td>
          </tr>
        </table>
      `;

      const { error: emailErr } = await resend.emails.send({
        from: `3D Jewelry Trade <${from}>`,
        to: profile.email,
        subject: "[주얼리 플랫폼] 팔로우한 판매자의 새 작품이 올라왔어요!",
        html,
      });

      if (emailErr) {
        console.error(`[cron-follow] 이메일 실패 (${userId}):`, emailErr);
      } else {
        sentCount++;
        sentIds.push(...items.map((i: any) => i.id));
      }
    }

    if (sentIds.length > 0) {
      await adminSupabase
        .from("pending_email_notifications")
        .update({ sent_at: new Date().toISOString() })
        .in("id", sentIds);
    }

    return NextResponse.json({ ok: true, sent: sentCount });
  } catch (err) {
    console.error("[cron-follow] 오류:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
