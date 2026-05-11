import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || "admin@example.com"}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn("[webpush] VAPID_PUBLIC_KEY 또는 VAPID_PRIVATE_KEY 환경변수가 설정되지 않았습니다. 푸시 알림이 작동하지 않습니다.");
}

export type PushCategory = "inquiry" | "chat" | "payment" | "wishlist" | "notice";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
};

export async function sendPushToUser(
  userId: string,
  category: PushCategory,
  payload: PushPayload
): Promise<void> {
  try {
    // 카테고리별 수신 설정 확인
    type SettingsRow = {
      push_inquiry: boolean;
      push_chat: boolean;
      push_payment: boolean;
      push_wishlist: boolean;
      push_notice: boolean;
    };
    const columnMap: Record<PushCategory, keyof SettingsRow> = {
      inquiry: "push_inquiry",
      chat: "push_chat",
      payment: "push_payment",
      wishlist: "push_wishlist",
      notice: "push_notice",
    };

    const { data: settings } = await serviceSupabase
      .from("notification_settings")
      .select("push_inquiry, push_chat, push_payment, push_wishlist, push_notice")
      .eq("user_id", userId)
      .maybeSingle();

    const row = settings as SettingsRow | null;
    if (row && row[columnMap[category]] === false) return;

    // 구독 정보 조회
    const { data: subscriptions } = await serviceSupabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (!subscriptions || subscriptions.length === 0) return;

    const message = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/",
      icon: payload.icon || "/icon-192.png",
    });

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            message
          );
        } catch (err: any) {
          // 만료/삭제된 구독 제거
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await serviceSupabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
          }
        }
      })
    );
  } catch (err) {
    console.error("[webpush] sendPushToUser error:", err);
  }
}
