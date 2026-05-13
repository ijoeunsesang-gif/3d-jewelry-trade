"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import { getAccessToken, decodeJwt } from "../../../lib/supabase-fetch";
import { showError } from "../../lib/toast";

function CadPaymentContent() {
  const router = useRouter();
  const [widgetReady, setWidgetReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [pending, setPending] = useState<any>(null);
  const widgetsRef = useRef<any>(null);
  const widgetInitRef = useRef(false);

  useEffect(() => {
    const data = (() => {
      try { return JSON.parse(localStorage.getItem("pendingCadPayment") || "null"); } catch { return null; }
    })();
    if (!data) { router.push("/cad-school"); return; }
    setPending(data);
  }, []);

  useEffect(() => {
    if (!pending || widgetInitRef.current) return;
    widgetInitRef.current = true;
    initWidgets();
  }, [pending]);

  const initWidgets = async () => {
    const token = getAccessToken();
    if (!token) { router.push("/auth"); return; }
    const payload = decodeJwt(token) as { sub?: string } | null;
    const clientKey = process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY!;
    try {
      const tossPayments = await loadTossPayments(clientKey);
      const widgets = tossPayments.widgets({ customerKey: payload?.sub ?? ANONYMOUS });
      await widgets.setAmount({ currency: "KRW", value: pending.price });
      await Promise.all([
        widgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
        widgets.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
      ]);
      widgetsRef.current = widgets;
      setWidgetReady(true);
    } catch (e) {
      console.error("위젯 초기화 실패:", e);
      showError("결제 위젯을 불러오는 데 실패했습니다.");
    }
  };

  const handlePayment = async () => {
    if (!widgetsRef.current || !pending) return;
    setPaying(true);
    try {
      await widgetsRef.current.requestPayment({
        orderId: pending.orderId,
        orderName: pending.orderName,
        successUrl: `${window.location.origin}/cad-school/payment/success`,
        failUrl: `${window.location.origin}/cad-school/payment/fail`,
      });
    } catch (e: unknown) {
      const errObj = e !== null && typeof e === "object" ? (e as Record<string, unknown>) : {};
      const errCode = typeof errObj.code === "string" ? errObj.code : "";
      const errMsg = e instanceof Error ? e.message : typeof errObj.message === "string" ? errObj.message : "";
      if (!errMsg.includes("취소") && !errCode.includes("CANCELED")) {
        showError("결제 중 오류가 발생했습니다.");
      }
    } finally {
      setPaying(false);
    }
  };

  if (!pending) return null;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: "#111827", marginBottom: 8 }}>결제하기</h1>
      <p style={{ fontSize: 15, color: "#6b7280", marginBottom: 24 }}>{pending.orderName}</p>

      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: 24, marginBottom: 16 }}>
        <div id="payment-method" />
      </div>
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: 24, marginBottom: 24 }}>
        <div id="agreement" />
      </div>

      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 900, color: "#111827" }}>
          <span>결제 금액</span>
          <span>{pending.price?.toLocaleString("ko-KR")}원</span>
        </div>
      </div>

      <button
        onClick={handlePayment}
        disabled={!widgetReady || paying}
        style={{ width: "100%", height: 54, borderRadius: 16, border: "none", background: !widgetReady || paying ? "#9ca3af" : "#111827", color: "white", fontSize: 16, fontWeight: 900, cursor: !widgetReady || paying ? "default" : "pointer" }}
      >
        {paying ? "결제 처리 중..." : !widgetReady ? "결제 수단 로딩 중..." : `${pending.price?.toLocaleString("ko-KR")}원 결제하기`}
      </button>
    </main>
  );
}

export default function CadPaymentPage() {
  return (
    <Suspense fallback={<main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>}>
      <CadPaymentContent />
    </Suspense>
  );
}
