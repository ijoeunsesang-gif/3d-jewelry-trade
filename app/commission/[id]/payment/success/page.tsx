"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getAccessToken } from "@/lib/supabase-fetch";
import UploadProgress, { buildSteps } from "@/app/components/UploadProgress";
import { GOLD } from "@/lib/constants";


export default function PaymentSuccessPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [payStep, setPayStep] = useState(0);
  const PAY_LABELS = ["결제 처리 중", "정보 저장 중"];
  const paySteps = buildSteps(PAY_LABELS, payStep);
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
        const token = getAccessToken();
        if (!token) throw new Error("로그인이 필요합니다.");

        setPayStep(0);
        const res = await fetch("/api/commission/payment/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: Number(amount),
            commissionId: id,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "결제 처리에 실패했습니다.");

        setPayStep(1);
        await new Promise((r) => setTimeout(r, 400));
        setPhase("success");
        window.dispatchEvent(new Event("notifications-updated"));
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
      <UploadProgress isVisible={phase === "loading"} steps={paySteps} />
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
