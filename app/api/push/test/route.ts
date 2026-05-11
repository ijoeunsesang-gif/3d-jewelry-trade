import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await serviceSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  // VAPID 환경변수 진단
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || "admin@example.com";
  const clientVapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const debug = {
    VAPID_PUBLIC_KEY: vapidPublic ? "설정됨" : "누락",
    VAPID_PRIVATE_KEY: vapidPrivate ? "설정됨" : "누락",
    VAPID_EMAIL: vapidEmail,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: clientVapid ? "설정됨" : "누락",
    keysMatch: vapidPublic === clientVapid,
  };

  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: "VAPID 키가 설정되지 않았습니다.", debug }, { status: 500 });
  }

  // 구독 목록 확인
  const { data: subs, error: subErr } = await serviceSupabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);

  if (subErr) {
    return NextResponse.json({ error: "구독 조회 실패", detail: subErr.message, debug }, { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({
      error: "등록된 구독이 없습니다. /my/settings에서 먼저 알림을 켜주세요.",
      debug,
    }, { status: 400 });
  }

  // VAPID 설정 (테스트 라우트에서 직접 설정)
  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublic, vapidPrivate);

  const payload = JSON.stringify({
    title: "테스트 알림 🔔",
    body: "푸시 알림이 정상적으로 작동합니다!",
    url: "/notifications",
    icon: "/icon-192.png",
  });

  const results: Array<{ endpoint: string; ok: boolean; error?: string }> = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        results.push({ endpoint: sub.endpoint.slice(0, 40) + "…", ok: true });
      } catch (err: any) {
        results.push({ endpoint: sub.endpoint.slice(0, 40) + "…", ok: false, error: err?.message });
        // 만료된 구독 자동 제거
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await serviceSupabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    })
  );

  const allFailed = results.every((r) => !r.ok);
  return NextResponse.json({
    success: !allFailed,
    subscriptions: subs.length,
    results,
    debug,
  }, { status: allFailed ? 500 : 200 });
}
