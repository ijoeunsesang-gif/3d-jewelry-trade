"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { showError, showInfo } from "../lib/toast";

type OrderItem = {
  id: string;
  title: string;
  price: number;
  thumbUrl: string;
  category: string;
  downloadUrl?: string;
};

function CheckoutContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgetsRef = useRef<any>(null);
  const widgetInitRef = useRef(false);

  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.price, 0),
    [items]
  );

  useEffect(() => {
    bootstrap();
  }, []);

  // 아이템 로드 완료 후 위젯 초기화
  useEffect(() => {
    if (!loading && items.length > 0 && !widgetInitRef.current) {
      widgetInitRef.current = true;
      initWidgets(items.reduce((sum, item) => sum + item.price, 0));
    }
  }, [loading, items]);

  const bootstrap = async () => {
    try {
      const mode = searchParams.get("mode");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        showInfo("로그인이 필요합니다.");
        window.location.href = "/auth";
        return;
      }

      setBuyerEmail(session.user.email || "");

      if (mode === "direct") {
        const pendingOrder = JSON.parse(
          localStorage.getItem("pendingOrder") || "null"
        );
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

  const initWidgets = async (amount: number) => {
    const clientKey = process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY;

    // 디버깅: clientKey 로드 여부 확인
    console.log(
      "[TossPayments] clientKey:",
      clientKey
        ? `설정됨 (${clientKey.substring(0, 10)}...)`
        : "❌ undefined — NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY 환경변수 미설정"
    );

    if (!clientKey) {
      showError("결제 설정이 올바르지 않습니다.");
      return;
    }

    try {
      // CDN 스크립트가 아직 로드되지 않은 경우에만 삽입
      if (!(window as { TossPayments?: unknown }).TossPayments) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://js.tosspayments.com/v2/standard";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("TossPayments SDK 로드 실패"));
          document.head.appendChild(script);
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tossPayments = (window as any).TossPayments(clientKey);
      const widgets = tossPayments.widgets({ customerKey: "ANONYMOUS" });

      // setAmount 완료 후 renderPaymentMethods / renderAgreement 실행
      await widgets.setAmount({ currency: "KRW", value: amount });

      await Promise.all([
        widgets.renderPaymentMethods({
          selector: "#payment-method",
          variantKey: "DEFAULT",
        }),
        widgets.renderAgreement({
          selector: "#agreement",
          variantKey: "AGREEMENT",
        }),
      ]);

      widgetsRef.current = widgets;
      setWidgetReady(true);
    } catch (error) {
      console.error("결제 위젯 초기화 실패:", error);
      // 실패 시 재시도 허용
      widgetInitRef.current = false;
      showError("결제 위젯을 불러오는 데 실패했습니다. 페이지를 새로고침해주세요.");
    }
  };

  const handleCheckout = async () => {
    if (!buyerName.trim()) {
      showInfo("이름을 입력해주세요.");
      return;
    }
    if (!buyerEmail.trim()) {
      showInfo("이메일을 입력해주세요.");
      return;
    }
    if (items.length === 0) {
      showError("결제할 상품이 없습니다.");
      return;
    }
    if (!widgetsRef.current) {
      showError("결제 위젯이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    const orderId = `order-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const orderName =
      items.length === 1
        ? items[0].title
        : `${items[0].title} 외 ${items.length - 1}개`;

    localStorage.setItem(
      "pendingPayment",
      JSON.stringify({
        items,
        totalPrice,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        orderId,
      })
    );

    setPaying(true);
    try {
      await widgetsRef.current.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: buyerEmail.trim(),
        customerName: buyerName.trim(),
      });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err?.code !== "USER_CANCEL") {
        showError(
          `결제에 실패했습니다. (${err?.message ?? "알 수 없는 오류"})`
        );
      }
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <main
        className="cart-checkout-main"
        style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px" }}
      >
        <p>결제 정보를 불러오는 중...</p>
      </main>
    );
  }

  return (
    <main
      className="cart-checkout-main"
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: "0 20px",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <h1
        style={{
          fontSize: 34,
          fontWeight: 900,
          color: "#111827",
          marginBottom: 24,
        }}
      >
        결제하기
      </h1>

      {items.length === 0 ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            padding: 32,
            background: "white",
          }}
        >
          <p style={{ color: "#6b7280", marginBottom: 16 }}>
            결제할 상품이 없습니다.
          </p>
          <Link
            href="/cart"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 48,
              padding: "0 18px",
              borderRadius: 14,
              background: "#111827",
              color: "white",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            장바구니로 이동
          </Link>
        </div>
      ) : (
        <div
          className="cart-checkout-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.8fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* 왼쪽: 구매자 정보 + 주문 상품 + 결제위젯 */}
          <section style={{ display: "grid", gap: 16 }}>
            {/* 구매자 정보 */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 24,
                padding: 24,
                background: "white",
              }}
            >
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  marginBottom: 18,
                  color: "#111827",
                }}
              >
                구매자 정보
              </h2>
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 700,
                    }}
                  >
                    이름
                  </label>
                  <input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="이름 입력"
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: 14,
                      border: "1px solid #d1d5db",
                      padding: "0 14px",
                      fontSize: 15,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 700,
                    }}
                  >
                    이메일
                  </label>
                  <input
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    placeholder="이메일 입력"
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: 14,
                      border: "1px solid #d1d5db",
                      padding: "0 14px",
                      fontSize: 15,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 주문 상품 */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 24,
                padding: 24,
                background: "white",
              }}
            >
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  marginBottom: 18,
                  color: "#111827",
                }}
              >
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
                      style={{
                        width: 90,
                        height: 70,
                        objectFit: "cover",
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: "#111827",
                          marginBottom: 4,
                        }}
                      >
                        {item.title}
                      </div>
                      <div style={{ fontSize: 13, color: "#6b7280" }}>
                        {item.category}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        color: "#111827",
                      }}
                    >
                      {item.price.toLocaleString("ko-KR")}원
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* 토스페이먼츠 결제위젯 - 결제 수단 */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 24,
                padding: 24,
                background: "white",
              }}
            >
              <div id="payment-method" />
            </div>

            {/* 토스페이먼츠 결제위젯 - 이용약관 동의 */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 24,
                padding: 24,
                background: "white",
              }}
            >
              <div id="agreement" />
            </div>
          </section>

          {/* 오른쪽: 결제 요약 + 결제 버튼 */}
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
            <h2
              style={{
                fontSize: 24,
                fontWeight: 900,
                marginBottom: 18,
                color: "#111827",
              }}
            >
              결제 요약
            </h2>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 10,
                fontSize: 15,
                color: "#6b7280",
              }}
            >
              <span>상품 수</span>
              <span>{items.length}개</span>
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

            <button
              onClick={handleCheckout}
              disabled={paying || !widgetReady}
              style={{
                width: "100%",
                height: 54,
                borderRadius: 16,
                border: "none",
                background: paying || !widgetReady ? "#9ca3af" : "#111827",
                color: "white",
                fontSize: 16,
                fontWeight: 900,
                cursor: paying || !widgetReady ? "default" : "pointer",
                marginBottom: 10,
                transition: "background 0.15s",
              }}
            >
              {paying
                ? "결제 처리 중..."
                : !widgetReady
                ? "결제 수단 로딩 중..."
                : "결제 완료하기"}
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
    <Suspense
      fallback={
        <main
          style={{
            padding: "60px 20px",
            textAlign: "center",
            color: "#6b7280",
          }}
        >
          불러오는 중...
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
