"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
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

  // ?�이??로드 ?�료 ???�젯 초기??  useEffect(() => {
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
        showInfo("로그?�이 ?�요?�니??");
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
          showError("직접 구매???�품???�습?�다.");
          window.location.href = "/";
          return;
        }
      } else {
        const cart = JSON.parse(localStorage.getItem("cart") || "[]");
        setItems(cart);
      }
    } catch (error) {
      console.error("체크?�웃 초기???�패:", error);
    } finally {
      setLoading(false);
    }
  };

  const initWidgets = async (amount: number) => {
    const clientKey = process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY;

    // ?�버�? clientKey 로드 ?��? ?�인
    console.log(
      "[TossPayments] clientKey:",
      clientKey
        ? `?�정??(${clientKey.substring(0, 10)}...)`
        : "??undefined ??NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY ?�경변??미설??
    );

    if (!clientKey) {
      showError("결제 ?�정???�바르�? ?�습?�다.");
      return;
    }

    try {
      // CDN ?�크립트가 ?�직 로드?��? ?��? 경우?�만 ?�입
      if (!(window as { TossPayments?: unknown }).TossPayments) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://js.tosspayments.com/v2/standard";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("TossPayments SDK 로드 ?�패"));
          document.head.appendChild(script);
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tossPayments = (window as any).TossPayments(clientKey);
      const widgets = tossPayments.widgets({ customerKey: "ANONYMOUS" });

      // setAmount ?�료 ??renderPaymentMethods / renderAgreement ?�행
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
      console.error("결제 ?�젯 초기???�패:", error);
      // ?�패 ???�시???�용
      widgetInitRef.current = false;
      showError("결제 ?�젯??불러?�는 ???�패?�습?�다. ?�이지�??�로고침?�주?�요.");
    }
  };

  const handleCheckout = async () => {
    if (!buyerName.trim()) {
      showInfo("?�름???�력?�주?�요.");
      return;
    }
    if (!buyerEmail.trim()) {
      showInfo("?�메?�을 ?�력?�주?�요.");
      return;
    }
    if (items.length === 0) {
      showError("결제???�품???�습?�다.");
      return;
    }
    if (!widgetsRef.current) {
      showError("결제 ?�젯???�직 준비되지 ?�았?�니?? ?�시 ???�시 ?�도?�주?�요.");
      return;
    }

    const orderId = `order-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const orderName =
      items.length === 1
        ? items[0].title
        : `${items[0].title} ??${items.length - 1}�?;

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
          `결제???�패?�습?�다. (${err?.message ?? "?????�는 ?�류"})`
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
        <p>결제 ?�보�?불러?�는 �?..</p>
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
        결제?�기
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
            결제???�품???�습?�다.
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
            ?�바구니�??�동
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
          {/* ?�쪽: 구매???�보 + 주문 ?�품 + 결제?�젯 */}
          <section style={{ display: "grid", gap: 16 }}>
            {/* 구매???�보 */}
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
                구매???�보
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
                    ?�름
                  </label>
                  <input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="?�름 ?�력"
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
                    ?�메??                  </label>
                  <input
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    placeholder="?�메???�력"
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

            {/* 주문 ?�품 */}
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
                주문 ?�품
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
                      {item.price.toLocaleString("ko-KR")}??                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* ?�스?�이먼츠 결제?�젯 - 결제 ?�단 */}
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

            {/* ?�스?�이먼츠 결제?�젯 - ?�용?��? ?�의 */}
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

          {/* ?�른�? 결제 ?�약 + 결제 버튼 */}
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
              결제 ?�약
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
              <span>?�품 ??/span>
              <span>{items.length}�?/span>
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
              <span>�?결제금액</span>
              <span>{totalPrice.toLocaleString("ko-KR")}??/span>
            </div>

            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px", lineHeight: 1.5 }}>
              ℹ️ 구매 후 6개월간 횟수 제한없이 다운로드 가능
            </p>

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
                ? "결제 처리 �?.."
                : !widgetReady
                ? "결제 ?�단 로딩 �?.."
                : "결제 ?�료?�기"}
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
              ?�바구니�??�아가�?            </Link>
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
          불러?�는 �?..
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
