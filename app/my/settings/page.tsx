"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/app/lib/supabase-browser";
import { getAccessToken } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "@/app/lib/toast";
import Link from "next/link";

type Settings = {
  push_inquiry: boolean;
  push_chat: boolean;
  push_payment: boolean;
  push_wishlist: boolean;
  push_notice: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  push_inquiry: true,
  push_chat: true,
  push_payment: true,
  push_wishlist: true,
  push_notice: true,
};

const CATEGORIES = [
  { key: "push_inquiry" as const, label: "의뢰 알림", desc: "새 입찰, 상태 변경, 낙찰", emoji: "🔔" },
  { key: "push_chat" as const, label: "채팅 알림", desc: "새 메시지 수신 시", emoji: "💬" },
  { key: "push_payment" as const, label: "구매/결제 알림", desc: "결제 완료, 다운로드 가능", emoji: "💳" },
  { key: "push_wishlist" as const, label: "찜 알림", desc: "찜한 모델 가격 변경 시", emoji: "❤️" },
  { key: "push_notice" as const, label: "공지 알림", desc: "플랫폼 공지사항", emoji: "📢" },
];

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

export default function NotificationSettingsPage() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const checkSubscription = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    setSubscribed(!!sub);
  }, []);

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission);
    }

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      await checkSubscription();

      const { data } = await supabase
        .from("notification_settings")
        .select("push_inquiry, push_chat, push_payment, push_wishlist, push_notice")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) setSettings(data as Settings);
      setLoading(false);
    };
    init();
  }, [checkSubscription]);

  const handleEnablePush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      showError("이 브라우저는 푸시 알림을 지원하지 않습니다.");
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") {
      showError("알림 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.");
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const token = await getAccessToken();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.toJSON().keys }),
      });

      if (!res.ok) throw new Error("구독 저장 실패");
      setSubscribed(true);
      showSuccess("푸시 알림이 활성화되었습니다.");
    } catch (err) {
      console.error("[push] subscribe error:", err);
      showError("알림 구독 중 오류가 발생했습니다.");
    }
  };

  const handleDisablePush = async () => {
    if (!("serviceWorker" in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;

      const token = await getAccessToken();
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
      setSubscribed(false);
      showSuccess("푸시 알림이 비활성화되었습니다.");
    } catch (err) {
      console.error("[push] unsubscribe error:", err);
      showError("알림 해제 중 오류가 발생했습니다.");
    }
  };

  const handleToggle = async (key: keyof Settings) => {
    if (!userId || toggling) return;
    const newValue = !settings[key];
    setToggling(key);
    setSettings((prev) => ({ ...prev, [key]: newValue }));

    const { error } = await supabase
      .from("notification_settings")
      .upsert({ user_id: userId, [key]: newValue, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

    if (error) {
      setSettings((prev) => ({ ...prev, [key]: !newValue }));
      showError("설정 저장에 실패했습니다.");
    }
    setToggling(null);
  };

  const inputStyle: React.CSSProperties = {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  if (loading) {
    return (
      <main style={{ ...inputStyle, maxWidth: 560, margin: "48px auto", padding: "0 20px" }}>
        <div style={{ color: "#9ca3af", textAlign: "center", padding: 60 }}>불러오는 중...</div>
      </main>
    );
  }

  return (
    <main style={{ ...inputStyle, maxWidth: 560, margin: "48px auto", padding: "0 20px 80px" }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/notifications" style={{ color: "#9ca3af", fontSize: 14, textDecoration: "none" }}>
          ← 알림
        </Link>
        <h1 style={{ margin: "12px 0 4px", fontSize: 24, fontWeight: 900, color: "#111827" }}>
          알림 설정
        </h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
          받고 싶은 푸시 알림 종류를 선택하세요.
        </p>
      </div>

      {/* 푸시 권한 & 구독 상태 */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          background: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>브라우저 푸시 알림</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
              {permission === "unsupported"
                ? "이 브라우저는 푸시 알림을 지원하지 않습니다."
                : permission === "denied"
                ? "알림이 차단되어 있습니다. 브라우저 설정에서 허용해 주세요."
                : subscribed
                ? "알림이 활성화되어 있습니다."
                : "알림을 허용하면 실시간으로 알림을 받을 수 있습니다."}
            </div>
          </div>
          <button
            onClick={subscribed ? handleDisablePush : handleEnablePush}
            disabled={permission === "unsupported" || permission === "denied"}
            aria-label={subscribed ? "알림 끄기" : "알림 켜기"}
            style={{
              width: 48,
              height: 28,
              borderRadius: 999,
              border: "none",
              background: subscribed ? "#c9a84c" : "#e5e7eb",
              cursor: (permission === "unsupported" || permission === "denied") ? "not-allowed" : "pointer",
              position: "relative",
              transition: "background 0.2s",
              flexShrink: 0,
              opacity: (permission === "unsupported" || permission === "denied") ? 0.35 : 1,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: subscribed ? 23 : 3,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                transition: "left 0.2s",
              }}
            />
          </button>
        </div>
      </div>

      {/* 카테고리별 토글 */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "white",
          overflow: "hidden",
        }}
      >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>알림 종류 설정</div>
          </div>
          {CATEGORIES.map((cat, idx) => {
            const isOn = settings[cat.key];
            const isToggling = toggling === cat.key;
            return (
              <div
                key={cat.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  borderBottom: idx < CATEGORIES.length - 1 ? "1px solid #f9fafb" : undefined,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 22 }}>{cat.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>{cat.label}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{cat.desc}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(cat.key)}
                  disabled={isToggling}
                  aria-label={isOn ? "끄기" : "켜기"}
                  style={{
                    width: 48,
                    height: 28,
                    borderRadius: 999,
                    border: "none",
                    background: isOn ? "#c9a84c" : "#e5e7eb",
                    cursor: isToggling ? "not-allowed" : "pointer",
                    position: "relative",
                    transition: "background 0.2s",
                    flexShrink: 0,
                    opacity: isToggling ? 0.6 : 1,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 3,
                      left: isOn ? 23 : 3,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "white",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      transition: "left 0.2s",
                    }}
                  />
                </button>
              </div>
            );
          })}
        </div>
    </main>
  );
}
