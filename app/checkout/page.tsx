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

  // ?„ì´??ë¡œë“œ ?„ë£Œ ???„ì ¯ ì´ˆê¸°??  useEffect(() => {
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
        showInfo("ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??");
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
          showError("ì§ì ‘ êµ¬ë§¤???í’ˆ???†ìŠµ?ˆë‹¤.");
          window.location.href = "/";
          return;
        }
      } else {
        const cart = JSON.parse(localStorage.getItem("cart") || "[]");
        setItems(cart);
      }
    } catch (error) {
      console.error("ì²´í¬?„ì›ƒ ì´ˆê¸°???¤íŒ¨:", error);
    } finally {
      setLoading(false);
    }
  };

  const initWidgets = async (amount: number) => {
    const clientKey = process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY;

    // ?”ë²„ê¹? clientKey ë¡œë“œ ?¬ë? ?•ì¸
    console.log(
      "[TossPayments] clientKey:",
      clientKey
        ? `?¤ì •??(${clientKey.substring(0, 10)}...)`
        : "??undefined ??NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY ?˜ê²½ë³€??ë¯¸ì„¤??
    );

    if (!clientKey) {
      showError("ê²°ì œ ?¤ì •???¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.");
      return;
    }

    try {
      // CDN ?¤í¬ë¦½íŠ¸ê°€ ?„ì§ ë¡œë“œ?˜ì? ?Šì? ê²½ìš°?ë§Œ ?½ì…
      if (!(window as { TossPayments?: unknown }).TossPayments) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://js.tosspayments.com/v2/standard";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("TossPayments SDK ë¡œë“œ ?¤íŒ¨"));
          document.head.appendChild(script);
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tossPayments = (window as any).TossPayments(clientKey);
      const widgets = tossPayments.widgets({ customerKey: "ANONYMOUS" });

      // setAmount ?„ë£Œ ??renderPaymentMethods / renderAgreement ?¤í–‰
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
      console.error("ê²°ì œ ?„ì ¯ ì´ˆê¸°???¤íŒ¨:", error);
      // ?¤íŒ¨ ???¬ì‹œ???ˆìš©
      widgetInitRef.current = false;
      showError("ê²°ì œ ?„ì ¯??ë¶ˆëŸ¬?¤ëŠ” ???¤íŒ¨?ˆìŠµ?ˆë‹¤. ?˜ì´ì§€ë¥??ˆë¡œê³ ì¹¨?´ì£¼?¸ìš”.");
    }
  };

  const handleCheckout = async () => {
    if (!buyerName.trim()) {
      showInfo("?´ë¦„???…ë ¥?´ì£¼?¸ìš”.");
      return;
    }
    if (!buyerEmail.trim()) {
      showInfo("?´ë©”?¼ì„ ?…ë ¥?´ì£¼?¸ìš”.");
      return;
    }
    if (items.length === 0) {
      showError("ê²°ì œ???í’ˆ???†ìŠµ?ˆë‹¤.");
      return;
    }
    if (!widgetsRef.current) {
      showError("ê²°ì œ ?„ì ¯???„ì§ ì¤€ë¹„ë˜ì§€ ?Šì•˜?µë‹ˆ?? ? ì‹œ ???¤ì‹œ ?œë„?´ì£¼?¸ìš”.");
      return;
    }

    const orderId = `order-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const orderName =
      items.length === 1
        ? items[0].title
        : `${items[0].title} ??${items.length - 1}ê°?;

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
          `ê²°ì œ???¤íŒ¨?ˆìŠµ?ˆë‹¤. (${err?.message ?? "?????†ëŠ” ?¤ë¥˜"})`
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
        <p>ê²°ì œ ?•ë³´ë¥?ë¶ˆëŸ¬?¤ëŠ” ì¤?..</p>
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
        ê²°ì œ?˜ê¸°
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
            ê²°ì œ???í’ˆ???†ìŠµ?ˆë‹¤.
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
            ?¥ë°”êµ¬ë‹ˆë¡??´ë™
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
          {/* ?¼ìª½: êµ¬ë§¤???•ë³´ + ì£¼ë¬¸ ?í’ˆ + ê²°ì œ?„ì ¯ */}
          <section style={{ display: "grid", gap: 16 }}>
            {/* êµ¬ë§¤???•ë³´ */}
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
                êµ¬ë§¤???•ë³´
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
                    ?´ë¦„
                  </label>
                  <input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="?´ë¦„ ?…ë ¥"
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
                    ?´ë©”??                  </label>
                  <input
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    placeholder="?´ë©”???…ë ¥"
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

            {/* ì£¼ë¬¸ ?í’ˆ */}
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
                ì£¼ë¬¸ ?í’ˆ
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

            {/* ? ìŠ¤?˜ì´ë¨¼ì¸  ê²°ì œ?„ì ¯ - ê²°ì œ ?˜ë‹¨ */}
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

            {/* ? ìŠ¤?˜ì´ë¨¼ì¸  ê²°ì œ?„ì ¯ - ?´ìš©?½ê? ?™ì˜ */}
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

          {/* ?¤ë¥¸ìª? ê²°ì œ ?”ì•½ + ê²°ì œ ë²„íŠ¼ */}
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
              ê²°ì œ ?”ì•½
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
              <span>?í’ˆ ??/span>
              <span>{items.length}ê°?/span>
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
              <span>ì´?ê²°ì œê¸ˆì•¡</span>
              <span>{totalPrice.toLocaleString("ko-KR")}??/span>
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
                ? "ê²°ì œ ì²˜ë¦¬ ì¤?.."
                : !widgetReady
                ? "ê²°ì œ ?˜ë‹¨ ë¡œë”© ì¤?.."
                : "ê²°ì œ ?„ë£Œ?˜ê¸°"}
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
              ?¥ë°”êµ¬ë‹ˆë¡??Œì•„ê°€ê¸?            </Link>
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
          ë¶ˆëŸ¬?¤ëŠ” ì¤?..
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
