"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getAccessToken } from "@/lib/supabase-fetch";

const ADDON_LABELS: Record<string, string> = {
  checklist:       "CAD수정 1회",
  review:          "실무 검수 1회",
  post_review_cad: "검수+CAD수정 1회",
};

type Status = "loading" | "success" | "error";

function AddonSuccessContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [addonLabel, setAddonLabel] = useState("");
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    confirmPayment();
  }, []);

  const confirmPayment = async () => {
    try {
      const paymentKey = searchParams.get("paymentKey");
      const orderId    = searchParams.get("orderId");
      const amountStr  = searchParams.get("amount");

      if (!paymentKey || !orderId || !amountStr) {
        setErrorMessage("결제 정보가 올바르지 않습니다."); setStatus("error"); return;
      }
      const amount = Number(amountStr);

      const pending = (() => {
        try { return JSON.parse(localStorage.getItem("pendingCadAddon") || "null"); } catch { return null; }
      })();

      if (!pending) { setErrorMessage("주문 정보를 찾을 수 없습니다."); setStatus("error"); return; }
      if (pending.price !== amount) { setErrorMessage("결제 금액이 일치하지 않습니다."); setStatus("error"); return; }

      // 결제 승인
      const confirmRes = await fetch("/api/payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmData.success) {
        setErrorMessage(`결제 승인 실패: ${confirmData.message}`); setStatus("error"); return;
      }

      // addon API 호출 → 카운트 한도 증가
      const token = getAccessToken();
      if (!token) { setErrorMessage("인증 정보가 없습니다."); setStatus("error"); return; }

      const addonRes = await fetch("/api/cad-school/addon", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subscription_id: pending.subscriptionId,
          addon_type: pending.addonType,
          price: amount,
          order_id: orderId,
        }),
      });
      const addonData = await addonRes.json();
      if (!addonRes.ok) { setErrorMessage(addonData.error || "처리 실패"); setStatus("error"); return; }

      localStorage.removeItem("pendingCadAddon");
      setSubscriptionId(pending.subscriptionId);
      setAddonLabel(ADDON_LABELS[pending.addonType] ?? pending.addonType);
      setStatus("success");
    } catch (err) {
      console.error("addon 결제 처리 오류:", err);
      setErrorMessage("결제 처리 중 오류가 발생했습니다.");
      setStatus("error");
    }
  };

  if (status === "loading") {
    return (
      <main style={{ maxWidth: 500, margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
        <p style={{ color: "#6b7280" }}>결제를 처리하는 중...</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main style={{ maxWidth: 500, margin: "80px auto", padding: "0 20px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ background: "white", border: "1px solid #fecaca", borderRadius: 24, padding: 32, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 18px" }}>✕</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111827", marginBottom: 10 }}>결제 오류</h1>
          <p style={{ color: "#6b7280", marginBottom: 24, fontSize: 14 }}>{errorMessage}</p>
          <Link href="/cad-school/my" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 48, padding: "0 24px", borderRadius: 14, background: "#111827", color: "white", textDecoration: "none", fontWeight: 800 }}>
            내 활동으로
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 500, margin: "80px auto", padding: "0 20px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 24, padding: 36, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 999, background: "#dcfce7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, margin: "0 auto 18px" }}>✓</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111827", marginBottom: 10 }}>추가 구매 완료!</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 8, lineHeight: 1.6 }}>
          <strong style={{ color: "#111827" }}>{addonLabel}</strong> 이용권이 추가되었습니다.
        </p>
        <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 28 }}>즉시 채팅방에서 사용 가능합니다.</p>
        <div style={{ display: "grid", gap: 12 }}>
          {subscriptionId && (
            <Link
              href={`/cad-school/subscription/${subscriptionId}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 52, borderRadius: 16, background: "#111827", color: "white", textDecoration: "none", fontWeight: 900, fontSize: 15 }}
            >
              채팅방으로 이동
            </Link>
          )}
          <Link
            href="/cad-school/my"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 48, borderRadius: 16, border: "1px solid #d1d5db", color: "#111827", textDecoration: "none", fontWeight: 800, fontSize: 14 }}
          >
            내 활동 보기
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function AddonSuccessPage() {
  return (
    <Suspense fallback={<main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>}>
      <AddonSuccessContent />
    </Suspense>
  );
}
