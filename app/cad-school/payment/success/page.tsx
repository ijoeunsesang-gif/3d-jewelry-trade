"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getAccessToken } from "@/lib/supabase-fetch";

type Status = "loading" | "success" | "error";
type ResultData = { type: string; redirectId: string };

function CadPaymentSuccessContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<ResultData | null>(null);
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
        try { return JSON.parse(localStorage.getItem("pendingCadPayment") || "null"); } catch { return null; }
      })();

      if (!pending) { setErrorMessage("주문 정보를 찾을 수 없습니다."); setStatus("error"); return; }
      if (pending.price !== amount) { setErrorMessage("결제 금액이 일치하지 않습니다."); setStatus("error"); return; }

      const token = getAccessToken();
      if (!token) { setErrorMessage("인증 정보가 없습니다."); setStatus("error"); return; }

      // 결제 승인 + DB 저장 한 번에 처리
      const confirmRes = await fetch("/api/cad-school/payment/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount,
          type: pending.type,
          mentorId: pending.mentorId,
          menteeId: pending.menteeId,
          planType: pending.planType,
          sessionType: pending.sessionType,
          title: pending.title,
          description: pending.description,
          files: pending.files,
        }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok || !confirmData.ok) {
        setErrorMessage(confirmData.error || "결제 처리에 실패했습니다."); setStatus("error"); return;
      }

      localStorage.removeItem("pendingCadPayment");
      setResult({ type: confirmData.type, redirectId: confirmData.id ?? "" });
      setStatus("success");
    } catch (err) {
      console.error("결제 처리 오류:", err);
      setErrorMessage("결제 처리 중 오류가 발생했습니다. 고객센터에 문의해주세요.");
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
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111827", marginBottom: 10 }}>결제 오류</h1>
          <p style={{ color: "#6b7280", marginBottom: 24 }}>{errorMessage}</p>
          <Link href="/cad-school" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 48, padding: "0 24px", borderRadius: 14, background: "#111827", color: "white", textDecoration: "none", fontWeight: 800 }}>
            캐드스쿨로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const isSubscription = result?.type === "subscription";
  const isSession = result?.type === "session";

  return (
    <main style={{ maxWidth: 500, margin: "80px auto", padding: "0 20px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 24, padding: 36, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 999, background: "#dcfce7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, margin: "0 auto 18px" }}>✓</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#111827", marginBottom: 10 }}>
          {isSubscription ? "수강이 시작되었습니다!" : "멘토링 의뢰 완료!"}
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 28, lineHeight: 1.6 }}>
          {isSubscription
            ? "멘토에게 알림이 전송되었습니다. 내 활동에서 수강 현황을 확인하세요."
            : "멘토가 수락하면 알림이 전송됩니다."}
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          <Link
            href="/cad-school/my"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 52, borderRadius: 16, background: "#111827", color: "white", textDecoration: "none", fontWeight: 900, fontSize: 15 }}
          >
            {isSubscription ? "내 수강 확인하기" : "내 활동 보기"}
          </Link>
          {isSession && result && (
            <Link
              href={`/cad-school/session/${result.redirectId}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 50, borderRadius: 16, border: "1px solid #d1d5db", color: "#111827", textDecoration: "none", fontWeight: 800 }}
            >
              세션 확인하기
            </Link>
          )}
          <Link
            href="/cad-school"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 50, borderRadius: 16, border: "1px solid #d1d5db", color: "#111827", textDecoration: "none", fontWeight: 800 }}
          >
            캐드스쿨로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function CadPaymentSuccessPage() {
  return (
    <Suspense fallback={<main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>}>
      <CadPaymentSuccessContent />
    </Suspense>
  );
}
