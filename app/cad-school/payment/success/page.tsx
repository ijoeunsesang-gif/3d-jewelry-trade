"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase-browser";

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
      const orderId = searchParams.get("orderId");
      const amountStr = searchParams.get("amount");

      if (!paymentKey || !orderId || !amountStr) {
        setErrorMessage("결제 정보가 올바르지 않습니다."); setStatus("error"); return;
      }
      const amount = Number(amountStr);

      const pending = (() => {
        try { return JSON.parse(localStorage.getItem("pendingCadPayment") || "null"); } catch { return null; }
      })();

      if (!pending) { setErrorMessage("주문 정보를 찾을 수 없습니다."); setStatus("error"); return; }
      if (pending.price !== amount) { setErrorMessage("결제 금액이 일치하지 않습니다."); setStatus("error"); return; }

      // 서버 결제 승인
      const confirmRes = await fetch("/api/payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmData.success) {
        setErrorMessage(`결제 승인 실패: ${confirmData.message}`); setStatus("error"); return;
      }

      // DB 저장
      const { mentorId, menteeId, type, title, description, files, packageType, totalCount } = pending;

      if (type === "session") {
        const { data: session, error: sessionErr } = await supabase
          .from("cad_mentoring_sessions")
          .insert({
            mentor_id: mentorId,
            mentee_id: menteeId,
            title: title || "건별 멘토링 의뢰",
            description: description || "",
            files: files || [],
            price: amount,
          })
          .select("id")
          .single();

        if (sessionErr) throw new Error(sessionErr.message);
        setResult({ type: "session", redirectId: session.id });
      } else {
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        const { data: pkg, error: pkgErr } = await supabase
          .from("cad_packages")
          .insert({
            mentor_id: mentorId,
            mentee_id: menteeId,
            package_type: packageType,
            total_count: totalCount,
            remaining_count: totalCount,
            price: amount,
            expires_at: expiresAt,
          })
          .select("id")
          .single();

        if (pkgErr) throw new Error(pkgErr.message);
        setResult({ type: "package", redirectId: pkg.id });
      }

      localStorage.removeItem("pendingCadPayment");
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

  return (
    <main style={{ maxWidth: 500, margin: "80px auto", padding: "0 20px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 24, padding: 36, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 999, background: "#dcfce7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, margin: "0 auto 18px" }}>✓</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#111827", marginBottom: 10 }}>
          {result?.type === "session" ? "멘토링 의뢰 완료!" : "패키지 구매 완료!"}
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 28, lineHeight: 1.6 }}>
          {result?.type === "session"
            ? "멘토가 수락하면 알림이 전송됩니다."
            : "패키지가 활성화되었습니다. 멘토와 대화를 시작해보세요!"}
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {result && (
            <Link
              href={result.type === "session" ? `/cad-school/session/${result.redirectId}` : `/cad-school/package/${result.redirectId}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 52, borderRadius: 16, background: "#111827", color: "white", textDecoration: "none", fontWeight: 900, fontSize: 15 }}
            >
              {result.type === "session" ? "세션 확인하기" : "패키지 채팅 시작"}
            </Link>
          )}
          <Link
            href="/cad-school/my"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 50, borderRadius: 16, border: "1px solid #d1d5db", color: "#111827", textDecoration: "none", fontWeight: 800 }}
          >
            내 활동 보기
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
