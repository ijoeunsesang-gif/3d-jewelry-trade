"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as PortOne from "@portone/browser-sdk/v2";
import { supabase } from "../lib/supabase";
import { showError, showInfo, showSuccess } from "../lib/toast";

type OrderItem = {
  id: string;
  title: string;
  price: number;
  thumbUrl: string;
  category: string;
  downloadUrl?: string;
};

type PayMethod =
  | "KAKAOPAY"
  | "NAVERPAY"
  | "TOSSPAY"
  | "SAMSUNGPAY"
  | "CARD"
  | "TRANSFER";

const PAY_METHODS: { id: PayMethod; label: string; icon: string }[] = [
  { id: "KAKAOPAY", label: "카카오페이", icon: "💛" },
  { id: "NAVERPAY", label: "네이버페이", icon: "🟢" },
  { id: "TOSSPAY", label: "토스페이", icon: "🔵" },
  { id: "SAMSUNGPAY", label: "삼성페이", icon: "🔷" },
  { id: "CARD", label: "신용/체크카드", icon: "💳" },
  { id: "TRANSFER", label: "계좌이체", icon: "🏦" },
];

const CHANNEL_KEY_MAP: Record<PayMethod, string | undefined> = {
  KAKAOPAY: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KAKAOPAY,
  NAVERPAY: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_NAVERPAY,
  TOSSPAY: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_TOSSPAY,
  SAMSUNGPAY: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_SAMSUNGPAY,
  CARD: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_CARD,
  TRANSFER: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_TRANSFER,
};

const isChannelConfigured = (method: PayMethod) => {
  const key = CHANNEL_KEY_MAP[method];
  return !!key && !key.startsWith("channel-key-xxxxxxxx");
};

const isStoreConfigured = () => {
  const id = process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "";
  return !!id && !id.startsWith("store-xxxxxxxx");
};

