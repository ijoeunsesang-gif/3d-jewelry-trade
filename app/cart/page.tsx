"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type CartItem = {
  id: string;
  title: string;
  price: number;
  thumbUrl: string;
  category: string;
  downloadUrl?: string;
};

const ITEMS_PER_PAGE = 20;

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem("cart") || "[]");
    setCartItems(savedCart);
    window.dispatchEvent(new Event("cart-reset"));
  }, []);

  const totalPrice = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price, 0);
  }, [cartItems]);

  const removeItem = (id: string) => {
    const updated = cartItems.filter((item) => item.id !== id);
    setCartItems(updated);
    localStorage.setItem("cart", JSON.stringify(updated));
    window.dispatchEvent(new Event("cart-updated"));
  };

  return (
    <main
      className="cart-checkout-main"
      style={{
        maxWidth: 1200,
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
          marginBottom: 24,
          color: "#111827",
        }}
      >
        장바구니
      </h1>

      {cartItems.length === 0 ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            padding: 32,
            background: "white",
          }}
        >
          <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 16 }}>
            장바구니에 담긴 상품이 없습니다.
          </p>

          <Link
            href="/"
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
            상품 보러가기
          </Link>
        </div>
      ) : (
        <div
          className="cart-checkout-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 0.8fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          <section style={{ display: "grid", gap: 16 }}>
            {cartItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((item) => (
              <article
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px minmax(0, 1fr) auto",
                  gap: 16,
                  border: "1px solid #e5e7eb",
                  borderRadius: 20,
                  padding: 16,
                  background: "white",
                  alignItems: "center",
                }}
              >
                <img
                  src={item.thumbUrl}
                  alt={item.title}
                  style={{
                    width: 120,
                    height: 90,
                    objectFit: "cover",
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                  }}
                />

                <div>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "5px 9px",
                      borderRadius: 999,
                      background: "#eef2ff",
                      color: "#3730a3",
                      fontSize: 11,
                      fontWeight: 800,
                      marginBottom: 8,
                    }}
                  >
                    {item.category}
                  </div>

                  <h2
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      margin: "0 0 8px",
                      color: "#111827",
                    }}
                  >
                    {item.title}
                  </h2>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 900,
                      color: "#111827",
                      marginBottom: 12,
                    }}
                  >
                    {item.price.toLocaleString("ko-KR")}원
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    style={{
                      height: 42,
                      padding: "0 14px",
                      borderRadius: 12,
                      border: "1px solid #fecaca",
                      background: "#fff1f2",
                      color: "#b91c1c",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    삭제
                  </button>
                </div>
              </article>
            ))}

            {Math.ceil(cartItems.length / ITEMS_PER_PAGE) > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: currentPage === 1 ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: currentPage === 1 ? 0.4 : 1 }}
                >
                  ‹
                </button>
                {Array.from({ length: Math.ceil(cartItems.length / ITEMS_PER_PAGE) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    style={{ height: 38, minWidth: 38, borderRadius: 10, border: currentPage === p ? "none" : "1px solid #d1d5db", background: currentPage === p ? "#111827" : "white", color: currentPage === p ? "white" : "#374151", cursor: "pointer", fontWeight: 800, fontSize: 14 }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(Math.ceil(cartItems.length / ITEMS_PER_PAGE), p + 1))}
                  disabled={currentPage === Math.ceil(cartItems.length / ITEMS_PER_PAGE)}
                  style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: currentPage === Math.ceil(cartItems.length / ITEMS_PER_PAGE) ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: currentPage === Math.ceil(cartItems.length / ITEMS_PER_PAGE) ? 0.4 : 1 }}
                >
                  ›
                </button>
              </div>
            )}
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
            <h2
              style={{
                fontSize: 24,
                fontWeight: 900,
                marginBottom: 18,
                color: "#111827",
              }}
            >
              주문 요약
            </h2>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
                color: "#6b7280",
                fontSize: 15,
              }}
            >
              <span>상품 수</span>
              <span>{cartItems.length}개</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 18,
                color: "#111827",
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              <span>총 합계</span>
              <span>{totalPrice.toLocaleString("ko-KR")}원</span>
            </div>

            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px", lineHeight: 1.5 }}>
              ℹ️ 구매 후 6개월간 횟수 제한없이 다운로드 가능
            </p>

            <Link
              href="/checkout"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: 54,
                borderRadius: 16,
                border: "none",
                background: "#111827",
                color: "white",
                fontSize: 16,
                fontWeight: 900,
                textDecoration: "none",
                marginBottom: 10,
              }}
            >
              결제하기
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
              계속 쇼핑하기
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}