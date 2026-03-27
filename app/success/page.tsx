"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type OrderItem = {
  id: string;
  title: string;
  price: number;
  thumbUrl: string;
  category: string;
};

type LastOrder = {
  items: OrderItem[];
  totalPrice: number;
  buyerName: string;
  buyerEmail: string;
  orderedAt: string;
  paymentId?: string;
  payMethod?: string;
};

const PAY_METHOD_LABEL: Record<string, string> = {
  KAKAOPAY: "카카오페이",
  NAVERPAY: "네이버페이",
  TOSSPAY: "토스페이",
  SAMSUNGPAY: "삼성페이",
  CARD: "신용/체크카드",
  TRANSFER: "계좌이체",
};

export default function SuccessPage() {
  const [order, setOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("lastOrder");
    if (raw) {
      try {
        setOrder(JSON.parse(raw));
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: "0 20px",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 28,
          padding: 32,
          background: "white",
          marginBottom: 24,
        }}
      >
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

        <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 12, color: "#111827" }}>
          구매가 완료되었습니다.
        </h1>

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
            {order.payMethod && (
              <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 4 }}>
                결제 수단: <strong style={{ color: "#111827" }}>{PAY_METHOD_LABEL[order.payMethod] ?? order.payMethod}</strong>
              </p>
            )}
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.5fr) minmax(300px, 0.8fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
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
                <article
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px minmax(0, 1fr) auto",
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
                    style={{ width: 100, height: 76, objectFit: "cover", borderRadius: 12, border: "1px solid #e5e7eb" }}
                  />
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 4 }}>
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
          </section>

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
                }}
              >
                홈으로 이동
              </Link>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