function buildPaymentRequest(
  method: PayMethod,
  paymentId: string,
  totalPrice: number,
  buyerName: string,
  buyerEmail: string,
  orderName: string
) {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "";
  const channelKey = CHANNEL_KEY_MAP[method] ?? "";

  const base = {
    storeId,
    channelKey,
    paymentId,
    orderName,
    totalAmount: totalPrice,
    currency: "CURRENCY_KRW" as const,
    customer: {
      fullName: buyerName,
      email: buyerEmail,
    },
  };

  if (method === "CARD") {
    return { ...base, payMethod: "CARD" as const };
  }
  if (method === "TRANSFER") {
    return { ...base, payMethod: "TRANSFER" as const };
  }

  const easyPayProviderMap: Record<string, string> = {
    KAKAOPAY: "EASY_PAY_PROVIDER_KAKAOPAY",
    NAVERPAY: "EASY_PAY_PROVIDER_NAVERPAY",
    TOSSPAY: "EASY_PAY_PROVIDER_TOSSPAY",
    SAMSUNGPAY: "EASY_PAY_PROVIDER_SAMSUNGPAY",
  };

  return {
    ...base,
    payMethod: "EASY_PAY" as const,
    easyPay: { easyPayProvider: easyPayProviderMap[method] },
  };
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PayMethod>(() => {
    // 설정된 첫 번째 결제수단을 기본값으로
    const first = (["KAKAOPAY", "CARD", "TOSSPAY", "NAVERPAY", "TRANSFER", "SAMSUNGPAY"] as PayMethod[])
      .find(isChannelConfigured);
    return first ?? "KAKAOPAY";
  });

  useEffect(() => {
    bootstrap();
  }, []);

  const bootstrap = async () => {
    try {
      const mode = searchParams.get("mode");
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        showInfo("로그인이 필요합니다.");
        window.location.href = "/auth";
        return;
      }

      setBuyerEmail(session.user.email || "");

      if (mode === "direct") {
        const pendingOrder = JSON.parse(localStorage.getItem("pendingOrder") || "null");
        if (pendingOrder?.items?.length) {
          setItems(pendingOrder.items);
        } else {
          showError("직접 구매할 상품이 없습니다.");
          window.location.href = "/";
          return;
        }
      } else {
        const cart = JSON.parse(localStorage.getItem("cart") || "[]");
        setItems(cart);
      }
    } catch (error) {
      console.error("체크아웃 초기화 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.price, 0),
    [items]
  );

  const handleCheckout = async () => {
    if (!buyerName.trim()) { showInfo("이름을 입력해주세요."); return; }
    if (!buyerEmail.trim()) { showInfo("이메일을 입력해주세요."); return; }
    if (!agree) { showError("구매 동의가 필요합니다."); return; }
    if (items.length === 0) { showError("결제할 상품이 없습니다."); return; }

    if (!isStoreConfigured()) {
      showError(".env.local의 NEXT_PUBLIC_PORTONE_STORE_ID를 설정해주세요.");
      return;
    }

    if (!isChannelConfigured(selectedMethod)) {
      showError(`선택한 결제수단(${PAY_METHODS.find(m => m.id === selectedMethod)?.label})의 채널 키가 설정되지 않았습니다.`);
      return;
    }

    const paymentId = `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const orderName =
      items.length === 1
        ? items[0].title
        : `${items[0].title} 외 ${items.length - 1}개`;

    setPaying(true);
    try {
      const paymentRequest = buildPaymentRequest(
        selectedMethod,
        paymentId,
        totalPrice,
        buyerName.trim(),
        buyerEmail.trim(),
        orderName
      );

      const response = await PortOne.requestPayment(paymentRequest as Parameters<typeof PortOne.requestPayment>[0]);

      if (!response || response.code) {
        if (response?.code !== "USER_CANCEL") {
          showError(`결제에 실패했습니다. (${response?.message ?? "알 수 없는 오류"})`);
        }
        return;
      }

      // 서버 사이드 결제 검증
      const verifyRes = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, expectedAmount: totalPrice }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyData.success) {
        showError(`결제 검증 실패: ${verifyData.message}`);
        return;
      }

      // 구매 내역 Supabase 저장
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const purchaseRows = items.map((item) => ({
          user_id: session.user.id,
          model_id: item.id,
          price: item.price,
        }));

        const { error: dbError } = await supabase
          .from("purchases")
          .upsert(purchaseRows, { onConflict: "user_id,model_id", ignoreDuplicates: true });

        if (dbError) {
          console.error("구매 저장 실패:", dbError);
          showError("구매 저장에 실패했습니다. 고객센터에 문의해주세요.");
          return;
        }
      }

      // 성공 처리
      const order = {
        items,
        totalPrice,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        orderedAt: new Date().toISOString(),
        paymentId,
        payMethod: selectedMethod,
      };

      localStorage.setItem("lastOrder", JSON.stringify(order));
      localStorage.removeItem("pendingOrder");
      localStorage.removeItem("cart");
      window.dispatchEvent(new Event("cart-updated"));

      showSuccess("결제가 완료되었습니다!");
      window.location.href = "/success";
    } catch (error) {
      console.error("결제 처리 오류:", error);
      showError("결제 처리 중 오류가 발생했습니다.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px" }}>
        <p>결제 정보를 불러오는 중...</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: "0 20px",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <h1 style={{ fontSize: 34, fontWeight: 900, color: "#111827", marginBottom: 24 }}>
        결제하기
      </h1>

      {items.length === 0 ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 32, background: "white" }}>
          <p style={{ color: "#6b7280", marginBottom: 16 }}>결제할 상품이 없습니다.</p>
          <Link
            href="/cart"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              height: 48, padding: "0 18px", borderRadius: 14,
              background: "#111827", color: "white", textDecoration: "none", fontWeight: 800,
            }}
          >
            장바구니로 이동
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.8fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          <section style={{ display: "grid", gap: 16 }}>
            {/* 구매자 정보 */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 24, background: "white" }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 18, color: "#111827" }}>
                구매자 정보
              </h2>
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 700 }}>이름</label>
                  <input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="이름 입력"
                    style={{ width: "100%", height: 48, borderRadius: 14, border: "1px solid #d1d5db", padding: "0 14px", fontSize: 15, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 700 }}>이메일</label>
                  <input
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    placeholder="이메일 입력"
                    style={{ width: "100%", height: 48, borderRadius: 14, border: "1px solid #d1d5db", padding: "0 14px", fontSize: 15, boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>

            {/* 결제 수단 */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 24, background: "white" }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 18, color: "#111827" }}>
                결제 수단
              </h2>
              {!isStoreConfigured() && (
                <div style={{
                  marginBottom: 14,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "#fef3c7",
                  border: "1px solid #fcd34d",
                  fontSize: 13,
                  color: "#92400e",
                  lineHeight: 1.5,
                }}>
                  ⚠️ <strong>포트원 미설정</strong> — .env.local에 STORE_ID와 CHANNEL_KEY를 입력해야 실제 결제가 가능합니다.
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {PAY_METHODS.map((m) => {
                  const configured = isChannelConfigured(m.id);
                  const selected = selectedMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => configured && setSelectedMethod(m.id)}
                      title={!configured ? "채널 키 미설정 — .env.local 확인" : undefined}
                      style={{
                        height: 62,
                        borderRadius: 14,
                        border: selected ? "2px solid #111827" : "1px solid #e5e7eb",
                        background: !configured ? "#f9fafb" : selected ? "#f9fafb" : "white",
                        cursor: configured ? "pointer" : "not-allowed",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        fontWeight: selected ? 900 : 700,
                        fontSize: 12,
                        color: !configured ? "#d1d5db" : selected ? "#111827" : "#6b7280",
                        transition: "all 0.15s",
                        opacity: configured ? 1 : 0.5,
                        position: "relative",
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{m.icon}</span>
                      {m.label}
                      {!configured && (
                        <span style={{ fontSize: 9, color: "#9ca3af", position: "absolute", bottom: 5 }}>미설정</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 주문 상품 */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 24, background: "white" }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 18, color: "#111827" }}>
                주문 상품
              </h2>
              <div style={{ display: "grid", gap: 14 }}>
                {items.map((item) => (
                  <article
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "90px minmax(0, 1fr) auto",
                      gap: 14,
                      alignItems: "center",
                      border: "1px solid #f3f4f6",
                      borderRadius: 18,
                      padding: 12,
                    }}
                  >
                    <img
                      src={item.thumbUrl}
                      alt={item.title}
                      style={{ width: 90, height: 70, objectFit: "cover", borderRadius: 12, border: "1px solid #e5e7eb" }}
                    />
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 13, color: "#6b7280" }}>{item.category}</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>
                      {item.price.toLocaleString("ko-KR")}원
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* 결제 요약 */}
          <aside
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 24,
              padding: 24,
              background: "white",
              position: "sticky",
              top: 24,
            }}
          >
            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 18, color: "#111827" }}>
              결제 요약
            </h2>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 15, color: "#6b7280" }}>
              <span>상품 수</span>
              <span>{items.length}개</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 15, color: "#6b7280" }}>
              <span>결제 수단</span>
              <span>{PAY_METHODS.find((m) => m.id === selectedMethod)?.label}</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 18,
                marginTop: 12,
                fontSize: 20,
                fontWeight: 900,
                color: "#111827",
                borderTop: "1px solid #f3f4f6",
                paddingTop: 14,
              }}
            >
              <span>총 결제금액</span>
              <span>{totalPrice.toLocaleString("ko-KR")}원</span>
            </div>

            <label
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                marginBottom: 18,
                fontSize: 13,
                color: "#4b5563",
                lineHeight: 1.5,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              디지털 상품 특성상 결제 후 단순 변심에 의한 환불이 제한될 수 있음에 동의합니다.
            </label>

            <button
              onClick={handleCheckout}
              disabled={paying}
              style={{
                width: "100%",
                height: 54,
                borderRadius: 16,
                border: "none",
                background: paying ? "#9ca3af" : "#111827",
                color: "white",
                fontSize: 16,
                fontWeight: 900,
                cursor: paying ? "default" : "pointer",
                marginBottom: 10,
                transition: "background 0.15s",
              }}
            >
              {paying ? "결제 처리 중..." : "결제 완료하기"}
            </button>

            <Link
              href="/cart"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: 50,
                borderRadius: 16,
                border: "1px solid #d1d5db",
                background: "white",
                color: "#111827",
                textDecoration: "none",
                fontWeight: 800,
              }}
            >
              장바구니로 돌아가기
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>}>
      <CheckoutContent />
    </Suspense>
  );
}
