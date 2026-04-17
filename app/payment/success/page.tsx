"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";

type OrderItem = {
  id: string;
  title: string;
  price: number;
  thumbUrl: string;
  category: string;
};

type PendingPayment = {
  items: OrderItem[];
  totalPrice: number;
  buyerName: string;
  buyerEmail: string;
  orderId: string;
  payMethod?: string;
};

type Status = "loading" | "success" | "error";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [order, setOrder] = useState<PendingPayment | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
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
        setErrorMessage("결제 정보가 올바르지 않습니다.");
        setStatus("error");
        return;
      }

      const amount = Number(amountStr);
      const pending = (() => {
        try {
          return JSON.parse(localStorage.getItem("pendingPayment") || "null") as PendingPayment | null;
        } catch {
          return null;
        }
      })();

      if (!pending) {
        setErrorMessage("주문 정보를 찾을 수 없습니다.");
        setStatus("error");
        return;
      }

      // 금액 검증
      if (pending.totalPrice !== amount) {
        setErrorMessage("결제 금액이 일치하지 않습니다.");
        setStatus("error");
        return;
      }

      const token = getAccessToken();
      const userId = token ? ((decodeJwt(token) as any)?.sub as string) : null;

      // 서버 결제 승인
      const confirmRes = await fetch("/api/payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      });

      const confirmData = await confirmRes.json();

      if (!confirmData.success) {
        setErrorMessage(`결제 승인 실패: ${confirmData.message}`);
        setStatus("error");
        return;
      }

      // 구매 내역 Supabase 저장
      if (userId) {
        const purchaseRows = pending.items.map((item) => ({
          user_id: userId,
          model_id: item.id,
          price: item.price,
        }));

        const { error: dbError } = await supabase
          .from("purchases")
          .upsert(purchaseRows, { onConflict: "user_id,model_id", ignoreDuplicates: true });

        if (dbError) {
          console.error("구매 저장 실패:", dbError);
        }
      }

      // 완료 처리
      localStorage.setItem(
        "lastOrder",
        JSON.stringify({ ...pending, paymentKey, orderedAt: new Date().toISOString() })
      );
      localStorage.removeItem("pendingPayment");
      localStorage.removeItem("pendingOrder");
      localStorage.removeItem("cart");
      window.dispatchEvent(new Event("cart-updated"));

      setOrder(pending);
      setStatus("success");
    } catch (err) {
      console.error("결제 승인 중 오류:", err);
      setErrorMessage("결제 처리 중 오류가 발생했습니다. 고객센터에 문의해주세요.");
      setStatus("error");
    }
  };

  if (status === "loading") {
    return (
      <main style={{ maxWidth: 600, margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
        <p style={{ color: "#6b7280", fontSize: 16 }}>결제를 승인하는 중...</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main
        style={{
          maxWidth: 600,
          margin: "80px auto",
          padding: "0 20px",
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            border: "1px solid #fecaca",
            borderRadius: 24,
            padding: 32,
            background: "white",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              background: "#fee2e2",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              margin: "0 auto 18px",
            }}
          >
            ✕
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#111827", marginBottom: 10 }}>
            결제 오류
          </h1>
          <p style={{ color: "#6b7280", marginBottom: 24 }}>{errorMessage}</p>
          <Link
            href="/checkout"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 48,
              padding: "0 24px",
              borderRadius: 14,
              background: "#111827",
              color: "white",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            다시 시도하기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <style>{`
        .ps-main {
          max-width: 1100px;
          margin: 40px auto;
          padding: 0 20px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          box-sizing: border-box;
          width: 100%;
        }
        .ps-header {
          border: 1px solid #e5e7eb;
          border-radius: 28px;
          padding: 32px;
          background: white;
          margin-bottom: 24px;
        }
        .ps-title {
          font-size: 36px;
          font-weight: 900;
          margin-bottom: 12px;
          color: #111827;
          word-break: keep-all;
          overflow-wrap: break-word;
        }
        .ps-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(0, 0.8fr);
          gap: 24px;
          align-items: start;
        }
        .ps-aside {
          border: 1px solid #e5e7eb;
          border-radius: 24px;
          padding: 24px;
          background: white;
          position: sticky;
          top: 24px;
        }
        .ps-item {
          display: grid;
          grid-template-columns: 80px minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          border: 1px solid #f3f4f6;
          border-radius: 18px;
          padding: 12px;
        }
        .ps-item-thumb {
          width: 80px;
          height: 64px;
          object-fit: cover;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          flex-shrink: 0;
        }
        .ps-item-title {
          font-size: 16px;
          font-weight: 800;
          color: #111827;
          margin-bottom: 4px;
          word-break: keep-all;
          overflow-wrap: break-word;
        }
        .ps-item-price {
          font-size: 15px;
          font-weight: 900;
          color: #111827;
          white-space: nowrap;
        }
        @media (max-width: 640px) {
          .ps-main {
            margin: 20px auto;
            padding: 0 16px;
          }
          .ps-header {
            padding: 20px 16px;
            border-radius: 20px;
          }
          .ps-title {
            font-size: 24px;
          }
          .ps-grid {
            grid-template-columns: 1fr;
          }
          .ps-aside {
            position: static;
            border-radius: 20px;
            padding: 20px 16px;
          }
          .ps-item {
            grid-template-columns: 72px minmax(0, 1fr);
            grid-template-rows: auto auto;
          }
          .ps-item-thumb {
            width: 72px;
            height: 56px;
            grid-row: 1 / 3;
          }
          .ps-item-price {
            font-size: 14px;
          }
        }
      `}</style>
      <main className="ps-main">
        <div className="ps-header">
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              background: "#dcfce7",
              color: "#166534",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              marginBottom: 18,
            }}
          >
            ✓
          </div>

          <h1 className="ps-title">구매가 완료되었습니다.</h1>

          <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 8 }}>
            이제 내 다운로드에서 파일을 받을 수 있습니다.
          </p>

          {order && (
            <>
              <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 4 }}>
                구매자: <strong style={{ color: "#111827" }}>{order.buyerName}</strong>
              </p>
              <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 4 }}>
                이메일: <strong style={{ color: "#111827" }}>{order.buyerEmail}</strong>
              </p>
              <p style={{ fontSize: 16, color: "#6b7280" }}>
                총 결제금액:{" "}
                <strong style={{ color: "#111827" }}>
                  {order.totalPrice.toLocaleString("ko-KR")}원
                </strong>
              </p>
            </>
          )}
        </div>

        {order && (
          <div className="ps-grid">
            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 24,
                padding: 24,
                background: "white",
              }}
            >
              <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 18, color: "#111827" }}>
                구매한 상품
              </h2>
              <div style={{ display: "grid", gap: 14 }}>
                {order.items.map((item) => (
                  <article key={item.id} className="ps-item">
                    <img
                      src={item.thumbUrl}
                      alt={item.title}
                      className="ps-item-thumb"
                    />
                    <div style={{ minWidth: 0 }}>
                      <div className="ps-item-title">{item.title}</div>
                      <div style={{ fontSize: 13, color: "#6b7280" }}>{item.category}</div>
                    </div>
                    <div className="ps-item-price">
                      {item.price.toLocaleString("ko-KR")}원
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="ps-aside">
              <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 18, color: "#111827" }}>
                다음 단계
              </h2>
              <div style={{ display: "grid", gap: 12 }}>
                <Link
                  href="/library"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: 52,
                    borderRadius: 16,
                    border: "none",
                    background: "#111827",
                    color: "white",
                    fontSize: 15,
                    fontWeight: 900,
                    textDecoration: "none",
                    boxSizing: "border-box",
                  }}
                >
                  내 다운로드 보기
                </Link>
                <Link
                  href="/"
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
                    boxSizing: "border-box",
                  }}
                >
                  홈으로 이동
                </Link>
              </div>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
