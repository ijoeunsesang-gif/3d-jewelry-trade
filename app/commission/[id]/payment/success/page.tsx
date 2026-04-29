"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase-browser";

const GOLD = "#c9a84c";

export default function PaymentSuccessPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");

    if (!paymentKey || !orderId || !amount) {
      setErrorMessage("결제 정보가 올바르지 않습니다.");
      setPhase("error");
      return;
    }

    const complete = async () => {
      try {
        // 1. Toss 결제 승인
        const confirmRes = await fetch("/api/payment/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
        });
        const confirmData = await confirmRes.json();
        if (!confirmRes.ok || !confirmData.success) {
          throw new Error(confirmData.message || "결제 승인에 실패했습니다.");
        }

        // 2. 커미션 상태 → working 업데이트
        const { data: commission, error: fetchErr } = await supabase
          .from("commissions")
          .select("user_id, target_seller_id")
          .eq("id", id)
          .single();
        if (fetchErr || !commission) throw new Error("의뢰 정보를 찾을 수 없습니다.");

        await supabase.from("commissions").update({ status: "working" }).eq("id", id);

        // 3. 알림 전송
        await Promise.all([
          fetch("/api/commission/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: commission.target_seller_id,
              type: "negotiation",
              title: "결제 완료",
              link: `/commission/${id}`,
            }),
          }),
          fetch("/api/commission/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: commission.user_id,
              type: "negotiation",
              title: "작업 시작",
              link: `/commission/${id}`,
            }),
          }),
        ]);

        setPhase("success");
        setTimeout(() => router.replace(`/commission/${id}`), 1800);
      } catch (e: any) {
        setErrorMessage(e?.message || "결제 처리 중 오류가 발생했습니다.");
        setPhase("error");
      }
    };

    complete();
  }, []);

  return (
    <main style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: 'system-ui, -apple-system, sans-serif', background: "#f9fafb",
    }}>
      <div style={{
        background: "white", borderRadius: 20, padding: "48px 40px", maxWidth: 400, width: "100%",
        textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      }}>
        {phase === "loading" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>결제 처리 중...</div>
            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>잠시만 기다려 주세요.</div>
          </>
        )}
        {phase === "success" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>결제 완료!</div>
            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>잠시 후 의뢰 페이지로 이동합니다.</div>
          </>
        )}
        {phase === "error" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>결제 처리 실패</div>
            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>{errorMessage}</div>
            <button
              type="button"
              onClick={() => router.replace(`/commission/${id}`)}
              style={{
                marginTop: 24, height: 44, padding: "0 28px", borderRadius: 10,
                border: "none", background: GOLD, color: "white",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              의뢰로 돌아가기
            </button>
          </>
        )}
      </div>
    </main>
  );
}
